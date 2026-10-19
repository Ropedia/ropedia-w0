"""Plücker embedding utilities for camera-conditioned video diffusion.

The implementation matches Lyra-1's `ray_condition`
(`Lyra-1/src/models/utils/data.py:177-190`) and
CameraCtrl / VideoX-Fun (`videox_fun/data/utils.py:243-276`):

    plucker = [o x d, d]                 (6 channels: moment then direction)
    layout  = (T, 6, H, W)               per video clip

We additionally support:
- Reading intrinsics / camera-to-world poses from a segment's ``data.npz``
  (keys ``intrinsics`` / ``extrinsics_c2w``) or an equivalent dict.
- First-frame-relative pose normalization.
- A scalar `scene_scale` applied to the translation column of c2w.
"""
from __future__ import annotations

import numpy as np
import torch
from typing import Optional, Tuple, Union


def _ensure_tensor(x, dtype=torch.float32) -> torch.Tensor:
    if isinstance(x, np.ndarray):
        return torch.from_numpy(x).to(dtype)
    return x.to(dtype)


def first_frame_relative(c2w: torch.Tensor) -> torch.Tensor:
    """Express all camera-to-world poses relative to frame 0.

    Args:
        c2w: (T, 4, 4) camera-to-world transforms.
    Returns:
        (T, 4, 4) where the first frame becomes the identity.
    """
    c2w_ref_inv = torch.linalg.inv(c2w[0:1])
    return c2w_ref_inv @ c2w


def apply_scene_scale(c2w: torch.Tensor, scene_scale: float) -> torch.Tensor:
    """Multiply the translation column of c2w by a scalar (rotation untouched).

    Following Lyra-1's `_norm_camera_scale`.
    """
    if scene_scale == 1.0:
        return c2w
    out = c2w.clone()
    out[..., :3, 3] = out[..., :3, 3] * float(scene_scale)
    return out


def ray_condition(K: torch.Tensor, c2w: torch.Tensor, H: int, W: int,
                  device: Optional[torch.device] = None) -> torch.Tensor:
    """Compute Plücker rays per pixel.

    Args:
        K:  (T, 3, 3) intrinsics, in pixel units of the original image.
        c2w: (T, 4, 4) camera-to-world transforms.
        H, W: spatial resolution of the desired Plücker map (the intrinsics
              should be already scaled to match this resolution).

    Returns:
        plucker: (T, 6, H, W). Channels 0:3 are the Plücker moment ``o x d``,
                 channels 3:6 are the unit-length world-frame ray direction.

    Convention matches both Lyra-1 (``src/models/utils/data.py:177-190``) and
    CameraCtrl / VideoX-Fun (``videox_fun/data/utils.py:243-276``):

        - integer pixel indices are shifted by +0.5 so rays sample pixel
          centers,
        - direction is normalized in the camera frame before rotation,
        - moment is computed as ``cross(rays_o, rays_d) = o x d``.
    """
    K = _ensure_tensor(K)
    c2w = _ensure_tensor(c2w)
    if device is not None:
        K = K.to(device)
        c2w = c2w.to(device)

    T = c2w.shape[0]

    # Pixel-center sampled grid (note +0.5 — matches Lyra-1 / CameraCtrl).
    j, i = torch.meshgrid(
        torch.arange(H, dtype=K.dtype, device=K.device),
        torch.arange(W, dtype=K.dtype, device=K.device),
        indexing="ij",
    )  # (H, W)
    i = i + 0.5
    j = j + 0.5

    # Back-project to camera-frame directions and normalize *before* rotation
    # (rotation preserves length, so ordering does not matter numerically;
    # we keep the pre-rotation form for parity with the reference repos).
    fx = K[:, 0, 0].view(T, 1, 1)
    fy = K[:, 1, 1].view(T, 1, 1)
    cx = K[:, 0, 2].view(T, 1, 1)
    cy = K[:, 1, 2].view(T, 1, 1)
    xs = (i.unsqueeze(0) - cx) / fx                            # (T, H, W)
    ys = (j.unsqueeze(0) - cy) / fy                            # (T, H, W)
    zs = torch.ones_like(xs)
    directions = torch.stack([xs, ys, zs], dim=-1)             # (T, H, W, 3)
    directions = directions / (directions.norm(dim=-1, keepdim=True) + 1e-8)

    # Camera-to-world rotation: rays_d = R @ directions
    R = c2w[:, :3, :3]                                         # (T, 3, 3)
    t = c2w[:, :3, 3]                                          # (T, 3)
    rays_d = torch.einsum("tij,thwj->thwi", R, directions)     # (T, H, W, 3)
    rays_o = t.view(T, 1, 1, 3).expand_as(rays_d)              # (T, H, W, 3)

    # Plücker moment is o x d (NOT d x o). The two differ by a sign and
    # picking the wrong order silently flips the first three feature
    # channels relative to every other reference impl.
    rays_dxo = torch.cross(rays_o, rays_d, dim=-1)             # (T, H, W, 3)

    plucker = torch.cat([rays_dxo, rays_d], dim=-1)            # (T, H, W, 6)
    plucker = plucker.permute(0, 3, 1, 2).contiguous()         # (T, 6, H, W)
    return plucker


