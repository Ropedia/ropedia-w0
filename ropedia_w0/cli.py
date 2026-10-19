"""Implementation of the Ropedia W0 inference CLI (inference_5b.py).

The released checkpoints are full DiT state dicts that contain two zero-initialised additive
condition branches on top of Wan2.2:
  camera_patch_embed    VAE latents of the Pluecker ray map (moment + direction, 2 x VAE channels)
  skeleton_patch_embed  VAE latents of the rendered skeleton video (VAE channels)
Both outputs are added onto the video patch embedding.
"""
import argparse
import csv
import glob
import os
import shutil
import subprocess
import sys

import imageio
import numpy as np
import torch
import torch.nn as nn
from PIL import Image

from ropedia_w0.utils.data import save_video
from ropedia_w0.utils.data.camera_plucker import (
    _C2W_ALIASES,
    _K_ALIASES,
    _pick,
    compute_plucker_from_camera_params,
    load_camera_params,
)
from ropedia_w0.pipelines.wan_video import WanVideoPipeline, ModelConfig
from ropedia_w0.models.wan_video_dit import WanModel


# Per-model settings of the released checkpoints.
MODELS = {
    "5b": dict(camera_in_dim=96, skeleton_in_dim=48, max_prompt_tokens=0),
}


# ---------------------------------------------------------------------------
# Condition branches
# ---------------------------------------------------------------------------

def get_dits(pipe):
    """Return [(name, WanModel)] for the DiTs on the pipeline."""
    return [(n, getattr(pipe, n)) for n in ("dit", "dit2") if isinstance(getattr(pipe, n, None), WanModel)]


def _attach_branch(pipe, attr: str, in_dim: int):
    """Attach a zero-init Conv3d ``attr`` (in_dim -> dit.dim, kernel = stride = patch size) on every DiT."""
    for name, dit in get_dits(pipe):
        if getattr(dit, attr, None) is not None and getattr(dit, attr.replace("patch_embed", "in_dim"), 0) == in_dim:
            continue
        conv = nn.Conv3d(in_dim, dit.dim, kernel_size=tuple(dit.patch_size),
                         stride=tuple(dit.patch_size), bias=False)
        nn.init.zeros_(conv.weight)
        ref = dit.patch_embedding.weight
        setattr(dit, attr, conv.to(dtype=ref.dtype, device=ref.device))
        setattr(dit, attr.replace("patch_embed", "in_dim"), in_dim)
        print(f"[cond] attached {attr} on `{name}` (in={in_dim}, out={dit.dim}, patch={tuple(dit.patch_size)})")


def attach_condition_branches(pipe, camera_in_dim: int, skeleton_in_dim: int):
    _attach_branch(pipe, "camera_patch_embed", camera_in_dim)
    _attach_branch(pipe, "skeleton_patch_embed", skeleton_in_dim)


# ---------------------------------------------------------------------------
# Video helpers
# ---------------------------------------------------------------------------

def _ffmpeg() -> str:
    """ffmpeg on PATH, else the binary bundled with imageio-ffmpeg (a dependency)."""
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run_ffmpeg(cmd, what):
    try:
        res = subprocess.run([_ffmpeg()] + cmd, capture_output=True, text=True)
    except (OSError, RuntimeError) as e:
        print(f"[{what}] ffmpeg not available ({e}); skipped", file=sys.stderr)
        return None
    return res


def overlay_skeleton_with_ffmpeg(video_path: str, skel_path: str, out_path: str) -> bool:
    cmd = [
        "-y", "-loglevel", "error",
        "-i", video_path,
        "-i", skel_path,
        # Blend in RGB, not YUV: `lighten` is per-plane, and in YUV the
        # skeleton's black background (Y=0, U=V=128) clamps chroma to >=128,
        # tinting the whole frame magenta. Convert to gbrp first.
        "-filter_complex",
        "[0:v]format=gbrp[v0];[1:v]format=gbrp[v1];"
        "[v0][v1]blend=all_mode=lighten,format=yuv420p",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
        out_path,
    ]
    res = _run_ffmpeg(cmd, "overlay")
    if res is None or res.returncode != 0:
        if res is not None:
            print(f"[overlay] ffmpeg failed: {res.stderr}", file=sys.stderr)
        return False
    return True


