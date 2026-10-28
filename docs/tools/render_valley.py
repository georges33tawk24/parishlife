"""Render the homepage hero: a Lebanese mountain valley at blue hour and at dawn.

Everything is generated here: an eroded heightfield shaped like a gorge rising to a
snow-capped crest, a shaded colour map, a voxel-space renderer with fog and a depth
buffer, a sky with afterglow and stars, warm village windows with bloom, and depth
layers for parallax. Candidate places for the parish lights (which the page draws
itself, one per parish) are written next to the images.

Usage (numpy and pillow), about 25 minutes on four cores:
    python docs/tools/render_valley.py OUT_DIR [--size 2560x1440] [--portrait 1080x1920]
    python docs/tools/render_valley.py OUT_DIR --publish .     # copy into assets/
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

RNG = np.random.default_rng(1925)
N = 2048            # heightfield cells per side
CELL = 12.0         # metres per cell, so the world is ~24.6 km wide


# ---------------------------------------------------------------- utilities
def resize(a, shape, resample=Image.BICUBIC):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((shape[1], shape[0]), resample))


def blur(a, sigma):
    """Gaussian blur by FFT; edges wrap, which the terrain margins hide."""
    if sigma <= 0:
        return a
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    kernel = np.exp(-2 * (math.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * kernel)).astype(np.float32)


TABLE = np.random.default_rng(1925).random((256, 256)).astype(np.float32) * 2 - 1
ROT = np.array([[0.8, -0.6], [0.6, 0.8]], np.float32)


def vnoise(x, y):
    """Value noise with quintic smoothing; returns the value and its two derivatives."""
    ix = np.floor(x)
    iy = np.floor(y)
    fx = x - ix
    fy = y - iy
    ix = ix.astype(np.int64) & 255
    iy = iy.astype(np.int64) & 255
    u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    du = 30 * fx * fx * (fx * (fx - 2) + 1)
    dv = 30 * fy * fy * (fy * (fy - 2) + 1)
    a = TABLE[iy, ix]
    b = TABLE[iy, (ix + 1) & 255]
    c = TABLE[(iy + 1) & 255, ix]
    d = TABLE[(iy + 1) & 255, (ix + 1) & 255]
    k1, k2, k4 = b - a, c - a, a - b - c + d
    return a + k1 * u + k2 * v + k4 * u * v, du * (k1 + k4 * v), dv * (k2 + k4 * u)


ANGLES = np.random.default_rng(77).random((256, 256)).astype(np.float32) * 2 * math.pi
GX, GY = np.cos(ANGLES), np.sin(ANGLES)


def pnoise(x, y):
    """Gradient (Perlin) noise, about [-1, 1]."""
    ix = np.floor(x)
    iy = np.floor(y)
    fx = x - ix
    fy = y - iy
    ix = ix.astype(np.int64) & 255
    iy = iy.astype(np.int64) & 255
    ix1, iy1 = (ix + 1) & 255, (iy + 1) & 255
    n00 = GX[iy, ix] * fx + GY[iy, ix] * fy
    n10 = GX[iy, ix1] * (fx - 1) + GY[iy, ix1] * fy
    n01 = GX[iy1, ix] * fx + GY[iy1, ix] * (fy - 1)
    n11 = GX[iy1, ix1] * (fx - 1) + GY[iy1, ix1] * (fy - 1)
    u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    return 1.41 * ((n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v)


def ridged(x, y, octaves, gain=2.0, offset=1.0):
    """Musgrave's ridged multifractal: sharp crests, smoother valleys."""
    total = np.zeros_like(x)
    weight = np.ones_like(x)
    amp, norm = 1.0, 0.0
    for _ in range(octaves):
        signal = (offset - np.abs(pnoise(x, y))) ** 2 * weight
        weight = np.clip(signal * gain, 0, 1)
        total += signal * amp
        norm += amp
        amp *= 0.5
        x, y = 2 * (ROT[0, 0] * x + ROT[0, 1] * y), 2 * (ROT[1, 0] * x + ROT[1, 1] * y)
    return total / norm


def grid(shape=(N, N)):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32)
    return xx / shape[1], yy / shape[0]


def fbm(scale, octaves, gain=0.5, shape=(N, N), offset=0.0):
    """Plain fractal noise in about [-1, 1], each octave rotated to hide the lattice."""
    x, y = grid(shape)
    return fbm_at(x * scale + offset, y * scale + offset * 1.7, octaves, gain)