def scale_intrinsics(K: torch.Tensor,
                     src_hw: Tuple[int, int],
                     dst_hw: Tuple[int, int]) -> torch.Tensor:
    """Scale intrinsics from a source (H, W) to a destination (H, W).

    Assumes a center crop / resize that preserves aspect ratio is unnecessary
    (i.e. straight resize). Both dimensions are scaled independently.
    """
    src_h, src_w = src_hw
    dst_h, dst_w = dst_hw
    if src_h == dst_h and src_w == dst_w:
        return K
    sx = float(dst_w) / float(src_w)
    sy = float(dst_h) / float(src_h)
    K_out = K.clone()
    K_out[..., 0, 0] = K_out[..., 0, 0] * sx
    K_out[..., 0, 2] = K_out[..., 0, 2] * sx
    K_out[..., 1, 1] = K_out[..., 1, 1] * sy
    K_out[..., 1, 2] = K_out[..., 1, 2] * sy
    return K_out


# Accepted key spellings for the intrinsics / camera-to-world arrays.
_K_ALIASES = ("K_all", "intrinsics", "K")
_C2W_ALIASES = ("T_c2w", "extrinsics_c2w", "c2w")


def load_camera_params(npy_path: str) -> dict:
    """Load camera parameters from a segment ``data.npz`` (or a pickled dict .npy).

    Returns a dict with the intrinsics / camera-to-world arrays (and ``fps`` if present).
    """
    arr = np.load(npy_path, allow_pickle=True)
    # np.save'd dicts come back as 0-d object arrays.
    if isinstance(arr, np.ndarray) and arr.dtype == object:
        return arr.item()
    if isinstance(arr, np.lib.npyio.NpzFile):
        # Materialize only the camera arrays; skip keypoints / captions.
        with arr:
            return {k: arr[k] for k in (*_K_ALIASES, *_C2W_ALIASES, "fps") if k in arr}
    return arr


def _pick(params: dict, aliases: Tuple[str, ...], what: str):
    for key in aliases:
        if key in params:
            return params[key]
    raise KeyError(
        f"camera params has no {what} array; tried {aliases}, "
        f"available keys: {sorted(params.keys())}"
    )


def compute_plucker_from_camera_params(
    camera_params: Union[str, dict],
    height: int,
    width: int,
    num_frames: Optional[int] = None,
    src_hw: Optional[Tuple[int, int]] = None,
    relative_first_frame: bool = True,
    scene_scale: float = 1.0,
    dtype: torch.dtype = torch.float32,
) -> torch.Tensor:
    """End-to-end: load camera_params, normalize, compute Plücker map.

    Args:
        camera_params: either a path to a data.npz / .npy or the loaded dict.
        height, width: target spatial resolution of the output Plücker map.
        num_frames: optional cap on the number of frames (truncates).
        src_hw: original (H, W) the intrinsics were calibrated for.
                Defaults to (height, width) — i.e. assume already correct.
        relative_first_frame: see Lyra-1, True puts frame 0 at the origin.
        scene_scale: multiplier on c2w translation column.
        dtype: output tensor dtype.

    Returns:
        plucker: (T, 6, H, W).
    """
    if isinstance(camera_params, str):
        params = load_camera_params(camera_params)
    else:
        params = camera_params

    K = _ensure_tensor(_pick(params, _K_ALIASES, "intrinsics"))  # (T, 3, 3)
    c2w = _ensure_tensor(_pick(params, _C2W_ALIASES, "c2w"))  # (T, 4, 4)

    if num_frames is not None:
        K = K[:num_frames]
        c2w = c2w[:num_frames]

    # Scale intrinsics if they refer to a different resolution (no-op unless
    # src_hw is provided).
    if src_hw is not None:
        K = scale_intrinsics(K, src_hw, (height, width))

    if relative_first_frame:
        c2w = first_frame_relative(c2w)
    if scene_scale != 1.0:
        c2w = apply_scene_scale(c2w, scene_scale)

    plucker = ray_condition(K, c2w, height, width)
    return plucker.to(dtype)
