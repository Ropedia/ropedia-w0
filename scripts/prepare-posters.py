#!/usr/bin/env python3
"""Extract web covers from original videos (requires Python 3 and FFmpeg)."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def extract(job):
    source, target, timestamp = job
    output = ROOT / target
    temporary = output.with_suffix('.tmp.jpg')
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2']
    # No seek for demonstrations: decode the very first original video frame.
    if timestamp is not None:
        command += ['-ss', str(timestamp)]
    command += ['-i', str(ROOT / source), '-map', '0:v:0', '-frames:v', '1',
                '-vf', r'scale=min(1920\,iw):-2:flags=lanczos',
                '-q:v', '3', '-threads', '2', str(temporary)]
    try:
        subprocess.run(command, check=True)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return target, output.stat().st_size


def main():
    demos = ['data_human', 'data_robot', 'anno_human', 'anno_robot',
             'teleop_wall', 'teleop_modality']
    demos += [f'cmp_{i}' for i in [0, 2, 3, 4, 5, 6, 7, 8]]
    demos += [f'cmp_x{i}' for i in range(8)]
    demos += [f'lib/{prefix}{i}' for prefix, count in [('emb', 20), ('ego', 8), ('adp', 4)]
              for i in range(count)]
    demos += [f'long_{i}' for i in range(8)]
    demos += [f'live_{i}' for i in [0, 1, 2, 3, 5, 6]]
    demos += [f'rr{i}_{view}' for i in range(6) for view in ['ego', 'ext']]
    jobs = [(f'media/{name}.mp4', f'media/{name}.jpg', None) for name in demos]
    # Closing paper-title cards, before the final fade to black.
    jobs += [('media/teaser.mp4', 'assets/teaser-poster.jpg', 29),
             ('media/film-hd.mp4', 'assets/film-poster.jpg', 114)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(extract, jobs))
    print(f'Generated {len(demos)} first-frame demo covers and 2 closing title covers '
          f'({sum(size for _, size in results) / 1024:.0f} KiB total).')


if __name__ == '__main__':
    main()
