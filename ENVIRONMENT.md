# Environment

Python 3.12 in a conda environment (a venv works the same way). Inference needs no custom CUDA extensions; attention uses PyTorch SDPA.

```bash
conda create -n ropedia-w0 python=3.12 -y
conda activate ropedia-w0
pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128   # CUDA 12.8 driver
pip install -r requirements.txt
```

- **CUDA 13 drivers (>= 580):** install the default PyPI wheels instead (`pip install torch==2.13.0 torchvision==0.28.0`), then `pip install -r requirements.txt`.
- Install into a fresh environment. Swapping torch inside an existing one can leave two cuDNN versions behind, and the first convolution then fails with `CUDNN_STATUS_NOT_INITIALIZED`.
- Check: `python -c "import torch; print(torch.__version__, torch.cuda.is_available())"`.

Tested on H200 with driver 570 / CUDA 12.8 (torch 2.11.0+cu128, transformers 5.13.1, safetensors 0.8.0, numpy 2.4.6).
