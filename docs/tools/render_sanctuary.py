#!/usr/bin/env python3
"""Renders the sanctuary window as a picture: antique glass with the daylight behind it, painted
and leaded as a glazier would, the carved stone of the tracery, the coursed masonry around the
openings, the sill, all lit by the candles below and by the glass itself, with the bloom of the
light. It reads the layers docs/tools/sanctuary_layers.mjs draws from the window's design:

  node docs/tools/sanctuary_layers.mjs /tmp/sanctuary 2 window:deep:cedar:chalice
  python3 docs/tools/render_sanctuary.py /tmp/sanctuary/window assets/images/sanctuary/window 1080,1620

which writes window-1080.webp and window-1620.webp. Needs numpy, scipy and Pillow. Everything
random is seeded, so the same layers always give the same picture."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sanctuary/window')
stem = Path(sys.argv[2] if len(sys.argv) > 2 else src / 'window')
widths = [int(w) for w in (sys.argv[3] if len(sys.argv) > 3 else '1080').split(',')]
meta = json.loads((src / 'window.json').read_text())
S, W, H = meta['scale'], meta['width'], meta['height']
rng = np.random.default_rng(1300)
WARM = np.array([1, .74, .48], np.float32)  # candlelight


def layer(name):
    return np.asarray(Image.open(src / f'{name}.png').convert('RGBA'), dtype=np.float32) / 255


def lin(c):
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def filmic(x):
    """An ACES-like curve: deep colours stay deep and the brightest glass rolls off into white."""
    return np.clip(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0, 1)


def noise(beta, angle=0.0, stretch=1.0):
    """Seamless noise with a 1/f^beta spectrum, unit variance; stretch draws it into streaks along angle."""
    fy, fx = np.fft.fftfreq(H)[:, None], np.fft.rfftfreq(W)[None, :]
    c, s = np.cos(angle), np.sin(angle)
    f = np.hypot((fx * c + fy * s) * stretch, -fx * s + fy * c)
    f[0, 0] = 1
    amp = f ** (-beta / 2)
    amp[0, 0] = 0
    n = np.fft.irfft2(np.fft.rfft2(rng.standard_normal((H, W))) * amp, s=(H, W))
    return ((n - n.mean()) / n.std()).astype(np.float32)


def blur(a, sigma):
    if a.ndim == 3:
        return np.stack([ndi.gaussian_filter(a[..., i], sigma) for i in range(a.shape[2])], -1)
    return ndi.gaussian_filter(a, sigma)


def normals(height):
    gy, gx = np.gradient(height)
    n = np.stack([-gx, -gy, np.ones_like(height)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def unit(v):
    v = np.asarray(v, dtype=np.float32)
    return v / np.linalg.norm(v)


def ring_joints(r, a, inner, outer, step, offset=0.0):
    """Voussoirs turned around an opening: the zone between two radii, its joints and block numbers."""
    zone = (r > inner) & (r < outer)
    k = (np.degrees(a) - offset) / step
    gap = np.minimum(np.abs((k + .5) % 1 - .5) * np.radians(step) * r, np.abs(r - outer))
    return zone, gap, np.floor(k).astype(int)


glass, lead, tracery, stone, openings = (layer(n) for n in ('glass', 'lead', 'tracery', 'stone', 'openings'))
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
U, V = X / S - 40, Y / S  # window units, as in the drawing's viewBox

# ---------------------------------------------------------------- the parts
opening = openings[..., 3] > .5
ribs = tracery[..., 3] > .35
came = opening & (lead[..., :3].mean(-1) < .5) & (lead[..., 3] > .3) & ~ribs
# solder where the cames meet: a came is widest at a junction
inside = ndi.distance_transform_edt(came)
solder = ndi.binary_dilation(inside > 1.2 * np.percentile(inside[came], 90), iterations=int(1.6 * S)) & opening & ~ribs
came |= solder
pane = opening & ~came & ~ribs
labels, count = ndi.label(pane)
ids = np.arange(count + 1)

# ---------------------------------------------------------------- the glass
colour = lin(glass[..., :3])
top, low = glass[..., :3].max(-1), glass[..., :3].min(-1)
sat = (top - low) / np.maximum(top, 1e-3)
pale = (ndi.mean(sat, labels, ids) < .35) & (ndi.mean(top, labels, ids) > .7)
pale[0] = False
is_pale = pale[labels]

# each piece is its own sheet: thicker or thinner, warmer or cooler, streaked its own way,
# some of them full of seeds (bubbles); the pale quarries are rolled glass with a hammered face
angles = np.linspace(0, np.pi, 6, endpoint=False)
pick = rng.integers(0, len(angles), count + 1)[labels]
streak = np.zeros((H, W), np.float32)
for i, a in enumerate(angles):
    streak = np.where(pick == i, noise(3.0, a, 6.0), streak)
reams = noise(3.2)
density = np.exp(np.where(is_pale, .16, .3) * streak + .12 * reams + rng.normal(0, .1, count + 1)[labels] + np.where(is_pale, 0, .18))
tint = (1 + rng.normal(0, .045, (count + 1, 3)) * np.where(pale, 1.6, 1)[:, None])[labels]
transmit = np.clip(colour * tint, 1e-4, 1) ** density[..., None]
hammered = blur(noise(.4), 1.3 * S)
hammered /= hammered.std()
transmit *= (1 + .09 * hammered * is_pale)[..., None]
spots = np.zeros((H, W), np.float32)
n_seeds = int(W * H / (110 * S * S))
spots[rng.integers(0, H, n_seeds), rng.integers(0, W, n_seeds)] = rng.random(n_seeds) * 2 + .6
bubbles = blur(spots, .7 * S) - blur(spots, 1.5 * S)
seedy = (rng.random(count + 1) < .4)[labels]
transmit *= (1 + np.clip(bubbles / (bubbles.std() * 7), -.4, .8) * seedy)[..., None]

# the painter's matt, brushed on and wiped back from the middle so each piece glows from within
edge = ndi.distance_transform_edt(pane) / S
matt = 1 - np.where(is_pale, .42, .6) * (1 + .12 * noise(1.0)) * np.exp(-edge / 4.5)
matt *= 1 - .06 * np.clip(noise(1.5), 0, None)
transmit *= np.clip(matt, .05, 1)[..., None]

# a small quatrefoil on each pale quarry, in silver stain outlined in grisaille
centres = ndi.center_of_mass(pane, labels, ids[1:])
cy = np.array([0] + [c[0] for c in centres], np.float32)
cx = np.array([0] + [c[1] for c in centres], np.float32)
dx, dy = (X - cx[labels]) / S, (Y - cy[labels]) / S
r, t = np.hypot(dx, dy), np.arctan2(dy, dx)
petal = 5 + 4.2 * np.abs(np.cos(2 * t))
stain = np.array([1.0, .9, .62], np.float32)
transmit = np.where((is_pale & (r < petal))[..., None], transmit * stain, transmit)
paint = is_pale & ((np.abs(r - petal) < .45) | (r < 1.4))
transmit = np.where(paint[..., None], transmit * .45, transmit)

# dust gathers toward the foot of each light
dirt = 1 - .08 * np.clip(noise(2.6), -1, 2) - .12 * np.clip((V - 900) / 270, 0, 1)
transmit *= np.clip(dirt, .4, 1.1)[..., None]

# the daylight behind: brighter above and toward the sun, with a cloud passing over
sky = 1 + .3 * np.clip(1 - V / 1200, 0, 1) + .35 * np.exp(-(((U - 260) / 420) ** 2 + ((V - 260) / 380) ** 2))
sky *= 1 + .08 * noise(3.4)
glow = np.where(pane[..., None], transmit * (sky * np.where(is_pale, 1.0, 1.3))[..., None], 0).astype(np.float32)

# ---------------------------------------------------------------- lighting in the room
candle = unit([0, .55, .83])                      # the candles stand on the sill, below
reach = .05 + .95 * np.clip((V - 560) / 640, 0, 1) ** 2.2
view_half = unit(candle + np.array([0, 0, 1], np.float32))

# lead came: a rounded face that catches the candles and shines a little
came_h = blur(np.clip(ndi.distance_transform_edt(came) / (1.5 * S), 0, 1) ** .6 * 3 + solder * 1.2, .6 * S)
n = normals(came_h)
lead_rgb = (np.array([.03, .029, .03], np.float32) * (.25 + np.clip(n @ candle, 0, 1)[..., None] * reach[..., None])
            + (np.clip(n @ view_half, 0, 1) ** 30 * reach * .25)[..., None] * WARM)

# ---------------------------------------------------------------- the masonry
arch_r = np.hypot(U - 500, V - 500)
upper = V < 500
outer = np.where(upper, arch_r <= 490, (U >= 10) & (U <= 990)) & (V <= 1190)
plate = np.where(upper, arch_r <= 430, (U >= 70) & (U <= 930)) & (V <= 1190)
band = outer & ~plate
sill = (V > 1190) & (U >= -30) & (U <= 1030)
sill_top = sill & (V < 1236)
keystone = (V >= 18) & (V <= 74) & (np.abs(U - 500) <= 21 + (V - 18) * 7 / 56)

gap = np.full((H, W), 99, np.float32)
block = np.zeros((H, W), np.int64)
# the arch: voussoirs, a keystone, and the jambs below in courses of 78
zone, g, k = ring_joints(arch_r, np.arctan2(V - 500, U - 500) % (2 * np.pi), 430, 490, 7.5, 180)
zone &= upper & band
gap = np.where(zone, g, gap)
block = np.where(zone, 100 + k, block)
jamb = band & ~upper
gap = np.where(jamb, np.minimum(np.abs((V - 560 + 39) % 78 - 39), np.abs(V - 500)), gap)
block = np.where(jamb, 200 + np.floor((V - 482) / 78).astype(int) * 2 + (U > 500), block)
ks_edge = np.minimum(ndi.distance_transform_edt(keystone), ndi.distance_transform_edt(~keystone)) / S
gap = np.where(keystone, ks_edge, np.where(band & (np.abs(U - 500) < 50), np.minimum(gap, ks_edge), gap))
block = np.where(keystone, 199, block)
# the plate: coursed ashlar, each course's joints staggered
row = np.floor((V - 560) / 78).astype(int)
wall = plate & ~opening
for course in range(int(row.min()), int(row.max()) + 1):
    y0, y1 = max(0, int((560 + course * 78) * S)), min(H, int((560 + (course + 1) * 78) * S))
    if y0 >= y1:
        continue
    xs, x = [], -40 - rng.uniform(0, 200)
    while x < 1100:
        xs.append(x)
        x += rng.uniform(130, 240)
    xs = np.array(xs)
    u = U[0]
    j = np.clip(np.searchsorted(xs, u), 1, len(xs) - 1)
    d = np.minimum(np.abs(u - xs[j - 1]), np.abs(u - xs[j]))
    gap[y0:y1] = np.where(wall[y0:y1], np.minimum(d[None], np.abs((V[y0:y1] - 560 + 39) % 78 - 39)), gap[y0:y1])
    block[y0:y1] = np.where(wall[y0:y1], 1000 + course * 40 + j[None], block[y0:y1])
# voussoirs turned around the rose, the oculi and the heads of the lancets
for i, (cx_, cy_, inner, outer_r, step) in enumerate([(500, 330, 206, 252, 15), (185, 445, 48, 70, 45), (815, 445, 48, 70, 45)]):
    rr = np.hypot(U - cx_, V - cy_)
    zone, g, k = ring_joints(rr, np.arctan2(V - cy_, U - cx_) % (2 * np.pi), inner, outer_r, step, step / 2)
    zone &= wall
    gap, block = np.where(zone, g, gap), np.where(zone, 2000 + i * 100 + k, block)
for i, cx_ in enumerate((295, 705)):
    rr = np.hypot(U - cx_, V - 760)
    zone, g, k = ring_joints(rr, np.arctan2(V - 760, U - cx_) % (2 * np.pi), 175, 218, 18)
    zone &= wall & (V <= 760)
    gap, block = np.where(zone, g, gap), np.where(zone, 2400 + i * 100 + k, block)
gap = np.where(band | plate, np.minimum(gap, np.where(upper, np.abs(arch_r - 430), np.minimum(np.abs(U - 70), np.abs(U - 930)))), gap)
gap = np.where(sill, np.minimum(np.abs((U + 30 + 106) % 212 - 106), np.abs(V - 1190)), gap)
block = np.where(sill, 3000 + np.floor((U + 30) / 212).astype(int), block)
mortar = np.exp(-(gap / 1.4) ** 2)
arris = np.clip(gap / 4, 0, 1) ** .5  # the blocks' edges are worn round

# relief: the arch stands proud with a chamfer on its inner edge; the plate is splayed to the glass
from_glass = ndi.distance_transform_edt(~(opening | ribs)) / S
inner_e = np.where(upper, arch_r - 430, np.minimum(U - 70, 930 - U))
outer_e = np.where(upper, 490 - arch_r, np.minimum(U - 10, 990 - U))
relief = np.where(band, .6 + .4 * np.clip(inner_e / 14, 0, 1) - .3 * np.clip(1 - outer_e / 9, 0, 1) ** 2, 0)
relief = np.where(wall, .3 - .26 * np.exp(-from_glass / 8), relief)
relief = np.where(keystone, relief + .2, relief)
relief = np.where(sill, .9, relief)
rib_d = ndi.distance_transform_edt(ribs) / S
relief = np.where(ribs, .4 + .45 * np.clip(rib_d / 3, 0, 1) ** .7, relief)
relief = blur(relief, 1.1 * S)
grain, fine, pits = noise(2.5), noise(1.1), np.clip(noise(.5) - 2.4, 0, None)
bump = relief * 14 * S / 2 + (1.3 * arris - 1.1 * mortar + .45 * grain + .12 * fine - .5 * pits) * S / 2

# limestone: warm grey, each block its own tone, pitted, and darkened by the candles' smoke
key = block % 4096
tone = np.exp(rng.normal(0, .13, 4096))[key]
hue = (1 + rng.normal(0, .035, (4096, 3)))[key]
albedo = lin(np.array([.52, .45, .37], np.float32)) * hue * (tone * (1 + .15 * grain + .06 * fine) * (1 - .4 * np.clip(pits, 0, 1)))[..., None]
albedo *= (1 - .6 * mortar)[..., None]
albedo = np.where(ribs[..., None], albedo * .9, albedo)
albedo *= (1 - .3 * np.exp(-((U - 500) / 360) ** 2) * np.clip((V - 600) / 600, 0, 1) * np.clip(1 - (V - 1150) / 40, 0, 1))[..., None]

n = normals(bump)
lambert = np.clip(n @ candle, 0, 1)
ao = np.clip(1 - 1.4 * np.clip(blur(relief, 5 * S) - relief, 0, None) - .45 * mortar, .25, 1)
# the glass lights the stone near it, and most of all the splays cut toward it and the ribs' edges
splay = np.exp(-from_glass / 14)[..., None]
near = np.exp(-ndi.distance_transform_edt(~pane) / S / 3)[..., None]
spill = blur(glow, 5 * S) * .16 + blur(glow, 22 * S) * .09
light = (.03 + lambert * reach * .6)[..., None] * WARM + spill * (1 + 2.6 * splay) + blur(glow, 2 * S) * .5 * near * ribs[..., None]
# the sill: its top catches the candles; its front is in their shadow below a bright nosing
nose = np.exp(-((V - 1237) / 2.4) ** 2)
light = np.where(sill_top[..., None], light + (.42 - .3 * (V - 1190) / 46)[..., None] * WARM, light)
light = np.where((sill & ~sill_top)[..., None], light * .4 + (nose * .7 + .05)[..., None] * WARM, light)
stone_rgb = albedo * light * ao[..., None]

# ---------------------------------------------------------------- together, with the bloom
image = np.where(pane[..., None], glow, stone_rgb)
image = np.where(came[..., None], lead_rgb, image)
hot = np.clip(glow - .75, 0, None)
image += blur(hot, 2 * S) * .18 + blur(hot, 9 * S) * .2 + blur(hot, 30 * S) * .16
alpha = np.clip(stone[..., 3] + openings[..., 3], 0, 1)
srgb = to_srgb(filmic(image))
srgb += rng.normal(0, .01, srgb.shape).astype(np.float32) * alpha[..., None]
rgba = np.concatenate([np.clip(srgb, 0, 1), alpha[..., None]], -1)
picture = Image.fromarray((rgba * 255 + .5).astype(np.uint8), 'RGBA')
stem.parent.mkdir(parents=True, exist_ok=True)
for w in widths:
    path = stem.parent / f'{stem.name}-{w}.webp'
    picture.resize((w, round(w * H / W)), Image.LANCZOS).save(path, quality=84, method=6)
    print(path, path.stat().st_size // 1024, 'KB')
