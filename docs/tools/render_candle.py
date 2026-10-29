#!/usr/bin/env python3
"""Renders the sanctuary's candles: a flame (flame.webp: the blue at its root, the dark round the
wick, the white heart and the yellow and orange of its body, with its soft glow) and a wax taper
(taper.webp: an ivory beeswax candle, its melted rim and the drips run down from it), and the
brass tray they stand in (tray.webp).

  python3 docs/tools/render_candle.py assets/images/sanctuary

The taper is drawn tall; the site shows as much of it from the top as each candle is high.
Needs numpy, scipy and Pillow."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sanctuary')
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def save(rgb, alpha, path, size):
    rgba = np.concatenate([to_srgb(rgb), np.clip(alpha, 0, 1)[..., None]], -1)
    Image.fromarray((rgba * 255 + .5).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS).save(path, quality=90, method=6)
    print(path, size, path.stat().st_size // 1024, 'KB')


# ---------------------------------------------------------------- the flame
# drawn 4x and brought down; u runs across (-1..1), v up from the root of the flame (0) to its tip (1)
FW, FH = 96 * 4, 240 * 4
y, x = np.mgrid[0:FH, 0:FW].astype(np.float32)
u = (x - FW / 2) / (FW / 2) * 1.0
v = 1 - y / FH
v = (v - .1) / .78             # room below for the glow, and above for the tip to fade


def width(v, scale=1.0, base=.3):
    round_ = .5 * np.sqrt(np.clip(1 - ((v - base) / base) ** 2, 0, 1))
    taper = .5 * np.clip(1 - (v - base) / (1 - base), 0, 1) ** 1.25
    return np.where(v < base, round_, taper) * scale


lean = .05 * np.sin(v * 2.6) * v            # a breath of air bends the tip a little
uu = u - lean
inside = width(v) - np.abs(uu)
body = smooth(-.04, .06, inside) * (v > -.03)
heart = smooth(-.02, .14, width(v + .04, .66, .28) - np.abs(uu)) * smooth(.05, .22, v)
white = smooth(0, .1, width(v - .04, .42, .3) - np.abs(uu)) * smooth(.12, .3, v)
dark = smooth(-.01, .05, width((v + .03) * 2.6, .34, .3) - np.abs(uu)) * (v < .22)
rim = smooth(.09, .0, inside) * body * smooth(.26, .03, v)
tip = smooth(.45, 1.0, v)

light = (np.array([1.0, .6, .2]) * (body * (1.9 - 1.3 * tip))[..., None]
         + np.array([1.0, .84, .5]) * (heart * 2.4)[..., None]
         + np.array([1.0, .97, .9]) * (white * 3.4)[..., None])
light *= (1 - .5 * dark)[..., None]
light = light * (1 - rim)[..., None] + np.array([.22, .38, 1.0]) * (rim * .75)[..., None]
glow = ndi.gaussian_filter(body * (1 - .6 * tip), 24) * .5 + ndi.gaussian_filter(body, 56) * .3
light += np.array([1.0, .6, .24]) * glow[..., None]
lum = light.max(-1)
alpha = np.clip(lum * 1.1, 0, 1)
straight = light / np.maximum(lum, 1e-4)[..., None] * (np.clip(lum, 0, 1) / np.maximum(alpha, 1e-4))[..., None]
save(straight, alpha, out / 'flame.webp', (96, 240))

# ---------------------------------------------------------------- the taper
# ivory beeswax, lit softly from the front and from the flames along the sill
TW, TH = 48 * 4, 720 * 4
y, x = np.mgrid[0:TH, 0:TW].astype(np.float32)
s = (x + .5) / TW * 2 - 1                    # across the candle, -1..1
nz = np.sqrt(np.clip(1 - s * s, 0, 1))
streaks = ndi.gaussian_filter(rng.standard_normal((TH // 16, TW)), (6, 1.4))
streaks = np.repeat(streaks, 16, 0)[:TH] / streaks.std()
wax = np.array([.93, .8, .55]) * (1 + .015 * streaks)[..., None]

# the drips: runs of wax from the rim, each with a rounded end and its own shine
height = np.zeros((TH, TW), np.float32)
for cx, length, w in ((-.62, .09, .22), (.48, .17, .18), (.02, .05, .24), (.78, .065, .16)):
    centre = cx + .03 * np.sin(y / TH * 60 + cx * 7)
    reach = length * TH + 30 * 4
    run = smooth(w, w * .35, np.abs(s - centre)) * smooth(reach, reach - w * TW * .5, y)
    height = np.maximum(height, run)
rim = smooth(TW * .55, TW * .02, y) * (.5 + .5 * nz)
height = np.maximum(height, rim)
gy, gx = np.gradient(ndi.gaussian_filter(height, 5) * 9)
n = np.stack([s * 1.0 - gx, -gy, nz], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
key_dir = np.array([-.5, -.3, .81])
key = np.clip(n @ key_dir, 0, 1)
through = np.clip(1 - nz, 0, 1) ** 1.5                                 # light glows through the thin edges
half = (key_dir + [0, 0, 1]) / np.linalg.norm(key_dir + [0, 0, 1])
shine = np.clip(n @ half, 0, 1) ** 36
rgb = wax * (.12 + .78 * key)[..., None] + np.array([1, .55, .2]) * (through * .32)[..., None] + (shine * .4)[..., None]
# the melted rim: a shallow hollow round the wick, darker within
cup = smooth(TW * .3, 0, y) * smooth(.75, .2, np.abs(s))
rgb *= (1 - .3 * cup)[..., None]
alpha = smooth(1.0, .96, np.abs(s)) * smooth(0, 6, y)
save(rgb, alpha, out / 'taper.webp', (48, 720))

# ---------------------------------------------------------------- the brass tray
# the candles stand in a long brass tray: a rolled lip catching the light, brushed and a little
# tarnished; the site adds the glints of the lit candles over it
BW, BH = 1600, 48
y, x = np.mgrid[0:BH, 0:BW].astype(np.float32)
t = y / BH
profile = np.where(t < .34, np.sqrt(np.clip(1 - ((t - .17) / .17) ** 2, 0, 1)) * .9, .55 + .25 * (1 - t))
ny = np.gradient(ndi.gaussian_filter(profile, 1.2), axis=0) * -14
n = np.stack([np.zeros_like(ny), ny, np.ones_like(ny)], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
brushed = ndi.gaussian_filter(rng.standard_normal((BH, BW)), (.6, 40))
brushed /= brushed.std()
tarnish = ndi.gaussian_filter(rng.standard_normal((BH // 4, BW // 4)), 6)
tarnish = np.repeat(np.repeat(tarnish / tarnish.std(), 4, 0), 4, 1)[:BH, :BW]
brass = np.array([.86, .6, .24]) * (1 + .05 * brushed - .1 * np.clip(tarnish, 0, None))[..., None]
unit_dir = np.array([0, -.6, .8])
key = np.clip(n @ unit_dir, 0, 1)
spec = np.clip(n @ (unit_dir + [0, 0, 1]) / np.linalg.norm(unit_dir + [0, 0, 1]), 0, 1) ** 24
shade = np.where(t < .34, 1.0, .42 - .25 * (t - .34) / .66)
rgb = brass * ((.16 + .95 * key) * shade)[..., None] + np.array([1, .86, .6]) * ((spec * (.55 + .08 * brushed)) * shade)[..., None]
rgb *= (1 - .55 * smooth(.9, 1, t))[..., None]
save(rgb, smooth(0, .04, t) * smooth(1, .92, t), out / 'tray.webp', (BW // 2, BH // 2))

# ---------------------------------------------------------------- the sanctuary lamp
# brass chains from the vault, three short chains to the rim, a cup of ruby glass lit from within
# and a brass finial; drawn in the units of the page's lamp (60 by 380) at four times
K = 4
LW, LH = 60 * K, 380 * K
y, x = np.mgrid[0:LH, 0:LW].astype(np.float32) / K
rgb = np.zeros((LH, LW, 3))
alpha = np.zeros((LH, LW))
brass_c = np.array([.8, .5, .14])


def metal(nx, ny, strength=1.0):
    """Polished brass for a surface facing (nx, ny, nz): the lamp's glow below, a cool light above."""
    nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 0, 1))
    key = np.clip(-.35 * nx - .45 * ny + .82 * nz, 0, 1)
    spec = np.clip(-.2 * nx - .3 * ny + .93 * nz, 0, 1) ** 40
    return brass_c * (.06 + .85 * key ** 1.4)[..., None] * strength + np.array([1, .86, .6]) * (spec * .9)[..., None]


