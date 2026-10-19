#!/bin/bash
# Single-clip inference with the Ropedia W0 5B model.
# A clip directory must contain: video.mp4 (its first frame conditions the model; the rest is the reference),
# data.npz (intrinsics + camera-to-world extrinsics), skeleton.mp4 (rendered skeleton condition) and prompt.txt.
# FPS (default 16) sets the fps of the written videos; CFG (default 5.0) the guidance scale (3.0 for robot data);
# NUM_FRAMES (default 81) the clip length (49 for the GR-1 clips);
# BASE_MODEL_DIR (default models/Wan2.2-TI2V-5B) the local download of Wan-AI/Wan2.2-TI2V-5B.
set -eu
W0_REPO=${W0_REPO:-$(cd "$(dirname "$0")/.." && pwd)}
export PYTHONPATH=$W0_REPO
SEG=${1:?usage: run_single_case_5b.sh <clip_dir> <ckpt.safetensors> [out_dir]}
CKPT=${2:?}
OUT=${3:-./out_case_5b}
if [ -z "${PROMPT:-}" ]; then
  if [ -s "$SEG/prompt.txt" ]; then PROMPT=$(cat "$SEG/prompt.txt")
  else PROMPT=$(python -c "import numpy as np,sys; z=np.load(sys.argv[1],allow_pickle=True); print(str(z['caption']) if 'caption' in z.files else '')" "$SEG/data.npz"); fi
fi
[ -n "$PROMPT" ] || { echo "no prompt: set PROMPT, or add $SEG/prompt.txt or a 'caption' field to data.npz" >&2; exit 1; }
python $W0_REPO/inference_5b.py \
  --video "$SEG/video.mp4" --camera_params "$SEG/data.npz" --skeleton_video "$SEG/skeleton.mp4" \
  --camera_in_dim 96 --skeleton_in_dim 48 \
  --ckpt "$CKPT" --ckpt_type full --base_model_dir "${BASE_MODEL_DIR:-$W0_REPO/models/Wan2.2-TI2V-5B}" \
  --height 480 --width 640 --num_frames "${NUM_FRAMES:-81}" --fps "${FPS:-16}" --start_frame 0 \
  --cfg_scale "${CFG:-5.0}" --num_inference_steps 50 --seed 0 \
  --prompt "$PROMPT" \
  --output_dir "$OUT"