def fbm_at(x, y, octaves, gain=0.5):
    """fbm at given noise coordinates."""
    total, amp, norm = np.zeros(x.shape, np.float32), 1.0, 0.0
    for _ in range(octaves):
        n, _, _ = vnoise(x, y)
        total += amp * n
        norm += amp
        amp *= gain
        x, y = 2 * (ROT[0, 0] * x + ROT[0, 1] * y), 2 * (ROT[1, 0] * x + ROT[1, 1] * y)
    return total / norm


def eroded(x, y, octaves):
    """Fractal noise damped by the accumulated slope: gullies and ridges like eroded rock."""
    total = np.zeros_like(x)
    dx = np.zeros_like(x)
    dy = np.zeros_like(x)
    amp = 1.0
    for _ in range(octaves):
        n, nx, ny = vnoise(x, y)
        dx += nx
        dy += ny
        total += amp * n / (1 + dx * dx + dy * dy)
        amp *= 0.5
        x, y = 2 * (ROT[0, 0] * x + ROT[0, 1] * y), 2 * (ROT[1, 0] * x + ROT[1, 1] * y)
    return total


def sample(a, x, y):
    """Bilinear sample of a 2-D array at fractional cell coordinates (clamped)."""
    h, w = a.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0 = x.astype(np.int32)
    y0 = y.astype(np.int32)
    fx = (x - x0)
    fy = (y - y0)
    if a.ndim == 3:
        fx = fx[..., None]
        fy = fy[..., None]
    return ((a[y0, x0] * (1 - fx) + a[y0, x0 + 1] * fx) * (1 - fy)
            + (a[y0 + 1, x0] * (1 - fx) + a[y0 + 1, x0 + 1] * fx) * fy)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- terrain
def terrain():
    xx, yy = grid()                                             # y grows away from the camera
    # The gorge winds north from the camera towards the high crest.
    axis = 0.5 + 0.05 * np.sin(yy * 6.5 + 0.8) + 0.03 * np.sin(yy * 15.0 + 2.1)
    dxv = np.abs(xx - axis)
    width = 0.05 + 0.10 * yy
    valley = 1 - np.exp(-(dxv / width) ** 2)                  # 0 on the floor, 1 on the shoulders
    rise = 300 + 1100 * smoothstep(0.0, 0.95, yy) ** 1.6      # land climbs towards the crest
    crest = 2100 * np.exp(-((yy - 0.80) / 0.09) ** 2)
    wx = fbm(2.5, 4) * 0.035
    wy = fbm(2.5, 4, offset=5.3) * 0.035
    px, py = (xx + wx) * 3.2 + 3.1, (yy + wy) * 3.2 + 7.7
    mountains = ridged(px, py, 8)                              # ~0..1, crests near 1
    detail = eroded(px * 2.3 + 1.7, py * 2.3 + 4.1, 7)
    relief = 0.25 + 0.75 * valley
    h = rise + crest * (0.25 + 0.75 * mountains ** 1.4) + 1900 * relief * (mountains - 0.3) + 160 * detail * relief
    return h.astype(np.float32)