def hstack_with_ffmpeg(left_path: str, right_path: str, out_path: str,
                       left_label: str = "GT", right_label: str = "PRED") -> bool:
    cmd = [
        "-y", "-loglevel", "error",
        "-i", left_path, "-i", right_path,
        "-filter_complex",
        (
            f"[0:v]drawtext=text='{left_label}':x=10:y=10:fontsize=24:"
            f"fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=4[L];"
            f"[1:v]drawtext=text='{right_label}':x=10:y=10:fontsize=24:"
            f"fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=4[R];"
            f"[L][R]hstack=inputs=2"
        ),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
        out_path,
    ]
    res = _run_ffmpeg(cmd, "concat")
    if res is None:
        return False
    if res.returncode != 0:  # e.g. ffmpeg built without drawtext: fall back to a plain hstack
        cmd2 = [
            "-y", "-loglevel", "error",
            "-i", left_path, "-i", right_path,
            "-filter_complex", "[0:v][1:v]hstack=inputs=2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
            out_path,
        ]
        res2 = _run_ffmpeg(cmd2, "concat")
        if res2 is None or res2.returncode != 0:
            print(f"[concat] ffmpeg failed: {res.stderr or (res2.stderr if res2 else '')}",
                  file=sys.stderr)
            return False
    return True


def read_video_window(video_path: str, frame_idxs, height: int, width: int):
    """Read the requested frame ids from an mp4, return list[PIL.Image]
    resized to (height, width). Frame ids past EOF wrap modulo (defensive)."""
    reader = imageio.get_reader(video_path)
    try:
        t_src = int(reader.count_frames())
        frames = []
        for fi in frame_idxs:
            fi_use = fi if fi < t_src else fi % t_src
            arr = reader.get_data(fi_use)
            img = Image.fromarray(arr).convert("RGB")
            if img.size != (width, height):
                img = img.resize((width, height))
            frames.append(img)
    finally:
        reader.close()
    return frames, t_src


def read_video_window_for_gt(video_path: str, frame_idxs, out_path: str,
                             height: int, width: int, fps: int):
    """Save a re-encoded mp4 containing only the windowed frames so GT and
    prediction overlay/hstack align temporally."""
    frames, _ = read_video_window(video_path, frame_idxs, height, width)
    writer = imageio.get_writer(out_path, fps=fps, codec="libx264", quality=5,
                                pixelformat="yuv420p")
    try:
        for img in frames:
            writer.append_data(np.asarray(img))
    finally:
        writer.close()


def read_mask_window(mask_path: str, frame_idxs) -> torch.Tensor:
    arr = np.load(str(mask_path), allow_pickle=False).astype(np.float32)
    idxs = np.array(frame_idxs, dtype=np.int64)
    if arr.shape[0] < max(frame_idxs) + 1:
        idxs = idxs % arr.shape[0]
    return torch.from_numpy(arr[idxs].copy())


