#!/usr/bin/env python3
"""Renders the signs of the Church's seasons in the sanctuary (assets/liturgy.js decides which
shows):

  star.webp         the star of the Birth and the Epiphany: a white heart, a warm halo, and the
                    long and short spikes that bright light throws
  cross-light.webp  the cross of light the window throws on the wall in the Season of the Cross,
                    soft at its edges, with the colours of the glass at its fringe
  veil.webp         the violet veil of Lent and Passion Week: a silk swag in folds with a gold
                    galloon, a fringe, and two tassels at the middle
  paschal.webp      the paschal candle of the Resurrection on its brass stand, with the red cross
                    and the five grains of incense (the page writes the Alpha, the Omega and the
                    year on it)

  python3 docs/tools/render_seasons.py assets/images/sanctuary

Needs numpy, scipy and Pillow."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/seasons')
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1225)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def save(rgb, alpha, name, size, quality=88):
    rgba = np.concatenate([to_srgb(rgb), np.clip(alpha, 0, 1)[..., None]], -1)
    path = out / name
    Image.fromarray((rgba * 255 + .5).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS).save(path, quality=quality, method=6)
    print(path, size, path.stat().st_size // 1024, 'KB')


def light(rgb, name, size):
    """A picture of light: its alpha is its brightness, so it lays over the dark as light does."""
    lum = rgb.max(-1)
    alpha = np.clip(lum, 0, 1)
    save(rgb / np.maximum(lum, 1e-4)[..., None] * (np.clip(lum, 0, 1) / np.maximum(alpha, 1e-4))[..., None], alpha, name, size)


# ---------------------------------------------------------------- the star
N = 1024
y, x = (np.mgrid[0:N, 0:N].astype(np.float32) - N / 2) / (N / 2)
r = np.hypot(x, y)
heart = np.exp(-(r / .025) ** 2) * 6
halo = 1 / (1 + (r / .05) ** 2) ** 1.4 * .9 + np.exp(-(r / .3) ** 2) * .12


def spike(along, across, length, width, k):
    return k * np.exp(-np.abs(along) / length) * np.exp(-(across / (width * (1 + 6 * np.abs(along)))) ** 2)


d1, d2 = (x + y) / np.sqrt(2), (x - y) / np.sqrt(2)
spikes = sum(spike(a, b, .26, .0045, 1.1) for a, b in ((x, y), (y, x))) + sum(spike(a, b, .1, .004, .45) for a, b in ((d1, d2), (d2, d1)))
glint = np.stack([spikes * 1.0, spikes * .93, spikes * .78], -1)
star = np.stack([heart + halo, heart + halo * .86, heart + halo * .6], -1) + glint
light(np.clip(star, 0, None) * (1 - smooth(.8, 1, r))[..., None], 'star.webp', (512, 512))

# ---------------------------------------------------------------- the cross of light
CW, CH = 360, 600
y, x = np.mgrid[0:CH, 0:CW].astype(np.float32)
u, v = x / CW, y / CH
cross = ((np.abs(u - .5) < .12) & (v > .06) & (v < .94)) | ((np.abs(v - .29) < .075) & (u > .06) & (u < .94))
inside = ndi.distance_transform_edt(cross) - ndi.distance_transform_edt(~cross)
pen = 6 + 10 * v                           # the shadow's edge softens with distance from the window
core = smooth(-pen, pen, inside)
fringe_r = smooth(-pen * 1.4, pen * .4, inside + 3) - core
fringe_b = smooth(-pen * 1.4, pen * .4, inside - 3)
fringe_b = np.clip(fringe_b - core, 0, 1)
glow = ndi.gaussian_filter(cross.astype(np.float32), 26) * .35
mottle = ndi.gaussian_filter(rng.standard_normal((CH, CW)), 18)
mottle = 1 + .05 * mottle / mottle.std()
rgb = (np.array([1, .92, .76]) * (core * .82 * mottle * (1 - .2 * v))[..., None] + np.array([1, .45, .3]) * (fringe_r * .45)[..., None]
       + np.array([.4, .55, 1]) * (fringe_b * .3)[..., None] + np.array([1, .8, .55]) * glow[..., None])
light(rgb, 'cross-light.webp', (180, 300))

# ---------------------------------------------------------------- the Lenten veil
VW, VH = 2000, 900
y, x = np.mgrid[0:VH, 0:VW].astype(np.float32)
s = x / VW
arc = np.clip(np.sin(np.pi * np.clip((s - .04) / .92, 0, 1)), 0, 1)


def edge(depth, rise):
    """A swag's edge: hung at both ends, falling to its deepest at the middle."""
    return rise + depth * arc ** 1.5


