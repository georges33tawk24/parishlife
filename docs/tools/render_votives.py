#!/usr/bin/env python3
"""Renders a votive stand in a dark church (votives.webp): tiers of candles in ruby, amber and clear
glass cups on a brass rack, most of them lit, seen close with a shallow depth of field, so the
nearest and farthest rows melt into discs of light. It stands beside "Run by the parishes" on the
homepage: each parish one light among many.

  python3 docs/tools/render_votives.py assets/images

Needs numpy, scipy and Pillow. Everything random is seeded."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.signal import fftconvolve

out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/votives')
W, H = 1000, 1475            # drawn at 1.25x and brought down to 800 by 1180
rng = np.random.default_rng(316)
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def filmic(x):
    return np.clip(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0, 1)


def disc(radius):
    """The lens's aperture: a disc with a slightly brighter rim, as real bokeh has."""
    r = max(1, int(np.ceil(radius)))
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.hypot(x, y) / max(radius, .5)
    k = np.clip(1.5 - d * 1.5 + .5, 0, 1) * (d <= 1) * (.85 + .15 * d)
    return k / k.sum()


def defocus(layer, radius):
    if radius < .7:
        return layer
    k = disc(radius)
    return np.stack([np.clip(fftconvolve(layer[..., i], k, mode='same'), 0, None) for i in range(layer.shape[2])], -1)


GLASS = [np.array([1.0, .05, .04]), np.array([1.0, .5, .1]), np.array([1.0, .74, .44]), np.array([.2, .35, 1.0])]
PICK = [.7, .19, .07, .04]

# rows from the back to the front: depth (focus is on the third), height on the picture, cup size
rows = [(3.2, .2, 46), (2.5, .33, 60), (1.9, .5, 80), (1.45, .7, 104), (1.1, .95, 136)]
focus = 1.9
image = np.zeros((H, W, 3), np.float32)
# the dark church behind: a warm gloom, darker above, a pillar's edge in the far shadow
back = np.stack([np.full((H, W), v, np.float32) for v in (.012, .008, .006)], -1)
back *= (.4 + .9 * (Y / H))[..., None]
back += (np.exp(-((X - W * .8) / 60) ** 2) * .006 * (1 - Y / H))[..., None]
image += back
lights = []

