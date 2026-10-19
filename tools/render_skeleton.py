#!/usr/bin/env python
"""Render <clip_dir>/skeleton.mp4 (human hands) from <clip_dir>/data.npz.

data.npz needs:
  hand_kp   (T, num_hands, 21, 2)  MANO-order 2D keypoints in pixels of the source video; NaN = not drawn
  image_hw  (2,)                   optional, source (H, W) the keypoints refer to; default = output size

The renderer and the settings (480x640, 81 frames, 16 fps, imageio quality 10) are the same ones
that produced the training skeleton videos, so the output matches what the
released models were conditioned on.

usage: python tools/render_skeleton.py <clip_dir> [<clip_dir> ...] [--overwrite]
"""
import argparse, os, sys

sys.path.insert(0, os.environ.get("W0_REPO") or os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

H, W, T, FPS, QUALITY = 480, 640, 81, 16, 10


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clip_dirs", nargs="+")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--num_frames", type=int, default=T)
    args = ap.parse_args()

    import numpy as np, imageio
    from ropedia_w0.core.data.operators import LoadHandSkeletonRender
    render = LoadHandSkeletonRender(H, W, args.num_frames)
    for seg in args.clip_dirs:
        dst = os.path.join(seg, "skeleton.mp4")
        if os.path.exists(dst) and not args.overwrite:
            print(f"skip (exists, use --overwrite): {dst}")
            continue
        frames = render(os.path.join(seg, "data.npz"))
        tmp = dst + ".tmp.mp4"
        w = imageio.get_writer(tmp, fps=FPS, quality=QUALITY)
        for f in frames:
            w.append_data(np.asarray(f))
        w.close()
        os.replace(tmp, dst)
        print(f"wrote {dst} ({len(frames)} frames)")


if __name__ == "__main__":
    main()
