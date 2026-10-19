# Example clips

Eighteen clips at 640×480, each a complete input for `scripts/run_single_case_5b.sh`: `video.mp4` (its first frame conditions the model; the other frames are the reference), `data.npz` (camera intrinsics and camera-to-world poses; the human clips also carry the `hand_kp` hand keypoints), `skeleton.mp4` (the rendered skeleton condition) and `prompt.txt`. All clips have 81 frames except the GR-1 clips, which have 49.

| Clip | Embodiment | Motion | Source |
|---|---|---|---|
| `xp_teleop_place_bottle` | Unitree G1 + Inspire hands | sets a bottle down on a table | Xp-Teleop |
| `xp_teleop_lift_jacket` | Unitree G1 + Inspire hands | lifts a jacket off a bed | Xp-Teleop |
| `xp_teleop_playdoh_tub` | Unitree G1 + Inspire hands | lowers a tub onto a box | Xp-Teleop |
| `omega_home_arrange_fruit` | Unitree G1 + Inspire hands | grasps fruit from a shelf | ω-HOME |
| `omega_home_apple_basket` | Unitree G1 + Inspire hands | drops an apple into a basket | ω-HOME |
| `omega_home_hang_clothes` | Unitree G1 + Inspire hands | holds a shirt on a hanger over a bed | ω-HOME |
| `omega_home_push_chair` | Unitree G1 + Inspire hands | pushes a chair away | ω-HOME |
| `omega_home_hang_shirt` | Unitree G1 + Inspire hands | holds a shirt on a hanger | ω-HOME |
| `omega_home_sort_fruit` | Unitree G1 + Inspire hands | moves a nectarine over a basket | ω-HOME |
| `agibot_rice_cooker` | AgiBot G1 (grippers) | presses on a rice cooker | AgiBot World |
| `agibot_peel_cucumber` | AgiBot G1 (grippers) | peels a cucumber | AgiBot World |
| `gr1_grasp_plate` | Fourier GR-1 | grasps a plate from a dish rack | GR-1 |
| `gr1_place_cucumber` | Fourier GR-1 | places a cucumber on a plate | GR-1 |
| `gr1_stack_blocks` | Fourier GR-1 | stacks a block on a tower | GR-1 |
| `egodex_tv_remote` | human | holds a TV remote at a desk | EgoDex |
| `xp10m_cut_cardboard` | human | cuts cardboard with a utility knife | Xperience-10M |
| `xp10m_jigsaw_puzzle` | human | fits a jigsaw piece | Xperience-10M |
| `openaoe_keychain` | human | assembles and bags a keychain | OpenAoE |

```bash
# robot clips: cfg 3.0, 30 fps
CFG=3.0 FPS=30 bash scripts/run_single_case_5b.sh examples/xp_teleop_playdoh_tub weights/w0-5b-midtrain.safetensors outputs/playdoh_tub
# GR-1 clips: 49 frames at 10 fps
CFG=3.0 FPS=10 NUM_FRAMES=49 bash scripts/run_single_case_5b.sh examples/gr1_grasp_plate weights/w0-5b-midtrain.safetensors outputs/gr1_grasp_plate
# human clips: the defaults (cfg 5.0, 16 fps)
bash scripts/run_single_case_5b.sh examples/xp10m_cut_cardboard weights/w0-5b-midtrain.safetensors outputs/cut_cardboard
```

Each run writes `video_pred.mp4` (the prediction), `video_gt.mp4` (the reference frames), `video_concat.mp4` (reference | prediction) and the skeleton overlays into the output directory.

## Sources and licenses

| Source | Clips | License |
|---|---|---|
| [Xp-Teleop](https://huggingface.co/datasets/ropedia-ai/Xp-Teleop) | `xp_teleop_*` | CC BY 4.0 |
| [ω-HOME](https://huggingface.co/datasets/keycharon/omega-HOME) | `omega_home_*` | MIT |
| [AgiBot World](https://huggingface.co/datasets/agibot-world/AgiBotWorld-Beta) | `agibot_*` | CC BY-NC-SA 4.0 |
| [GR00T-Teleop-GR1](https://huggingface.co/datasets/nvidia/PhysicalAI-Robotics-GR00T-Teleop-GR1) | `gr1_*` | CC BY-NC 4.0 |
| [Xperience-10M](https://huggingface.co/datasets/ropedia-ai/xperience-10m) | `xp10m_*` | non-commercial research use |
| [EgoDex](https://github.com/apple/ml-egodex) | `egodex_*` | CC BY-NC-ND 4.0 |
| [OpenAoE](https://huggingface.co/datasets/inclusionAI/OpenAoE-2000h) | `openaoe_*` | OpenAoE dataset license |
