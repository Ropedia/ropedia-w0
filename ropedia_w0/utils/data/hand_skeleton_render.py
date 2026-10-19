"""On-the-fly hand-skeleton rendering for skeleton-conditioned video diffusion.

Draws OpenPose/ControlNet-style 21-keypoint hand skeletons (MANO joint order)
on a black canvas, one frame per video frame, from the keypoints stored in a
segment's `data.npz`:

    hand_kp:    (T, num_hands, 21, 2) float, pixel coords in the SOURCE frame
    hand_order: (num_hands,) str, e.g. ['left', 'right']  (colors are shared,
                kept only for API clarity)

Missing data is expressed with NaN: a NaN keypoint is skipped, an all-NaN
hand is simply not drawn, and a frame with no drawable joints stays black —
a black frame doubles as the natural CFG-null for the conditioning branch.

Keypoints are mapped into the training resolution with the exact geometry of
`ImageCropAndResize` (aspect-preserving resize + center crop) and drawn
directly at the target resolution, so lines stay crisp and pixel-aligned
with the video frames the VAE sees.
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from typing import List, Optional, Tuple



# Same geometry as ImageCropAndResize (kept local so this module is self-contained).
def crop_resize_params(src_hw: Tuple[int, int], dst_hw: Tuple[int, int]):
    """Replicate ImageCropAndResize geometry: aspect-preserving resize by
    ``scale = max(dst_w/src_w, dst_h/src_h)`` followed by a center crop.

    Returns (scale, crop_top, crop_left) with the exact rounding used by
    torchvision's resize/center_crop so keypoints and intrinsics can be
    mapped onto the cropped frame without drift.
    """
    src_h, src_w = src_hw
    dst_h, dst_w = dst_hw
    scale = max(dst_w / src_w, dst_h / src_h)
    resized_h, resized_w = round(src_h * scale), round(src_w * scale)
    crop_top = int(round((resized_h - dst_h) / 2.0))
    crop_left = int(round((resized_w - dst_w) / 2.0))
    return scale, crop_top, crop_left


# MANO 21-joint layout (OpenPose / MediaPipe-compatible).
#   0: wrist
#   thumb : 1 (cmc) - 2 (mcp) - 3 (ip)  - 4 (tip)
#   index : 5 (mcp) - 6 (pip) - 7 (dip) - 8 (tip)
#   middle: 9       - 10      - 11      - 12
#   ring  : 13      - 14      - 15      - 16
#   pinky : 17      - 18      - 19      - 20
BONES: List[Tuple[int, int]] = [
    (0, 1), (1, 2), (2, 3), (3, 4),         # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),         # index
    (0, 9), (9, 10), (10, 11), (11, 12),    # middle
    (0, 13), (13, 14), (14, 15), (15, 16),  # ring
    (0, 17), (17, 18), (18, 19), (19, 20),  # pinky
]


def _ramp(c0, c1, n=4):
    """Linear colour interpolation (`n` steps from c0 (root) to c1 (tip))."""
    return [
        tuple(int(round(c0[i] + (c1[i] - c0[i]) * k / (n - 1))) for i in range(3))
        for k in range(n)
    ]


# OpenPose / ControlNet-style hand palette, 21 entries, RGB. Each finger has
# its own hue with a brightness gradient from MCP (dark) to tip (bright).
# Left and right hand share the palette — the model learns side from spatial
# position. (The offline renderer stores the same palette in BGR for cv2;
# values here are converted to RGB so the rendered colors are identical.)
HAND_COLORS_RGB: List[Tuple[int, int, int]] = [
    (200, 200, 200),                                                   # 0   : wrist (light grey, root anchor)
    *_ramp((100,   0,   0), (255,   0,   0)),                          # 1-4 : thumb  (dark red → red)
    *_ramp((100, 100,   0), (255, 255,   0)),                          # 5-8 : index  (dark yellow → yellow)
    *_ramp((0,   100,   0), (0,   255,   0)),                          # 9-12: middle (dark green → green)
    *_ramp((0,   100, 100), (0,   255, 255)),                          # 13-16: ring  (dark cyan → cyan)
    *_ramp((100,   0, 100), (255,   0, 255)),                          # 17-20: pinky (dark magenta → magenta)
]
assert len(HAND_COLORS_RGB) == 21


def draw_hand(canvas: np.ndarray, uv: np.ndarray,
              line_thickness: int = 2, joint_radius: int = 3) -> None:
    """Draw one hand (21 x 2 pixel coords) onto an RGB uint8 canvas in place.

    A joint is skipped when it is NaN or falls outside the canvas; bones with
    a skipped endpoint are not drawn.
    """
    import cv2

    H, W = canvas.shape[:2]
    pts: List[Optional[Tuple[int, int]]] = []
    for j in range(21):
        x, y = float(uv[j, 0]), float(uv[j, 1])
        if not (np.isfinite(x) and np.isfinite(y)):
            pts.append(None); continue
        if not (0 <= x < W and 0 <= y < H):
            pts.append(None); continue
        pts.append((int(round(x)), int(round(y))))

    # Bones: colour each segment by its CHILD joint (further from wrist).
    for a, b in BONES:
        pa, pb = pts[a], pts[b]
        if pa is None or pb is None:
            continue
        cv2.line(canvas, pa, pb, HAND_COLORS_RGB[b], line_thickness, cv2.LINE_AA)

    # Joints: each keypoint takes its own palette colour.
    for j, p in enumerate(pts):
        if p is None:
            continue
        cv2.circle(canvas, p, joint_radius, HAND_COLORS_RGB[j], -1, cv2.LINE_AA)


def transform_keypoints(hand_kp: np.ndarray,
                        src_hw: Tuple[int, int],
                        dst_hw: Tuple[int, int]) -> np.ndarray:
    """Map (…, 2) xy pixel coords from the source frame into the
    ImageCropAndResize'd target frame. NaN passes through untouched."""
    if tuple(src_hw) == tuple(dst_hw):
        return hand_kp
    scale, crop_top, crop_left = crop_resize_params(src_hw, dst_hw)
    out = hand_kp.astype(np.float32).copy()
    out[..., 0] = out[..., 0] * scale - crop_left
    out[..., 1] = out[..., 1] * scale - crop_top
    return out