def read_metadata_row(metadata_csv: str, idx: int):
    with open(metadata_csv, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if idx < 0 or idx >= len(rows):
        raise IndexError(f"--idx={idx} out of range [0,{len(rows)})")
    return rows[idx]


def probe_video_length(path: str) -> int:
    reader = imageio.get_reader(path)
    try:
        return int(reader.count_frames())
    finally:
        reader.close()


def pick_start_frame(t_src: int, num_frames: int, random_start: bool,
                     start_frame: int, rng: np.random.Generator) -> int:
    if t_src < num_frames:
        raise RuntimeError(
            f"video has only {t_src} frames < num_frames={num_frames}; "
            f"inference does not pad, use a longer clip"
        )
    if random_start:
        return int(rng.integers(0, t_src - num_frames + 1))
    s = max(0, min(start_frame, t_src - num_frames))
    if s != start_frame:
        print(f"[warn] start_frame={start_frame} clipped to {s} "
              f"(t_src={t_src}, num_frames={num_frames})", flush=True)
    return s


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser(model: str, description: str):
    cfg = MODELS[model]
    parser = argparse.ArgumentParser(description=description,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    # Data
    parser.add_argument("--data_root", type=str, default=None, help="CSV mode: root that the CSV paths are relative to")
    parser.add_argument("--metadata", type=str, default=None, help="CSV mode: metadata CSV (columns video, prompt, camera_plucker, hand_skeleton_video[, hand_skeleton_mask, start_frame])")
    parser.add_argument("--idx", type=str, default="0", help="CSV mode: comma-separated row indices")
    parser.add_argument("--video", type=str, default=None, help="single-clip mode: RGB video (first frame of the window conditions the model)")
    parser.add_argument("--first_frame", type=str, default=None, help="use this image as the conditioning frame instead of the video frame")
    parser.add_argument("--camera_params", type=str, default=None, help="single-clip mode: data.npz with intrinsics + extrinsics_c2w")
    parser.add_argument("--skeleton_video", type=str, default=None, help="single-clip mode: rendered skeleton video")
    parser.add_argument("--skeleton_mask", type=str, default=None, help="optional per-frame skeleton mask .npy (default: all ones)")
    parser.add_argument("--prompt", type=str, default=None)
    parser.add_argument("--negative_prompt", type=str, default="")
    if cfg["max_prompt_tokens"]:
        _tok_help = (f"truncate the prompt to this many umT5 tokens (0 = off). The default {cfg['max_prompt_tokens']} "
                     "matches the caption length seen in training (at most ~330 tokens).")
    else:
        _tok_help = ("truncate the prompt to this many umT5 tokens (0 = off). Training captions are at most ~330 tokens; "
                     "a warning is printed above 320 either way.")
    parser.add_argument("--max_prompt_tokens", type=int, default=cfg["max_prompt_tokens"], help=_tok_help)
    # Shape
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--num_frames", type=int, default=81)
    parser.add_argument("--fps", type=int, default=16, help="fps of the written videos")
    parser.add_argument("--src_h", type=int, default=None, help="resolution the intrinsics refer to, if not --height")
    parser.add_argument("--src_w", type=int, default=None, help="resolution the intrinsics refer to, if not --width")
    parser.add_argument("--scene_scale", type=float, default=1.0, help="multiplier on the camera translation")
    parser.add_argument("--no_relative_first_frame", action="store_true",
                        help="do not express the poses relative to the first frame of the window")
    # Temporal window
    parser.add_argument("--start_frame", type=int, default=0,
                        help="source-frame index where the window starts (default 0)")
    parser.add_argument("--random_start", action="store_true",
                        help="override --start_frame: draw a uniform offset in [0, T_src - num_frames], seeded by --seed")
    parser.add_argument("--use_csv_start", action="store_true",
                        help="CSV mode: use each row's `start_frame` column as the window start (ignored with --random_start)")
    # Sampling
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--cfg_scale", type=float, default=5.0)
    parser.add_argument("--num_inference_steps", type=int, default=50)
    parser.add_argument("--sigma_shift", type=float, default=5.0)
    # Checkpoint
    parser.add_argument("--ckpt", type=str, required=True, help="Ropedia W0 checkpoint (full DiT state dict)")
    parser.add_argument("--base_model_dir", type=str, default="models/Wan2.2-TI2V-5B",
                        help="local download of Wan-AI/Wan2.2-TI2V-5B (VAE, umT5 text encoder, tokenizer)")
    parser.add_argument("--ckpt_type", type=str, choices=("full",), default="full",
                        help="the released checkpoints are full DiT state dicts")
    parser.add_argument("--camera_in_dim", type=int, default=cfg["camera_in_dim"])
    parser.add_argument("--skeleton_in_dim", type=int, default=cfg["skeleton_in_dim"])
    # Toggles
    parser.add_argument("--disable_camera", action="store_true", help="run without the camera condition")
    parser.add_argument("--disable_skeleton", action="store_true", help="run without the skeleton condition")
    # Output
    parser.add_argument("--output_dir", type=str, default="./outputs")
    parser.add_argument("--output_name", type=str, default=None)
    parser.add_argument("--save_gt", default=True, action=argparse.BooleanOptionalAction)
    parser.add_argument("--save_concat", default=True, action=argparse.BooleanOptionalAction)
    parser.add_argument("--save_overlay", default=True, action=argparse.BooleanOptionalAction)
    return parser


BASE_FILES = ["Wan2.2_VAE.pth", "models_t5_umt5-xxl-enc-bf16.pth", "google/umt5-xxl/tokenizer.json"]


def load_pipeline(model: str, base_model_dir: str):
    """Build the Wan2.2-TI2V-5B pipeline from a local download of Wan-AI/Wan2.2-TI2V-5B (nothing is downloaded here)."""
    os.environ.setdefault("DIFFSYNTH_SKIP_DOWNLOAD", "true")
    if model != "5b":
        raise ValueError(f"unknown model {model!r}")
    base = os.path.abspath(base_model_dir)
    dit_files = sorted(glob.glob(os.path.join(base, "diffusion_pytorch_model*.safetensors")))
    missing = [p for p in BASE_FILES if not os.path.exists(os.path.join(base, p))] + ([] if dit_files else ["diffusion_pytorch_model*.safetensors"])
    if missing:
        sys.exit(f"Wan2.2-TI2V-5B base model not found at {base} (missing: {missing}).\n"
                 "Download it with\n  hf download Wan-AI/Wan2.2-TI2V-5B --local-dir models/Wan2.2-TI2V-5B\n"
                 "and pass the directory with --base_model_dir (default: models/Wan2.2-TI2V-5B).")
    return WanVideoPipeline.from_pretrained(
        torch_dtype=torch.bfloat16,
        device="cuda",
        model_configs=[
            ModelConfig(path=os.path.join(base, "models_t5_umt5-xxl-enc-bf16.pth")),
            ModelConfig(path=dit_files),
            ModelConfig(path=os.path.join(base, "Wan2.2_VAE.pth")),
        ],
        tokenizer_config=ModelConfig(path=os.path.join(base, "google", "umt5-xxl")),
        redirect_common_files=False,
    )


# Keys that a released checkpoint must provide: both condition branches and every transformer block.
REQUIRED_KEY_PREFIXES = ("camera_patch_embed.", "skeleton_patch_embed.", "blocks.")


def check_checkpoint_keys(model_keys, ckpt_keys, path: str, target: str = "dit"):
    """Compare the keys of a checkpoint with the state dict of the model it is loaded into.

    Raises RuntimeError if the checkpoint has keys the model does not know (wrong model size, wrong
    --camera_in_dim / --skeleton_in_dim, or not a released checkpoint), or if it lacks the condition
    branches or any transformer-block weight. Returns the list of other missing keys (normally empty).
    """
    model_keys, ckpt_keys = set(model_keys), set(ckpt_keys)
    unexpected = sorted(ckpt_keys - model_keys)
    missing = sorted(model_keys - ckpt_keys)
    missing_required = [k for k in missing if k.startswith(REQUIRED_KEY_PREFIXES)]
    if unexpected or missing_required:
        def _show(keys):
            return ", ".join(keys[:5]) + (f", ... ({len(keys)} total)" if len(keys) > 5 else "")
        msg = [f"checkpoint {path} does not match the `{target}` model:"]
        if unexpected:
            msg.append(f"  {len(unexpected)} unexpected keys: {_show(unexpected)}")
        if missing_required:
            msg.append(f"  {len(missing_required)} missing keys: {_show(missing_required)}")
        msg.append("  Check that the checkpoint is a Ropedia W0 5B checkpoint and that "
                   "--camera_in_dim / --skeleton_in_dim are the defaults (96 / 48).")
        raise RuntimeError("\n".join(msg))
    return [k for k in missing if k not in missing_required]


def load_checkpoints(pipe, model: str, args):
    from safetensors import safe_open
    from safetensors.torch import load_file
    pairs = [("dit", args.ckpt)]
    for name, path in pairs:
        dit = getattr(pipe, name)
        with safe_open(path, framework="pt") as f:   # header only: fail before reading any tensor
            ckpt_keys = list(f.keys())
        other_missing = check_checkpoint_keys(dit.state_dict().keys(), ckpt_keys, path, name)
        result = dit.load_state_dict(load_file(path), strict=False)
        if other_missing:
            print(f"[ckpt] warning: {len(other_missing)} model keys not in {os.path.basename(path)} "
                  f"(kept from the base model), e.g. {other_missing[:3]}")
        print(f"[ckpt] {os.path.basename(path)} -> {name}: missing={len(result.missing_keys)} "
              f"unexpected={len(result.unexpected_keys)}")


def main(model: str, description: str = None):
    args = build_parser(model, description).parse_args()

    needed_overrides = (args.video, args.camera_params, args.skeleton_video, args.prompt)
    use_metadata = any(x is None for x in needed_overrides)
    if use_metadata:
        if args.metadata is None or args.data_root is None:
            raise SystemExit(
                "Either --metadata + --data_root + --idx OR all of "
                "--video --camera_params --skeleton_video --prompt must be provided."
            )
        idx_list = [int(x) for x in str(args.idx).split(",") if x.strip()]
    else:
        idx_list = [None]

    pipe = load_pipeline(model, args.base_model_dir)
    attach_condition_branches(pipe, camera_in_dim=args.camera_in_dim, skeleton_in_dim=args.skeleton_in_dim)
    load_checkpoints(pipe, model, args)

    os.makedirs(args.output_dir, exist_ok=True)
    rng = np.random.default_rng(args.seed)

    for idx in idx_list:
        if idx is not None:
            row = read_metadata_row(args.metadata, idx)
            video_path = os.path.join(args.data_root, row["video"])
            camera_path = os.path.join(args.data_root, row["camera_plucker"])
            skeleton_path = os.path.join(args.data_root, row["hand_skeleton_video"])
            mask_rel = row.get("hand_skeleton_mask", "")
            mask_path = os.path.join(args.data_root, mask_rel) if mask_rel else ""
            prompt = row["prompt"]
            stem = (args.output_name or f"idx{idx}")
            if args.output_name is not None and len(idx_list) > 1:
                stem = f"{os.path.splitext(args.output_name)[0]}_idx{idx}"
        else:
            video_path = args.video
            camera_path = args.camera_params
            skeleton_path = args.skeleton_video
            mask_path = args.skeleton_mask or ""
            prompt = args.prompt
            stem = args.output_name or "video"

        stem = os.path.splitext(stem)[0]

        # Window
        t_src = probe_video_length(video_path)
        row_start = args.start_frame
        if args.use_csv_start and idx is not None and not args.random_start:
            sf_str = row.get("start_frame", "")
            try:
                row_start = int(sf_str) if sf_str not in (None, "", "nan") else args.start_frame
            except (ValueError, TypeError):
                row_start = args.start_frame
        s = pick_start_frame(t_src, args.num_frames, args.random_start, row_start, rng)
        frame_idxs = list(range(s, s + args.num_frames))
        print(f"[infer idx={idx}] t_src={t_src} start_frame={s} "
              f"window=[{s},{s+args.num_frames})", flush=True)

        # Conditioning frame
        if args.first_frame is not None:
            first_frame = Image.open(args.first_frame).convert("RGB")
        else:
            with imageio.get_reader(video_path) as r:
                first_frame = Image.fromarray(r.get_data(s)).convert("RGB")
        first_frame = first_frame.resize((args.width, args.height))

        # Pluecker ray map of the window (poses relative to the window's first frame)
        plucker = None
        if not args.disable_camera:
            params = load_camera_params(camera_path)
            K_all = np.asarray(_pick(params, _K_ALIASES, "intrinsics"))[frame_idxs]
            T_c2w = np.asarray(_pick(params, _C2W_ALIASES, "c2w"))[frame_idxs]
            plucker = compute_plucker_from_camera_params(
                camera_params={"K_all": K_all, "T_c2w": T_c2w},
                height=args.height,
                width=args.width,
                num_frames=None,
                src_hw=(args.src_h, args.src_w) if args.src_h and args.src_w else None,
                relative_first_frame=not args.no_relative_first_frame,
                scene_scale=args.scene_scale,
            )

        # Skeleton video + mask of the window
        skeleton_frames = None
        skeleton_mask = None
        if not args.disable_skeleton:
            skeleton_frames, _ = read_video_window(skeleton_path, frame_idxs, args.height, args.width)
            if mask_path:
                skeleton_mask = read_mask_window(mask_path, frame_idxs)
            else:
                skeleton_mask = torch.ones(args.num_frames, dtype=torch.float32)
            n_usable = int(skeleton_mask.sum().item())
            print(f"[infer idx={idx}] skeleton_mask usable={n_usable}/{args.num_frames}", flush=True)

        _ids = pipe.tokenizer.tokenizer(prompt, add_special_tokens=False)["input_ids"]
        if len(_ids) > 320:
            print(f"[infer idx={idx}] WARNING: prompt is {len(_ids)} tokens; training captions are <= ~330", flush=True)
        if args.max_prompt_tokens and len(_ids) > args.max_prompt_tokens:
            prompt = pipe.tokenizer.tokenizer.decode(_ids[:args.max_prompt_tokens], skip_special_tokens=True)
            print(f"[infer idx={idx}] prompt truncated to {args.max_prompt_tokens} tokens (--max_prompt_tokens)", flush=True)
        print(f"\n[infer idx={idx}] prompt={prompt!r}", flush=True)

        video = pipe(
            prompt=prompt,
            negative_prompt=args.negative_prompt,
            input_image=first_frame,
            camera_plucker=plucker,
            hand_skeleton_video=skeleton_frames,
            hand_skeleton_mask=skeleton_mask,
            seed=args.seed,
            height=args.height, width=args.width, num_frames=args.num_frames,
            cfg_scale=args.cfg_scale,
            num_inference_steps=args.num_inference_steps,
            sigma_shift=args.sigma_shift,
            tiled=True,
        )

        pred_path = os.path.join(args.output_dir, f"{stem}_pred.mp4")
        save_video(video, pred_path, fps=args.fps, quality=5)
        print(f"[done] pred -> {pred_path}", flush=True)

        gt_path = None
        if args.save_gt:
            gt_path = os.path.join(args.output_dir, f"{stem}_gt.mp4")
            # Re-encode only the windowed frames so the GT lines up with the prediction.
            read_video_window_for_gt(video_path, frame_idxs, gt_path, args.height, args.width, args.fps)
            print(f"[done] gt   -> {gt_path}", flush=True)

        # Windowed skeleton mp4 so the overlay aligns.
        gt_skel_path = pred_skel_path = None
        if args.save_overlay and skeleton_path is not None and not args.disable_skeleton:
            win_skel_path = os.path.join(args.output_dir, f"{stem}_skelwin.mp4")
            read_video_window_for_gt(skeleton_path, frame_idxs, win_skel_path, args.height, args.width, args.fps)
            gt_skel_path = os.path.join(args.output_dir, f"{stem}_gt_skel.mp4")
            pred_skel_path = os.path.join(args.output_dir, f"{stem}_pred_skel.mp4")
            if gt_path and not overlay_skeleton_with_ffmpeg(gt_path, win_skel_path, gt_skel_path):
                gt_skel_path = None
            if not gt_path:
                gt_skel_path = None
            if not overlay_skeleton_with_ffmpeg(pred_path, win_skel_path, pred_skel_path):
                pred_skel_path = None
            if gt_skel_path:
                print(f"[done] gt+skel  -> {gt_skel_path}", flush=True)
            if pred_skel_path:
                print(f"[done] pred+skel-> {pred_skel_path}", flush=True)

        if args.save_concat and gt_path is not None:
            cat_path = os.path.join(args.output_dir, f"{stem}_concat.mp4")
            if hstack_with_ffmpeg(gt_skel_path or gt_path, pred_skel_path or pred_path, cat_path,
                                  left_label="GT+SKEL" if gt_skel_path else "GT",
                                  right_label="PRED+SKEL" if pred_skel_path else "PRED"):
                print(f"[done] cat  -> {cat_path}", flush=True)

        with open(os.path.join(args.output_dir, f"{stem}.txt"), "w", encoding="utf-8") as f:
            f.write(f"prompt: {prompt}\n")
            f.write(f"start_frame: {s}\n")
            f.write(f"window: [{s},{s+args.num_frames})\n")
            f.write(f"t_src: {t_src}\n")
