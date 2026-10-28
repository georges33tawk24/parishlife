#!/usr/bin/env python3
"""Renders the sanctuary's wall as a seamless tile (wall.webp): courses of dressed limestone, each
block its own tone, its face worked with a claw chisel, its edges worn and chipped, set in
recessed mortar and lit from above. The tile is 1152 by 576 CSS pixels (six courses of 96),
rendered at the scale given.

  python3 docs/tools/render_wall.py assets/images/sanctuary [scale]

Needs numpy, scipy and Pillow."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sanctuary')
S = float(sys.argv[2]) if len(sys.argv) > 2 else 1.25
TW, TH, COURSE = 1152, 576, 96
W, H = round(TW * S), round(TH * S)
rng = np.random.default_rng(64)


def lin(c):
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def noise(beta, angle=0.0, stretch=1.0):
    """Seamless noise with a 1/f^beta spectrum, unit variance: it wraps at the tile's edges."""
    fy, fx = np.fft.fftfreq(H)[:, None], np.fft.rfftfreq(W)[None, :]
    c, s = np.cos(angle), np.sin(angle)
    f = np.hypot((fx * c + fy * s) * stretch, -fx * s + fy * c)
    f[0, 0] = 1
    amp = f ** (-beta / 2)
    amp[0, 0] = 0
    n = np.fft.irfft2(np.fft.rfft2(rng.standard_normal((H, W))) * amp, s=(H, W))
    return ((n - n.mean()) / n.std()).astype(np.float32)


def wrap_blur(a, sigma):
    return ndi.gaussian_filter(a, sigma, mode='wrap')


Y, X = np.mgrid[0:H, 0:W].astype(np.float32) / S   # CSS pixels
row = np.floor(Y / COURSE).astype(int)
gap = np.abs((Y + COURSE / 2) % COURSE - COURSE / 2)          # to the bed joints
block = np.zeros((H, W), np.int64)
for r in range(TH // COURSE):
    widths = rng.uniform(170, 330, 12)
    widths = widths[:np.searchsorted(np.cumsum(widths), TW) + 1]
    widths *= TW / widths.sum()                                 # the course closes on itself
    joints = (np.concatenate([[0], np.cumsum(widths)[:-1]]) + rng.uniform(0, TW)) % TW
    band = row == r
    d = np.abs((X[band][:, None] - joints[None, :] + TW / 2) % TW - TW / 2)
    gap[band] = np.minimum(gap[band], d.min(1))
    rel = (X[band][:, None] - joints[None, :]) % TW
    block[band] = r * 20 + rel.argmin(1)

# chipped edges: the joint wanders a little, and the arrises are knocked back here and there
gap = gap + 1.1 * noise(3.0) + 2.2 * np.clip(noise(2.6) - .8, 0, None)
mortar = np.clip(1 - gap / 3, 0, 1) ** .7
arris = np.clip(gap / 9, 0, 1) ** .5
pillow = np.clip(gap / 26, 0, 1) ** .5

# the face: hewn undulation, a claw chisel's strokes on the slant, pits in the stone
face = 1.3 * noise(3.0) + .2 * noise(1.8)
tooth = np.sin((X + Y) * 2 * np.pi / 3.1 + 3 * noise(2.4)) * np.clip(.5 + .5 * noise(3.0), 0, 1)
pits = np.clip(noise(.4) - 2.5, 0, None)
height = 5 * arris + 4 * pillow - 2.2 * mortar + .8 * face + .06 * tooth - .9 * pits
height *= S

gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / 2
gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) / 2
n = np.stack([-gx, -gy, np.ones_like(height)], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
light = np.array([-.28, -.62, .73])
light /= np.linalg.norm(light)
diffuse = np.clip(n @ light, 0, 1)
ao = np.clip(1 - .9 * np.clip(wrap_blur(height, 4 * S) - height, 0, None) / S - .35 * mortar, .3, 1)

# limestone: a warm grey, each block its own tone; the mortar darker and sandier
tone = np.exp(rng.normal(0, .11, 400))[block]
hue = (1 + rng.normal(0, .018, (400, 3)))[block]
stain = 1 - .12 * np.clip(noise(3.2), 0, None) - .06 * noise(1.8)
stone = lin(np.array([.47, .4, .32])) * hue * (tone * stain * (1 - .35 * np.clip(pits, 0, 1)))[..., None]
sand = lin(np.array([.2, .17, .14])) * (1 + .2 * noise(.8))[..., None]
albedo = stone * (1 - mortar)[..., None] + sand * mortar[..., None]
rgb = albedo * ((.3 + .95 * diffuse) * ao)[..., None]
rgb = to_srgb(rgb * .95) + rng.normal(0, .006, rgb.shape)
out.mkdir(parents=True, exist_ok=True)
path = out / 'wall.webp'
Image.fromarray((np.clip(rgb, 0, 1) * 255 + .5).astype(np.uint8), 'RGB').save(path, quality=74, method=6)
print(path, (W, H), path.stat().st_size // 1024, 'KB')