for depth, level, size in rows:
    layer = np.zeros((H, W, 4), np.float32)    # premultiplied colour and coverage
    w, h = size, size * 1.18
    base = level * H
    # the brass rail the cups stand on
    rail_top, rail_h = base + 2, size * .2
    rail = (Y > rail_top) & (Y < rail_top + rail_h)
    t = np.clip((Y - rail_top) / rail_h, 0, 1)
    shade = np.where(t < .3, .9 - t, .45 - .3 * t)
    brushed = 1 + .08 * ndi.gaussian_filter1d(rng.standard_normal(W), 3)[None, :]
    rail_rgb = np.array([.55, .34, .1]) * (shade * brushed)[..., None]
    count = int(W * 1.3 / (w * 1.42)) + 2
    xs = (np.arange(count) - .5) * w * 1.42 + rng.uniform(-w * .3, w * .3) - W * .15
    glow_x = []
    for x0 in xs + rng.normal(0, w * .06, count):
        kind = rng.choice(4, p=PICK)
        lit = rng.random() > .1
        u = (X - x0) / (w / 2)
        v = (base + rng.normal(0, size * .03) - Y) / h
        inside = (np.abs(u) < 1) & (v > 0) & (v < 1)
        if not inside.any():
            continue
        nz = np.sqrt(np.clip(1 - u ** 2, 0, 1))
        glass = GLASS[kind]
        flicker = rng.uniform(.8, 1.15)
        fv = rng.uniform(.5, .66)
        if lit:
            emit = flicker * (1.4 * np.exp(-((v - fv) / .3) ** 2) * (.35 + .65 * nz) + .5 * np.clip(v - .6, 0, 1))
            core = 6 * flicker * np.exp(-(u / .16) ** 2 - ((v - fv - .04) / .12) ** 2)
            foot = 1.6 * flicker * np.exp(-(u / .35) ** 2 - ((v - .07) / .07) ** 2)
            glow_x.append(x0)
            lights.append((x0, base - h * fv, size, depth, glass))
        else:
            emit = core = foot = 0 * u
        rim = np.exp(-((1 - np.abs(u)) / .07)) * (.25 + .8 * emit)
        rgb = glass * (emit + foot + rim * .6)[..., None] + np.array([1, .92, .75]) * core[..., None] * glass ** .25
        # a soft reflection of the room on the glass, and the thick base
        rgb += np.array([.03, .02, .015]) * np.exp(-((u + .55) / .12) ** 2)[..., None]
        rgb = np.where((v < .1)[..., None], rgb * .7, rgb)
        mouth = (np.abs(u) < 1) & (np.abs(v - 1) < .1 * np.sqrt(np.clip(1 - u ** 2, 0, 1)) + .002)
        rgb = np.where((mouth & (v > 1))[..., None], glass * (emit.max() * .9 if lit else .02), rgb)
        cover = (inside | (mouth & (v > 1))).astype(np.float32)
        edge = np.clip((1 - np.abs(u)) * w / 2, 0, 1) * np.clip(v * h, 0, 1)
        cover *= edge
        layer[..., :3] = layer[..., :3] * (1 - cover[..., None]) + rgb * cover[..., None]
        layer[..., 3] = np.maximum(layer[..., 3], cover)
    # the rail catches the light of the cups above it
    lit_rail = np.zeros(W, np.float32)
    for gx in glow_x:
        lit_rail += np.exp(-((np.arange(W) - gx) / (w * .9)) ** 2)
    rail_rgb = rail_rgb * (.15 + 1.6 * lit_rail[None, :, None]) + np.array([1, .8, .5]) * (np.clip(lit_rail, 0, 1)[None, :, None] * (t < .25)[..., None] * .5)
    behind = rail & (layer[..., 3] < .5)
    layer[..., :3] = np.where(behind[..., None], rail_rgb, layer[..., :3])
    layer[..., 3] = np.where(behind, 1, layer[..., 3])
    # the dark under the rail, down to the next row
    under = (Y >= rail_top + rail_h) & (Y < rail_top + rail_h + size * .5)
    layer[..., :3] = np.where((under & (layer[..., 3] < .5))[..., None], np.array([.004, .003, .002]), layer[..., :3])
    layer[..., 3] = np.where(under & (layer[..., 3] < .5), 1, layer[..., 3])
    blur = abs(1 / focus - 1 / depth) * 160
    soft = defocus(layer, blur)
    image = image * (1 - soft[..., 3:4]) + soft[..., :3]

# the warm light of all of them on the air, and the bloom of each flame
haze = np.zeros((H, W), np.float32)
for x0, y0, size, depth, glass in lights:
    haze += np.exp(-(((X - x0) / (size * 2.2)) ** 2 + ((Y - y0) / (size * 2.4)) ** 2)) * .012
image += haze[..., None] * np.array([1, .45, .2])
hot = np.clip(image - .7, 0, None)
image += ndi.gaussian_filter(hot, (6, 6, 0)) * .5 + ndi.gaussian_filter(hot, (26, 26, 0)) * .35 + ndi.gaussian_filter(hot, (80, 80, 0)) * .25
# a smoke thread rising in the dark above
smoke = np.zeros((H, W), np.float32)
path_x = W * .58 + np.cumsum(rng.normal(0, 1.1, H))[::-1] * .8 + 18 * np.sin(np.arange(H) / 70)
for yy in range(int(H * .05), int(H * .44)):
    xx = int(path_x[yy])
    if 0 <= xx < W:
        smoke[yy, xx] = (yy - H * .05) / (H * .39)
smoke = ndi.gaussian_filter(smoke, (2, 3)) * 2.2
image += smoke[..., None] * np.array([.05, .04, .035])
vignette = 1 - .5 * np.clip(np.hypot((X - W / 2) / W, (Y - H * .55) / H) * 1.5, 0, 1) ** 2
image *= vignette[..., None]
srgb = to_srgb(filmic(image * 1.1)) + rng.normal(0, .008, image.shape)
out.mkdir(parents=True, exist_ok=True)
path = out / 'votives.webp'
Image.fromarray((np.clip(srgb, 0, 1) * 255 + .5).astype(np.uint8), 'RGB').resize((800, 1180), Image.LANCZOS).save(path, quality=84, method=6)
print(path, path.stat().st_size // 1024, 'KB')