# ---------------------------------------------------------------- materials and light
def normals(h):
    gy, gx = np.gradient(h, CELL)
    n = np.stack([-gx, -gy, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def shadow(h, light, steps=180):
    """1 where the sun reaches, 0 in shadow (marched on a half-resolution grid)."""
    m = N // 2
    hs = resize(h, (m, m))
    yy, xx = np.mgrid[0:m, 0:m].astype(np.float32)
    lx, ly, lz = light
    horiz = math.hypot(lx, ly)
    sx, sy = lx / horiz, ly / horiz
    slope = lz / horiz                                          # metres up per metre across
    lit = np.ones((m, m), np.float32)
    cell = CELL * 2
    dist = 0.0
    for s in range(steps):
        step = 1.0 + s * 0.08
        dist += step
        px = xx + sx * dist
        py = yy + sy * dist
        inside = (px >= 0) & (px < m - 1) & (py >= 0) & (py < m - 1)
        ray = hs + slope * dist * cell
        blocked = inside & (sample(hs, px, py) > ray + 2)
        lit = np.minimum(lit, np.where(blocked, 0.0, 1.0))
    lit = blur(lit, 1.2)
    return resize(lit, (N, N))


def colour_map(h, mood):
    n = normals(h)
    slope = 1 - n[..., 2]                                       # 0 flat, ~1 cliff
    ao = np.clip(1 - (blur(h, 6) - h) / 140, 0.35, 1.15) * np.clip(1 - (blur(h, 30) - h) / 900, 0.55, 1.1)
    jitter = fbm(90, 3, offset=1.1) * 0.5 + 0.5
    patches = fbm(16, 5, offset=2.2) * 0.5 + 0.5

    limestone = np.array([0.55, 0.52, 0.47])
    scrub = np.array([0.20, 0.22, 0.13])
    pine = np.array([0.06, 0.10, 0.07])
    earth = np.array([0.30, 0.24, 0.18])
    snow = np.array([0.93, 0.95, 1.0])

    rock = smoothstep(0.32, 0.62, slope + 0.15 * (jitter - 0.5))
    forest = smoothstep(0.55, 0.7, patches) * smoothstep(700, 1000, h) * (1 - smoothstep(1800, 2100, h)) * (1 - rock)
    _, gy = grid()
    snowline = 2250 + 260 * fbm(9, 5, offset=3.3) + 900 * (1 - smoothstep(0.35, 0.7, gy))
    gullies = fbm(70, 3, offset=3.9) * 0.5 + 0.5
    snowy = smoothstep(snowline - 120, snowline + 80, h + 140 * gullies) * (1 - smoothstep(0.42, 0.62, slope + 0.2 * (gullies - 0.5)))
    terraces = (0.96 + 0.04 * np.sin(h / 6.0)) * (1 - rock) + rock

    albedo = scrub[None, None] * (1 - rock)[..., None] + limestone[None, None] * rock[..., None]
    albedo = albedo * (0.75 + 0.5 * jitter)[..., None] * terraces[..., None]
    albedo = albedo * (1 - forest)[..., None] + pine[None, None] * forest[..., None]
    albedo = albedo * (1 - 0.35 * smoothstep(0.6, 0.8, patches) * (1 - rock))[..., None] + earth * 0.0
    albedo = albedo * (1 - snowy)[..., None] + snow[None, None] * snowy[..., None]

    villages = village_mask(h, slope)
    roofs = (fbm(600, 1, offset=4.4) > 0.25) & (villages > 0.4)
    houses = villages[..., None] * np.where(roofs[..., None], [0.36, 0.20, 0.15], [0.42, 0.39, 0.34])
    albedo = albedo * (1 - 0.7 * villages)[..., None] + houses * 0.7

    if mood == 'dusk':
        sun = np.array([-0.55, 0.75, 0.035])                    # just set behind the crest, north-west
        sun_col = np.array([1.0, 0.42, 0.40]) * 0.95
        sky_col = np.array([0.20, 0.30, 0.55]) * 0.75
        moon = np.array([0.6, -0.35, 0.45])
        moon_col = np.array([0.45, 0.55, 0.80]) * 0.45
    else:                                                       # dawn: low sun from the east
        sun = np.array([0.80, 0.28, 0.11])
        sun_col = np.array([1.0, 0.62, 0.36]) * 1.9
        sky_col = np.array([0.30, 0.42, 0.70]) * 0.42
        moon = None
    sun = sun / np.linalg.norm(sun)
    ndl = np.clip((n * sun).sum(-1), 0, 1)
    lit = shadow(h, sun)
    if mood == 'dusk':
        # afterglow reaches only the high ground facing it
        lit = lit * smoothstep(1500, 2600, h)
    light = sky_col[None, None] * ((0.55 + 0.45 * n[..., 2]) * ao)[..., None]
    light = light + sun_col[None, None] * (ndl * lit)[..., None]
    if moon is not None:
        moon = moon / np.linalg.norm(moon)
        mdl = np.clip((n * moon).sum(-1), 0, 1)
        light = light + moon_col[None, None] * (mdl * shadow(h, moon, 120))[..., None]
    colour = albedo * light
    return colour.astype(np.float32), villages


def village_mask(h, slope):
    """Villages sit on gentle shoulders between 700 and 1700 m."""
    _, gy = grid()
    site = smoothstep(0.22, 0.02, slope) * smoothstep(450, 650, h) * (1 - smoothstep(1700, 1950, h)) * smoothstep(0.12, 0.2, gy)
    clusters = smoothstep(0.52, 0.66, fbm(18, 4, offset=5.5) * 0.5 + 0.5)
    speck = (fbm(380, 2, offset=6.6) * 0.5 + 0.5) > 0.5
    return (site * clusters * speck).astype(np.float32)


# ---------------------------------------------------------------- camera and renderer
class Camera:
    def __init__(self, x, y, height, yaw, fov, horizon, width, height_px):
        self.x, self.y, self.h, self.yaw = x, y, height, yaw
        self.fov, self.horizon, self.w, self.hpx = fov, horizon, width, height_px
        self.f = (width / 2) / math.tan(math.radians(fov) / 2)

    def ray(self, col):
        a = self.yaw + math.atan((col - self.w / 2) / self.f)
        return math.sin(a), math.cos(a), math.cos(a - self.yaw)


def render(h, colour, cam, z_near=40.0, z_far=22000.0, steps=5200):
    """Voxel-space rendering, column by column, front to back. Returns rgb, depth, alpha."""
    W, H = cam.w, cam.hpx
    out = np.zeros((H, W, 3), np.float32)
    depth = np.full((H, W), np.inf, np.float32)
    zs = z_near * (z_far / z_near) ** (np.arange(steps, dtype=np.float32) / (steps - 1))
    rows = np.arange(H, dtype=np.float32)
    for col in range(W):
        sx, sy, corr = cam.ray(col)
        dist = zs / corr
        px = (cam.x + sx * dist) / CELL
        py = (cam.y + sy * dist) / CELL
        inside = (px >= 1) & (px < N - 2) & (py >= 1) & (py < N - 2)
        hh = sample(h, px, py)
        hh = np.where(inside, hh, -1e4)
        # earth curvature and refraction, so the far crest settles naturally
        hh = hh - zs * zs / (2 * 6371000) * 0.87
        top = cam.horizon + (cam.h - hh) * cam.f / zs
        reach = np.minimum.accumulate(top)                     # highest point drawn so far, per depth
        # row r shows the first depth whose reach climbs to r
        first = np.searchsorted(-reach, -rows, side='left')
        hit = first < steps
        idx = np.minimum(first, steps - 1)
        cx = px[idx]
        cy = py[idx]
        out[hit, col] = sample(colour, cx[hit], cy[hit])
        depth[hit, col] = zs[idx][hit]
    return out, depth


def view_noise(cam, fx, fy, octaves, offset):
    """Fractal noise tied to view angles (fx, fy cycles per radian), so a feature has the same
    shape in the wide and the tall frame. It is computed at a third of the resolution, fine
    enough for every octave, then smoothly enlarged."""
    H, W = cam.hpx, cam.w
    h3, w3 = max(2, H // 3), max(2, W // 3)
    u = ((np.arange(w3, dtype=np.float32) + 0.5) * W / w3 - W / 2) / cam.f
    v = ((np.arange(h3, dtype=np.float32) + 0.5) * H / h3 - cam.horizon) / cam.f
    x = np.broadcast_to(u[None, :] * fx + offset, (h3, w3))
    y = np.broadcast_to(v[:, None] * fy + offset * 1.7, (h3, w3))
    return resize(fbm_at(x, y, octaves), (H, W))


def sky(cam, mood):
    H, W = cam.hpx, cam.w
    v = (np.arange(H, dtype=np.float32)[:, None] - cam.horizon) / cam.f    # <0 above the horizon
    u = (np.arange(W, dtype=np.float32)[None, :] - W / 2) / cam.f
    elev = np.clip(-v, -0.2, 1.5)
    az = u + 0.0
    if mood == 'dusk':
        zenith = np.array([0.012, 0.024, 0.065])
        mid = np.array([0.05, 0.08, 0.20])
        low = np.array([0.36, 0.20, 0.24])
        glow_at = -0.35
    else:
        zenith = np.array([0.07, 0.14, 0.34])
        mid = np.array([0.30, 0.40, 0.64])
        low = np.array([1.0, 0.62, 0.40])
        glow_at = 0.75
    t = np.clip(elev / 0.55, 0, 1)[..., None]
    base = mid[None, None] * (1 - t) + zenith[None, None] * t
    glow = np.exp(-((az - glow_at) / 0.55) ** 2) * np.exp(-elev / 0.10)
    horizon_band = np.exp(-np.clip(elev, 0, None) / 0.05)
    col = base + low[None, None] * (0.55 * glow + 0.25 * horizon_band)[..., None]
    # thin stratus catching the light
    cloud_n = view_noise(cam, 5.6, 10.0, 5, 7.7)
    streak = view_noise(cam, 2.8, 5.0, 4, 8.8)
    band = np.exp(-((elev - 0.13) / 0.05) ** 2) + 0.6 * np.exp(-((elev - 0.24) / 0.035) ** 2)
    clouds = np.clip((cloud_n * 0.6 + streak * 0.8) * band, 0, 1)
    tint = np.array([0.55, 0.30, 0.32]) if mood == 'dusk' else np.array([1.0, 0.78, 0.66])
    col = col * (1 - 0.55 * clouds[..., None]) + tint[None, None] * clouds[..., None] * (0.35 + 0.65 * glow[..., None])
    if mood == 'dusk':
        stars = np.zeros((H, W), np.float32)
        count = int(W * H / 900)
        rng = np.random.default_rng(7)
        sx = rng.integers(0, W, count)
        sy = rng.integers(0, H, count)
        mag = rng.random(count) ** 6
        stars[sy, sx] = mag * 1.6
        stars = blur(stars, 0.6) * 3
        stars *= np.clip(elev / 0.35, 0, 1)
        col = col + stars[..., None] * np.array([0.85, 0.9, 1.0])
    return col.astype(np.float32)


def lights(h, villages, cam, depth, mood, count=4200):
    """Warm windows in the villages, occluded by the terrain; returns an emission buffer."""
    H, W = cam.hpx, cam.w
    emit = np.zeros((H, W, 3), np.float32)
    rng = np.random.default_rng(11)
    ys, xs = np.nonzero(villages > 0.35)
    pick = rng.choice(len(xs), size=min(count, len(xs)), replace=False)
    wx = (xs[pick] + rng.random(len(pick))) * CELL
    wy = (ys[pick] + rng.random(len(pick))) * CELL
    wh = h[ys[pick], xs[pick]] + 4
    slots = []
    for X, Y, Z in zip(wx, wy, wh):
        dx, dy = X - cam.x, Y - cam.y
        fwd = dx * math.sin(cam.yaw) + dy * math.cos(cam.yaw)
        side = dx * math.cos(cam.yaw) - dy * math.sin(cam.yaw)
        if fwd < 300:
            continue
        sxp = cam.w / 2 + side / fwd * cam.f
        z_adj = Z - fwd * fwd / (2 * 6371000) * 0.87
        syp = cam.horizon + (cam.h - z_adj) * cam.f / fwd
        ix, iy = int(sxp), int(syp)
        if not (0 <= ix < W and 0 <= iy < H):
            continue
        if depth[iy, ix] < fwd * 0.97:                           # hidden behind nearer ground
            continue
        strength = (0.5 + 1.4 * rng.random() ** 3) * (1.0 if mood == 'dusk' else 0.1) * min(1.0, 3500 / fwd) ** 0.6
        street = rng.random() < 0.12
        warm = np.array([1.0, 0.80, 0.55]) if street else np.array([1.0, 0.50 + 0.14 * rng.random(), 0.16 + 0.10 * rng.random()])
        emit[iy, ix] += warm * strength * (W / 1920) ** 2 * 2.2
        slots.append((sxp / W, syp / H, fwd))
    if mood == 'dusk':
        for X, Y in crosses(h):
            draw_cross(emit, h, cam, depth, X, Y)
    return emit, slots


def crosses(h):
    """Illuminated crosses stand on prominent tops above villages, as in many Lebanese towns."""
    picks = []
    for gx, gy in ((0.36, 0.30), (0.66, 0.42), (0.44, 0.55)):
        x0, y0 = int(gx * N), int(gy * N)
        win = h[y0 - 60:y0 + 60, x0 - 60:x0 + 60]
        iy, ix = np.unravel_index(np.argmax(win), win.shape)
        picks.append(((x0 - 60 + ix) * CELL, (y0 - 60 + iy) * CELL))
    return picks


def draw_cross(emit, h, cam, depth, X, Y, size=70.0):
    H, W = emit.shape[:2]
    Z = float(sample(h, np.array(X / CELL), np.array(Y / CELL)))
    dx, dy = X - cam.x, Y - cam.y
    fwd = dx * math.sin(cam.yaw) + dy * math.cos(cam.yaw)
    side = dx * math.cos(cam.yaw) - dy * math.sin(cam.yaw)
    if fwd < 500:
        return
    scale = cam.f / fwd
    cx = cam.w / 2 + side * scale
    base = cam.horizon + (cam.h - (Z - fwd * fwd / (2 * 6371000) * 0.87)) * scale
    ix = int(cx)
    if not (0 <= ix < W and 0 <= int(base) < H) or depth[min(H - 1, int(base) + 1), ix] < fwd * 0.97:
        return
    tall, arm = size * scale, size * 0.62 * scale
    thick = max(1.0, 3.2 * scale)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    stem = (np.abs(xx - cx) <= thick / 2) & (yy <= base) & (yy >= base - tall)
    bar_y = base - tall * 0.72
    bar = (np.abs(yy - bar_y) <= thick / 2) & (np.abs(xx - cx) <= arm / 2)
    mask = (stem | bar).astype(np.float32)
    emit += mask[..., None] * np.array([1.0, 0.93, 0.80]) * 0.75


def tonemap(c):
    a, b, cc, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((c * (a * c + b)) / (c * (cc * c + d) + e), 0, 1)


def ground(rgb, emit, depth, cam, mood, all_depth=None):
    """Linear colour of terrain pixels: air, night darkness near the camera, valley mist, window glow."""
    H, W = cam.hpx, cam.w
    d = np.nan_to_num(depth, posinf=1e9)
    air = np.array([0.075, 0.105, 0.21]) if mood == 'dusk' else np.array([0.50, 0.55, 0.70])
    fog = (1 - np.exp(-d / (8500 if mood == 'dusk' else 20000))) * 0.92
    if mood == 'dusk':
        rgb = rgb * (0.5 + 0.5 * smoothstep(1200, 9000, d))[..., None]
    rgb = rgb * (1 - fog[..., None]) + air[None, None] * fog[..., None] * 0.9
    v = (np.arange(H, dtype=np.float32)[:, None] - cam.horizon) / H
    mist = np.exp(-((v - 0.08) / 0.07) ** 2) * (0.6 + 0.4 * view_noise(cam, 4.7, 8.4, 4, 9.9))
    mist = mist * smoothstep(1500, 6000, d) * (d < 1e8)
    mist_col = np.array([0.20, 0.25, 0.40]) if mood == 'dusk' else np.array([0.92, 0.84, 0.80])
    rgb = rgb * (1 - 0.5 * mist[..., None]) + mist_col[None, None] * 0.5 * mist[..., None]
    wide = np.zeros_like(rgb)
    if emit is not None:
        k = W / 1920
        if mood == 'dusk':
            # the halo sits in the air over every layer, so its mist follows the nearest ground of any layer
            da = np.nan_to_num(all_depth if all_depth is not None else depth, posinf=1e9)
            air_mist = np.exp(-((v - 0.08) / 0.07) ** 2) * smoothstep(1500, 6000, da) * (da < 1e8)
            air_mist = blur(air_mist, 6 * k)
            glow = np.stack([blur(emit[..., ch], 70 * k) for ch in range(3)], -1)
            # emit holds k^2 energy per light and the blur spreads it over k^2 pixels, so no k here
            wide = wide + glow * (0.5 + 2.0 * air_mist[..., None]) * 26
        e = np.stack([blur(emit[..., ch], 0.65 * k) for ch in range(3)], -1) * 2.6
        for s_, wgt in ((1.6 * k, 0.9), (5 * k, 0.45), (16 * k, 0.22), (48 * k, 0.12)):
            for ch in range(3):
                b = blur(e[..., ch], s_) * wgt * (s_ * s_ * 2 * math.pi) ** 0.5 / (1 + s_)
                if s_ > 10 * k:
                    wide[..., ch] += b                         # soft halo: drawn above every layer
                else:
                    rgb[..., ch] += b
        rgb = rgb + e * 1.4
    return rgb, wide


def post(rgb, cam, mood, seed=3):
    """Exposure, tone mapping, grade, vignette and grain, the same for every layer."""
    H, W = cam.hpx, cam.w
    out = tonemap(rgb * (1.65 if mood == 'dusk' else 0.92))
    lum = out.mean(-1, keepdims=True)
    out = out + (1 - lum) ** 3 * np.array([0.0, 0.006, 0.03]) - lum ** 2 * np.array([0.0, 0.01, 0.03]) * 0.5
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx - W / 2) / W, (yy - H * 0.55) / H)
    out = out * (1 - 0.35 * smoothstep(0.35, 0.85, r))[..., None]
    out = out + np.random.default_rng(seed).normal(0, 0.008, out.shape)
    return np.clip(out, 0, 1)


def downsample(rgb, alpha, f):
    """Average f x f blocks with premultiplied alpha."""
    H, W = alpha.shape
    h2, w2 = H // f, W // f
    a = alpha[:h2 * f, :w2 * f].reshape(h2, f, w2, f).mean((1, 3))
    c = (rgb[:h2 * f, :w2 * f] * alpha[:h2 * f, :w2 * f, None]).reshape(h2, f, w2, f, 3).mean((1, 3))
    return np.where(a[..., None] > 1e-4, c / np.maximum(a[..., None], 1e-4), 0), a


def make_camera(h, w, hgt, portrait=False):
    yc = 0.035 * N if not portrait else 0.02 * N
    xc = (0.5 + 0.05 * math.sin(0.035 * 6.5 + 0.8) + 0.03 * math.sin(0.035 * 15.0 + 2.1)) * N
    ground = float(h[int(yc), int(xc)])
    return Camera(xc * CELL, yc * CELL, ground + (1150 if not portrait else 1250), yaw=math.radians(-14 if not portrait else -2),
                  fov=56 if not portrait else 33, horizon=hgt * (0.44 if not portrait else 0.47), width=w, height_px=hgt)


Z_SPLIT = 14000.0


def layers(h, colour, villages, cam, mood, ss=2):
    """Sky, far crest and valley as separate images, each complete behind the next."""
    big = Camera(cam.x, cam.y, cam.h, cam.yaw, cam.fov, cam.horizon * ss, cam.w * ss, cam.hpx * ss)
    far_rgb, far_depth = render(h, colour, big, z_near=Z_SPLIT, z_far=26000.0, steps=1800)
    near_rgb, near_depth = render(h, colour, big, z_near=40.0, z_far=Z_SPLIT, steps=4600)
    nearest = np.minimum(near_depth, far_depth)
    emit, found = lights(h, villages, big, nearest, mood)
    sky_lin = sky(big, mood)
    sky_img = post(sky_lin, big, mood, seed=1)
    far_alpha = np.isfinite(far_depth).astype(np.float32)
    near_alpha = np.isfinite(near_depth).astype(np.float32)
    far_img = post(ground(far_rgb, None, far_depth, big, mood)[0], big, mood, seed=2)
    near_lin, halo = ground(near_rgb, emit, near_depth, big, mood, all_depth=nearest)
    near_img = post(near_lin, big, mood, seed=3)
    out = {}
    if mood == 'dusk':
        halo_img = np.clip(tonemap(halo * 1.65) * 1.15, 0, 1)
        out['glow'] = downsample(halo_img, np.ones_like(near_alpha), ss)
    out['sky'] = downsample(sky_img, np.ones_like(far_alpha), ss)
    out['far'] = downsample(far_img, far_alpha, ss)
    out['near'] = downsample(near_img, near_alpha, ss)
    spots = [(x, y, z) for x, y, z in found if np.isfinite(near_depth[min(big.hpx - 1, int(y * big.hpx)), min(big.w - 1, int(x * big.w))])]
    return out, spots


def slots(spots, count=36):
    """Places for parish lights: the centres of the brightest village clusters, spread across the frame."""
    if not spots:
        return []
    pts = np.array([(x, y) for x, y, _ in spots])
    cell = 0.035
    keys = {}
    for x, y in pts:
        keys.setdefault((int(x / cell), int(y / cell)), []).append((x, y))
    ranked = sorted(keys.values(), key=len, reverse=True)
    chosen = []
    for group in ranked:
        cx, cy = np.mean(group, axis=0)
        if all(math.hypot(cx - a, (cy - b) * 0.6) > 0.05 for a, b in chosen):
            chosen.append((float(cx), float(cy)))
        if len(chosen) >= count:
            break
    return [{'x': round(x, 4), 'y': round(y, 4)} for x, y in chosen]


def save_layer(rgb, alpha, path, quality):
    if alpha is None or alpha.min() > 0.999:
        Image.fromarray((rgb * 255 + 0.5).astype(np.uint8)).save(path, 'WEBP', quality=quality, method=6)
    else:
        rgba = np.dstack([rgb, alpha])
        Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, 'WEBP', quality=quality, method=6, alpha_quality=90)