def paint(mask, colour, cover=None):
    global rgb, alpha
    a = mask.astype(np.float32) if cover is None else cover
    rgb = rgb * (1 - a[..., None]) + colour * a[..., None]
    alpha = np.maximum(alpha, a)


def link(cx, cy, rx, ry, tube, face):
    """One chain link: a ring seen face-on, or edge-on as a bar."""
    if face:
        d = np.hypot((x - cx) / rx, (y - cy) / ry)
        across = (d - 1) * min(rx, ry) / tube
        ring = np.abs(across) < 1
        paint(ring, metal(across * (x - cx) / (rx * d + 1e-3) * .9, across * (y - cy) / (ry * d + 1e-3) * .9))
    else:
        across = (x - cx) / tube
        bar = (np.abs(across) < 1) & (np.abs(y - cy) < ry)
        paint(bar, metal(across * .9, np.zeros_like(across)))


for i in range(30):
    link(30, 4.5 + i * 9, 2.6, 5.2, .9, i % 2 == 0)
for tx in (12, 48, 30):
    for j in range(5):
        f = (j + .5) / 5
        link(30 + (tx - 30) * f, 270 + 34 * f, 1.8, 3.6, .7, j % 2 == 0)
# the rim: a brass band, a little wider at the top
band = (y >= 304) & (y < 312) & (np.abs(x - 30) < 22 - (y - 304) * .25)
paint(band, metal((x - 30) / 23 * .8, (y - 308) / 6))
# the ruby cup, glowing from the flame within
cup_half = np.where((y >= 312) & (y < 356), 17 * np.clip(1 - np.clip((y - 312) / 44, 0, 1) ** 2.2, 0, 1) ** .5, 0)
cup = (y >= 312) & (y < 356) & (np.abs(x - 30) < cup_half)
u = np.clip((x - 30) / np.maximum(cup_half, 1e-3), -1, 1)
glow_in = np.exp(-(((x - 30) / 9) ** 2 + ((y - 327) / 11) ** 2))
nz = np.sqrt(np.clip(1 - u ** 2, 0, 1))
ruby = np.array([.9, .05, .04]) * (.14 + 1.15 * glow_in * (.5 + .5 * nz) + .35 * np.exp(-((1 - np.abs(u)) / .12)))[..., None]
ruby += np.array([1, .55, .25]) * (glow_in ** 3 * .45)[..., None]
ruby += np.array([1, .85, .7]) * (np.exp(-((u + .55) / .07) ** 2) * np.clip((y - 316) / 30, 0, 1) * .35)[..., None]
paint(cup, ruby)
# the finial: a cone and a ball
cone = (y >= 356) & (y < 370) & (np.abs(x - 30) < 6 * (1 - (y - 356) / 14))
paint(cone, metal((x - 30) / 7 * .8, np.full_like(x, .2)))
ball_d = np.hypot(x - 30, y - 372) / 3.4
paint(ball_d < 1, metal(np.clip((x - 30) / 3.4, -1, 1) * .9, np.clip((y - 372) / 3.4, -1, 1) * .9))
alpha = ndi.gaussian_filter(alpha, .5)
save(np.clip(rgb, 0, None), alpha, out / 'lamp.webp', (120, 760))
