#!/usr/bin/env python
"""Ropedia W0 inference, Wan2.2-TI2V-5B.

Weights: the released full DiT state dicts (``w0-5b-*.safetensors`` from ropedia-ai/Ropedia-W0). They already
contain the camera and skeleton condition branches; the defaults (--ckpt_type full --camera_in_dim 96
--skeleton_in_dim 48, 640x480, 81 frames) match them. ``--base_model_dir`` points at a local download
of Wan-AI/Wan2.2-TI2V-5B (VAE, umT5 text encoder, tokenizer; default models/Wan2.2-TI2V-5B).

Each sample is a window ``[s, s+num_frames)`` of the source clip; the RGB video, skeleton video,
camera parameters and skeleton mask are all sliced with the same window. Only the first frame of
the window conditions the model; the rest is saved as the GT reference. ``--start_frame N`` picks
``s`` (default 0); ``--random_start`` draws it uniformly, seeded by ``--seed``.

Single-clip mode (explicit files):
    python inference_5b.py \\
        --video <clip>/video.mp4 --camera_params <clip>/data.npz --skeleton_video <clip>/skeleton.mp4 \\
        --prompt "<caption>" --ckpt w0-5b-midtrain.safetensors --output_dir ./outputs
    Writes <output_dir>/<output_name or "video">_pred.mp4 (+ GT / overlay / concat videos).

CSV mode (rows of a metadata CSV; paths in the CSV are relative to --data_root):
    python inference_5b.py \\
        --data_root <DATA_ROOT> --metadata <DATA_ROOT>/metadata.csv --idx 0,1,2,3 \\
        --ckpt w0-5b-midtrain.safetensors --output_dir ./outputs
    Writes <output_dir>/idx<i>_pred.mp4 for every requested row i.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # repo root, so `import ropedia_w0` works from anywhere
from ropedia_w0.cli import main  # noqa: E402

if __name__ == "__main__":
    main("5b", __doc__)