def render_hand_skeleton_frames(
    hand_kp: np.ndarray,
    height: int,
    width: int,
    num_frames: Optional[int] = None,
    src_hw: Optional[Tuple[int, int]] = None,
    line_thickness: int = 2,
    joint_radius: int = 3,
) -> List[Image.Image]:
    """Render a list of PIL RGB frames (black background + hand skeletons).

    Args:
        hand_kp: (T, num_hands, 21, 2) pixel coords in the source frame.
        height, width: target render resolution (the training resolution).
        num_frames: optional cap (truncates); if hand_kp has fewer frames the
                    remainder is padded with black frames.
        src_hw: (H, W) the keypoints refer to; None means already at target.
    """
    hand_kp = np.asarray(hand_kp, dtype=np.float32)
    if hand_kp.ndim != 4 or hand_kp.shape[-2:] != (21, 2):
        raise ValueError(f"hand_kp must be (T, num_hands, 21, 2); got {hand_kp.shape}")

    if src_hw is not None:
        hand_kp = transform_keypoints(hand_kp, src_hw, (height, width))

    T = hand_kp.shape[0] if num_frames is None else num_frames
    frames = []
    for t in range(T):
        canvas = np.zeros((height, width, 3), dtype=np.uint8)
        if t < hand_kp.shape[0]:
            for h in range(hand_kp.shape[1]):
                uv = hand_kp[t, h]
                if np.isfinite(uv).any():
                    draw_hand(canvas, uv, line_thickness, joint_radius)
        frames.append(Image.fromarray(canvas))
    return frames