def publish(src, site):
    """Turn a finished render directory into the site's assets.

    The glow is stored with alpha (colour / brightest channel) so it composites inside a
    moving layer; the mist is a seamless horizontal texture; the About arch uses a dawn crop."""
    src, site = Path(src), Path(site)
    images = site / 'assets' / 'images' / 'valley'
    images.mkdir(parents=True, exist_ok=True)
    meta = json.loads((src / 'valley.json').read_text())
    for frame in meta:
        for mood in ('dusk', 'dawn'):
            for part in ('sky', 'far', 'near'):
                f = src / f'valley-{frame}-{mood}-{part}.webp'
                if f.exists():
                    (images / f.name).write_bytes(f.read_bytes())
        g = src / f'valley-{frame}-dusk-glow.webp'
        if g.exists():
            rgb = np.asarray(Image.open(g).convert('RGB')).astype(np.float32) / 255
            a = np.clip(rgb.max(-1) * 1.05, 0, 1)
            col = np.where(a[..., None] > 1e-3, rgb / np.maximum(a[..., None], 1e-3), 0)
            rgba = np.dstack([np.clip(col, 0, 1), a])
            Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(images / g.name, 'WEBP', quality=70, alpha_quality=80, method=6)
    # mist: f(x)(1-x) + f(x-1)x over [-1, 1) is seamless across the tile edge
    w, hgt = 2048, 384
    xs = np.linspace(-1, 1, 2 * w, endpoint=False, dtype=np.float32)
    ys = np.linspace(0, 1, hgt, dtype=np.float32)
    X, Y = np.meshgrid(xs, ys)
    def field(x, y):
        out = np.zeros_like(x)
        amp, sx, sy = 1.0, 2.0, 3.2
        for i in range(4):
            n, _, _ = vnoise(x * sx + 11.3, y * sy + 4.7)
            out += amp * n
            amp *= 0.55
            sx *= 2
            sy *= 2
        return out
    f = field(X, Y)
    t = (xs[w:] + 0)[None, :]
    tile = f[:, w:] * (1 - t) + f[:, :w] * t
    tile = (tile - tile.mean()) / tile.std()
    band = np.exp(-((ys[:, None] - 0.55) / 0.24) ** 2)
    # soft banks with clear gaps; the blur wraps sideways, so the tile stays seamless
    alpha = blur(smoothstep(-0.4, 1.8, tile) * band, 5)
    mist = np.dstack([np.full_like(alpha, 0.80), np.full_like(alpha, 0.85), np.full_like(alpha, 0.96), np.clip(alpha * 0.5, 0, 1)])
    Image.fromarray((mist * 255 + 0.5).astype(np.uint8), 'RGBA').save(images / 'mist.webp', 'WEBP', quality=80, alpha_quality=95, method=6)
    # the About arch: the crest at dawn
    dawn = src / 'valley-wide-dawn.jpg'
    if dawn.exists():
        im = Image.open(dawn)
        W, H = im.size
        x0, y0, hh = int(W * 0.35), int(H * 0.16), int(H * 0.625)       # the sunlit twin summits, the mist and the first hills
        box = (x0, y0, x0 + int(hh * 0.8), y0 + hh)
        im.crop(box).resize((720, 900), Image.LANCZOS).save(images / 'crest-dawn.webp', 'WEBP', quality=78, method=6)
    data = site / 'assets' / 'data' / 'valley.js'
    data.write_text('/* Generated by docs/tools/render_valley.py: image sizes and village spots for the parish lights. */\n'
                    'export default ' + json.dumps(meta, separators=(',', ':')) + ';\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--size', default='2560x1440')
    ap.add_argument('--portrait', default='1080x1920')
    ap.add_argument('--moods', default='dusk,dawn')
    ap.add_argument('--ss', type=int, default=2)
    ap.add_argument('--publish', help='copy a finished render into this site root instead of rendering')
    args = ap.parse_args()
    if args.publish:
        publish(args.out, args.publish)
        return
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    h = terrain()
    meta = {}
    for frame, size in (('wide', args.size), ('tall', args.portrait)):
        if not size:
            continue
        w, hgt = map(int, size.split('x'))
        meta[frame] = {'width': w, 'height': hgt}
        for mood in args.moods.split(','):
            colour, villages = colour_map(h, mood)
            cam = make_camera(h, w, hgt, portrait=frame == 'tall')
            imgs, spots = layers(h, colour, villages, cam, mood, args.ss)
            for name, (rgb, alpha) in imgs.items():
                save_layer(rgb, None if name in ('sky', 'glow') else alpha, out / f'valley-{frame}-{mood}-{name}.webp', 80 if mood == 'dusk' else 72)
            comp = imgs['sky'][0]
            for name in ('far', 'near'):
                rgb, alpha = imgs[name]
                comp = comp * (1 - alpha[..., None]) + rgb * alpha[..., None]
            if 'glow' in imgs:
                comp = 1 - (1 - comp) * (1 - imgs['glow'][0])          # CSS mix-blend-mode: screen
            Image.fromarray((comp * 255 + 0.5).astype(np.uint8)).save(out / f'valley-{frame}-{mood}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)
            if mood == 'dusk':
                meta[frame]['slots'] = slots(spots)
            print(frame, mood, 'done', len(spots), flush=True)
    (out / 'valley.json').write_text(json.dumps(meta))


if __name__ == '__main__':
    main()
