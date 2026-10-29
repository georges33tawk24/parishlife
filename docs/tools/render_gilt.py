#!/usr/bin/env python3
"""Renders gold leaf as a seamless tile (gilt.webp) for the gilded buttons: squares of leaf laid
in courses, each a little different in tone and burnish, their overlapping edges, the fine
wrinkles of the leaf, and here and there a pinhole showing the red bole beneath. The tile is 240
CSS pixels square, rendered at twice that.

  python3 docs/tools/render_gilt.py assets/images

Needs numpy, scipy and Pillow."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/gilt')
T, LEAF = 480, 120
rng = np.random.default_rng(24)


def lin(c):
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def noise(beta, angle=0.0, stretch=1.0):
    fy, fx = np.fft.fftfreq(T)[:, None], np.fft.rfftfreq(T)[None, :]
    c, s = np.cos(angle), np.sin(angle)
    f = np.hypot((fx * c + fy * s) * stretch, -fx * s + fy * c)
    f[0, 0] = 1
    amp = f ** (-beta / 2)
    amp[0, 0] = 0
    n = np.fft.irfft2(np.fft.rfft2(rng.standard_normal((T, T))) * amp, s=(T, T))
    return (n - n.mean()) / n.std()


y, x = np.mgrid[0:T, 0:T].astype(np.float32)
row = np.floor(y / LEAF).astype(int)
shift = (row % 2) * LEAF / 2
col = np.floor(((x + shift) % T) / LEAF).astype(int)
leaf = row * 8 + col
# the edges where one leaf overlaps the next: a fine dark line with a lifted bright lip beside it
ex = (x + shift) % LEAF
ey = y % LEAF
edge = np.minimum(ex, ey) + .9 * noise(2.6)
seam = np.exp(-(edge / 1.1) ** 2)
lip = np.exp(-((edge - 2.6) / 1.4) ** 2)

tone = np.exp(rng.normal(0, .1, 64))[leaf]
angles = rng.uniform(0, np.pi, 64)
burnish = np.zeros((T, T))
for i in range(64):
    if (leaf == i).any():
        burnish = np.where(leaf == i, noise(2.2, angles[i], 7.0), burnish)
wrinkles = np.clip(np.abs(noise(1.4)) - 1.7, 0, None)
holes = ndi.binary_dilation(np.clip(noise(.3) - 4.1, 0, None) > 0, iterations=1)

gold = lin(np.array([.85, .63, .27])) * (tone * (1 + .13 * burnish + .05 * noise(2.8)))[..., None]
gold *= (1 - .22 * seam + .1 * lip - .2 * np.clip(wrinkles, 0, 1))[..., None]
gold = np.where(holes[..., None], lin(np.array([.48, .2, .1])), gold)
rgb = to_srgb(gold)
out.mkdir(parents=True, exist_ok=True)
path = out / 'gilt.webp'
Image.fromarray((rgb * 255 + .5).astype(np.uint8), 'RGB').save(path, quality=86, method=6)
print(path, path.stat().st_size // 1024, 'KB')