top, bottom = edge(360, 40), edge(470, 170)
t = (y - top) / np.maximum(bottom - top, 1)
cloth = (t > 0) & (t < 1) & (s > .04) & (s < .96)
# four soft folds follow the drape and gather toward the ends where it is hung
folds = np.sin(t * np.pi * 4 + .6 * np.sin(s * 7))
height = ndi.gaussian_filter((folds * .6 + .4) * np.clip(np.sin(np.pi * np.clip(t, 0, 1)), 0, 1) ** .4 * 22, 3)
gy, gx = np.gradient(height)
n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
key = np.array([-.3, -.5, .81])
key /= np.linalg.norm(key)
below = np.array([0, .7, .71])
diff = np.clip(n @ key, 0, 1)
warm = np.clip(n @ below, 0, 1)
half = (key + [0, 0, 1]) / np.linalg.norm(key + [0, 0, 1])
sheen = np.clip(n @ half, 0, 1) ** 18
valley = .55 + .45 * (folds * .5 + .5)
silk = lin([.4, .2, .62])
rgb = silk * ((.1 + .7 * diff + .25 * warm) * valley)[..., None] + np.array([.85, .7, 1.0]) * (sheen * valley * .3)[..., None]
# the gold galloon along the hem, and the fringe below it
band = cloth & (t > .86)
gold = lin([.82, .62, .26]) * (.35 + .9 * diff)[..., None] * (1 + .14 * np.sin(x * .9 + y * .9))[..., None]
rgb = np.where(band[..., None], gold, rgb)
hem = bottom
fringe = (y > hem) & (y < hem + 40) & (s > .05) & (s < .95) & (np.sin(x * 1.1) > .1)
rgb = np.where(fringe[..., None], lin([.72, .53, .2]) * (.8 - .45 * ((y - hem) / 40))[..., None], rgb)
alpha = cloth | fringe
# two tassels at the middle, on their cords: a round head and a skirt of threads
for cx_, length in ((975, 70), (1028, 100)):
    base = float(edge(470, 170)[0, cx_]) + 30
    cord = (np.abs(x - cx_) < 4) & (y > base - 30) & (y < base + length)
    head = np.hypot((x - cx_) / 16, (y - base - length - 8) / 14) < 1
    skirt_y = (y - base - length - 18) / 80
    skirt = (skirt_y >= 0) & (skirt_y < 1) & (np.abs(x - cx_) < 12 + 12 * skirt_y)
    threads = .65 + .35 * np.sin((x - cx_) * 1.6) ** 2
    shade = np.clip(.45 + .55 * np.cos((x - cx_) / 26), 0, 1)
    rgb = np.where((cord | head)[..., None], lin([.8, .6, .24]) * shade[..., None], rgb)
    rgb = np.where(skirt[..., None], lin([.78, .58, .22]) * (shade * threads * (1 - .35 * skirt_y))[..., None], rgb)
    alpha = alpha | cord | head | skirt
alpha = ndi.gaussian_filter(alpha.astype(np.float32), .8)
save(rgb, alpha, 'veil.webp', (1000, 450))

# ---------------------------------------------------------------- the paschal candle
PW, PH = 320, 1800
y, x = np.mgrid[0:PH, 0:PW].astype(np.float32)
cx = PW / 2
# the candle, from 0 to 1250; the brass stand below it
cw = 92
su = (x - cx) / cw
on_candle = (np.abs(su) < 1) & (y > 20) & (y < 1250)
nz = np.sqrt(np.clip(1 - su ** 2, 0, 1))
wax = lin([.95, .9, .78]) * (.25 + .7 * np.clip(-.45 * su + .82 * nz, 0, 1) + .2 * (1 - nz) ** 2)[..., None]
wax *= (1 + .02 * ndi.gaussian_filter1d(rng.standard_normal(PW), 2))[None, :, None]
# the cross in red wax, raised a little, and the five grains of incense set in it
red = lin([.66, .08, .07])
cross_c = (np.abs(su) < .1) & (y > 330) & (y < 830) | (np.abs(y - 500) < 22) & (np.abs(su) < .62)
paint = red * (.35 + .75 * np.clip(-.45 * su + .82 * nz, 0, 1))[..., None]
wax = np.where((cross_c & on_candle)[..., None], paint, wax)
for gx, gy in ((0, 500), (0, 360), (0, 800), (-.5, 500), (.5, 500)):
    gr = np.hypot(su - gx, (y - gy) / cw)
    grain = gr < .085
    shine = np.clip(1 - gr / .085, 0, 1) ** 2
    wax = np.where(grain[..., None], lin([.5, .12, .05]) * (.6 + 1.6 * shine)[..., None], wax)
# its top: a hollow round the wick
rim = (y > 20) & (y < 40)
wax = np.where((rim & on_candle)[..., None], wax * .8, wax)
wick = (np.abs(x - cx) < 2.5) & (y > 0) & (y <= 24)
# the stand: a drip pan, a knop, a stem with rings, and a foot
prof = np.select(
    [y < 1270, y < 1300, y < 1360, y < 1640, y < 1700, y < 1800],
    [150 - (y - 1250) * 2, 40 + 0 * y, 40 + 30 * np.sin(np.pi * (y - 1300) / 60), 26 + 6 * (np.abs(((y - 1360) % 70) - 35) < 6), 26 + (y - 1640) * 1.8, 135 + 0 * y], 0)
on_stand = (y >= 1250) & (np.abs(x - cx) < prof)
pu = np.clip((x - cx) / np.maximum(prof, 1), -1, 1)
pnz = np.sqrt(np.clip(1 - pu ** 2, 0, 1))
brass = lin([.82, .6, .26]) * (.2 + .8 * np.clip(-.4 * pu + .85 * pnz, 0, 1))[..., None] + (np.clip(-.4 * pu + .85 * pnz, 0, 1) ** 30 * .6)[..., None]
rgb = np.where(on_candle[..., None], wax, 0)
rgb = np.where(on_stand[..., None], brass, rgb)
rgb = np.where(wick[..., None], .02, rgb)
alpha = (on_candle | on_stand | wick).astype(np.float32)
alpha = ndi.gaussian_filter(alpha, .7)
save(rgb, alpha, 'paschal.webp', (160, 900))
