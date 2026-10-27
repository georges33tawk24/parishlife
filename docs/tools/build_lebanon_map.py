"""Build assets/data/lebanon-map.js and assets/images/lebanon-relief.webp: outline, governorate lines, stylized relief, rivers, places.

Outline and governorates: Natural Earth 1:10m (public domain). Relief is a stylized
heightfield from the main summits (not survey data), contoured with marching squares.

Usage, with numpy, shapely and pillow installed and a natural-earth-vector checkout:
    python docs/tools/build_lebanon_map.py natural-earth-vector/geojson/ assets/data/lebanon-map.js assets/images/lebanon-relief.webp"""
import json, math, sys
import numpy as np
from shapely.geometry import shape, LineString, MultiLineString, Polygon
from shapely.ops import linemerge, unary_union
from shapely import affinity

NE = sys.argv[1]   # natural-earth-vector/geojson/ directory
OUT = sys.argv[2]  # assets/data/lebanon-map.js

LON0, LON1, LAT0, LAT1 = 35.06, 36.66, 33.02, 34.72
K = 600.0
COS = math.cos(math.radians(33.87))
W = round((LON1 - LON0) * K * COS, 1)
H = round((LAT1 - LAT0) * K, 1)

def P(lon, lat):
    return ((lon - LON0) * K * COS, (LAT1 - lat) * K)

def proj_geom(g):
    from shapely.ops import transform
    return transform(lambda x, y, z=None: (np.array((np.asarray(x) - LON0) * K * COS), np.array((LAT1 - np.asarray(y)) * K)), g)

countries = json.load(open(NE + 'ne_10m_admin_0_countries.geojson'))
leb = next(shape(f['geometry']) for f in countries['features'] if f['properties']['ADM0_A3'] == 'LBN')
lebp = proj_geom(leb)
states = json.load(open(NE + 'ne_10m_admin_1_states_provinces.geojson'))
gov = [proj_geom(shape(f['geometry'])) for f in states['features'] if f['properties']['adm0_a3'] == 'LBN']
inner = unary_union([g.boundary for g in gov]).difference(lebp.boundary.buffer(1.2))

def fmt(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s

def path_line(coords):
    pts = list(coords)
    return 'M' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in pts)

def path_lines(g):
    if g.is_empty: return ''
    geoms = g.geoms if hasattr(g, 'geoms') else [g]
    out = []
    for ln in geoms:
        if ln.geom_type == 'LineString' and ln.length > 0: out.append(path_line(ln.coords))
    return ''.join(out)

def chaikin(coords, n=2, closed=False):
    pts = np.array(coords)
    for _ in range(n):
        if len(pts) < 3: break
        q = 0.75 * pts[:-1] + 0.25 * pts[1:]
        r = 0.25 * pts[:-1] + 0.75 * pts[1:]
        mid = np.empty((len(q) * 2, 2)); mid[0::2] = q; mid[1::2] = r
        pts = mid if closed else np.vstack([pts[:1], mid, pts[-1:]])
    return pts

land = lebp.simplify(0.25)
land_d = path_line(land.exterior.coords) + 'Z'

# ---- stylized heightfield -------------------------------------------------
ML = [(34.66, 36.30, 1500), (34.55, 36.25, 2000), (34.42, 36.18, 2300), (34.30, 36.11, 3088), (34.24, 36.05, 2850),
      (34.12, 35.97, 2350), (34.03, 35.92, 2450), (33.95, 35.87, 2628), (33.84, 35.79, 2050), (33.72, 35.70, 1950),
      (33.60, 35.63, 1800), (33.47, 35.58, 1250), (33.33, 35.52, 850), (33.18, 35.44, 750), (33.05, 35.38, 650)]
AL = [(34.62, 36.70, 2000), (34.45, 36.58, 2300), (34.25, 36.45, 2450), (34.05, 36.33, 2500), (33.85, 36.16, 2200),
      (33.65, 36.02, 2000), (33.50, 35.93, 2300), (33.41, 35.86, 2814), (33.30, 35.78, 1800)]
BQ = [(34.42, 36.42, 650), (34.20, 36.30, 950), (34.00, 36.18, 1100), (33.85, 35.98, 950), (33.70, 35.85, 900), (33.55, 35.72, 850)]

lons = np.arange(LON0, LON1 + 1e-9, 0.004)
lats = np.arange(LAT1, LAT0 - 1e-9, -0.004)

TABLE = np.random.default_rng(7).standard_normal((4, 512, 512))
def noise(LON, LAT, cell, amp, layer):
    """Smooth value noise defined on lon/lat, so every grid samples the same surface."""
    u = (LON - 34.0) / cell; v = (LAT - 32.0) / cell
    x0 = np.floor(u).astype(int); y0 = np.floor(v).astype(int); fx = u - x0; fy = v - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    g = TABLE[layer]
    a = g[y0 % 512, x0 % 512]; b = g[y0 % 512, (x0 + 1) % 512]; c = g[(y0 + 1) % 512, x0 % 512]; d = g[(y0 + 1) % 512, (x0 + 1) % 512]
    return amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)

def ridge(LON, LAT, points, sw, se):
    X = LON * COS; Y = LAT
    best = np.full(LON.shape, 1e9); hv = np.zeros(LON.shape); side = np.zeros(LON.shape)
    for (la1, lo1, h1), (la2, lo2, h2) in zip(points, points[1:]):
        ax, ay, bx, by = lo1 * COS, la1, lo2 * COS, la2
        dx, dy = bx - ax, by - ay
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        d = np.hypot(X - (ax + t * dx), Y - (ay + t * dy))
        m = d < best
        best = np.where(m, d, best); hv = np.where(m, h1 + (h2 - h1) * t, hv)
        side = np.where(m, np.sign(dx * (Y - ay) - dy * (X - ax)), side)
    return hv * np.exp(-(best / np.where(side > 0, se, sw)) ** 2)

GORGES = [  # coast-to-crest river valleys of Mount Lebanon: (lat, lon) from the mouth upstream
    [(34.44, 35.83), (34.38, 35.87), (34.33, 35.90), (34.29, 35.93), (34.26, 35.97), (34.25, 36.02)],   # Qadisha / Abu Ali
    [(34.065, 35.640), (34.07, 35.70), (34.06, 35.77), (34.05, 35.84), (34.06, 35.90)],                 # Nahr Ibrahim
    [(33.96, 35.600), (33.955, 35.65), (33.96, 35.72), (33.97, 35.79)],                                  # Nahr el-Kalb
    [(33.90, 35.535), (33.88, 35.59), (33.86, 35.65), (33.85, 35.70)],                                   # Beirut river
    [(33.73, 35.450), (33.72, 35.52), (33.71, 35.58), (33.70, 35.63)],                                   # Damour
    [(33.59, 35.385), (33.61, 35.46), (33.63, 35.53), (33.65, 35.60)],                                   # Awali
    [(34.21, 35.65), (34.22, 35.72), (34.20, 35.80), (34.19, 35.86)],                                    # Nahr el-Jawz
]

def trough(LON, LAT, line, width):
    X = LON * COS; Y = LAT; best = np.full(LON.shape, 1e9)
    for (la1, lo1), (la2, lo2) in zip(line, line[1:]):
        ax, ay, bx, by = lo1 * COS, la1, lo2 * COS, la2; dx, dy = bx - ax, by - ay
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        best = np.minimum(best, np.hypot(X - (ax + t * dx), Y - (ay + t * dy)))
    return np.exp(-(best / width) ** 2)

def height(LON, LAT):
    WL = LON + noise(LON, LAT, 0.09, 0.022, 0); WA = LAT + noise(LON, LAT, 0.09, 0.022, 1)
    Z = np.maximum.reduce([ridge(WL, WA, ML, 0.16, 0.085), ridge(WL, WA, AL, 0.11, 0.11), ridge(WL, WA, BQ, 0.10, 0.10)])
    n = noise(LON, LAT, 0.11, 0.09, 2) + noise(LON, LAT, 0.04, 0.05, 3) + noise(LON, LAT, 0.016, 0.018, 0)
    Z = Z * (1 + n)
    cut = np.maximum.reduce([trough(WL, WA, g, 0.016) for g in GORGES])
    return Z * (1 - 0.38 * cut) + 30 * noise(LON, LAT, 0.05, 1.0, 1)

LON, LAT = np.meshgrid(lons, lats)
Z = height(LON, LAT)

def contours(Z, level):
    a = Z[:-1, :-1] > level; b = Z[:-1, 1:] > level; c = Z[1:, 1:] > level; d = Z[1:, :-1] > level
    idx = a * 8 + b * 4 + c * 2 + d * 1
    rows, cols = np.nonzero((idx > 0) & (idx < 15))
    def pt(edge):
        kind, i, j = edge
        if kind == 'h':
            v0, v1 = Z[i, j], Z[i, j + 1]; t = (level - v0) / (v1 - v0)
            return (lons[j] + t * (lons[j + 1] - lons[j]), lats[i])
        v0, v1 = Z[i, j], Z[i + 1, j]; t = (level - v0) / (v1 - v0)
        return (lons[j], lats[i] + t * (lats[i + 1] - lats[i]))
    adj = {}
    def link(e1, e2):
        adj.setdefault(e1, []).append(e2); adj.setdefault(e2, []).append(e1)
    for i, j in zip(rows, cols):
        k = idx[i, j]
        T, R, B, L = ('h', i, j), ('v', i, j + 1), ('h', i + 1, j), ('v', i, j)
        center = (Z[i, j] + Z[i, j + 1] + Z[i + 1, j] + Z[i + 1, j + 1]) / 4 > level
        table = {1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(T, R)], 6: [(T, B)], 7: [(L, T)], 8: [(L, T)],
                 9: [(T, B)], 11: [(T, R)], 12: [(L, R)], 13: [(B, R)], 14: [(L, B)],
                 5: [(L, T), (B, R)] if not center else [(L, B), (T, R)],
                 10: [(T, R), (L, B)] if not center else [(L, T), (B, R)]}
        for e1, e2 in table[k]: link(e1, e2)
    seen = set(); lines = []
    for start in list(adj):
        if start in seen: continue
        # walk to an end (degree 1) or around a loop
        chain = [start]; seen.add(start)
        for direction in (0, 1):
            cur = start
            while True:
                nxt = [e for e in adj[cur] if e not in seen]
                if not nxt: break
                cur = nxt[0]; seen.add(cur)
                if direction == 0: chain.append(cur)
                else: chain.insert(0, cur)
        if len(chain) > 3:
            lines.append([pt(e) for e in chain])
    return lines

relief = []
for level in range(300, 3001, 300):
    parts = []
    for line in contours(Z, level):
        ls = proj_geom(LineString(line)).intersection(lebp.buffer(-0.6))
        geoms = ls.geoms if hasattr(ls, 'geoms') else [ls]
        for g in geoms:
            if g.geom_type != 'LineString' or g.length < 14: continue
            g = g.simplify(0.7)
            closed = g.coords[0] == g.coords[-1]
            pts = chaikin(list(g.coords), 2, False)
            parts.append(path_line(pts))
    if parts: relief.append({'level': level, 'd': ''.join(parts)})

RIVERS = [
    ('Litani', 'الليطاني', [(34.03, 36.17), (33.96, 36.09), (33.89, 36.01), (33.82, 35.93), (33.75, 35.85), (33.68, 35.79), (33.61, 35.74), (33.565, 35.700), (33.52, 35.67), (33.46, 35.63), (33.40, 35.60), (33.35, 35.57), (33.325, 35.535), (33.33, 35.47), (33.345, 35.40), (33.335, 35.32), (33.336, 35.25)]),
    ('Orontes', 'العاصي', [(34.20, 36.33), (34.27, 36.35), (34.34, 36.37), (34.40, 36.39), (34.47, 36.43), (34.54, 36.47), (34.60, 36.52)]),
]
rivers = []
for en, ar, pts in RIVERS:
    g = proj_geom(LineString([(lo, la) for la, lo in pts])).intersection(lebp)
    geoms = g.geoms if hasattr(g, 'geoms') else [g]
    d = ''.join(path_line(chaikin(list(x.coords), 3)) for x in geoms if x.geom_type == 'LineString')
    rivers.append({'en': en, 'ar': ar, 'd': d})

PLACES = [  # name, Arabic, lat, lon, rank (1 = always labelled)
    ('Beirut', 'بيروت', 33.8938, 35.5018, 1), ('Tripoli', 'طرابلس', 34.4367, 35.8497, 1), ('Sidon', 'صيدا', 33.5571, 35.3729, 1),
    ('Tyre', 'صور', 33.2705, 35.2038, 1), ('Zahlé', 'زحلة', 33.8463, 35.9020, 1), ('Baalbek', 'بعلبك', 34.0047, 36.2110, 1),
    ('Byblos', 'جبيل', 34.1230, 35.6519, 2), ('Jounieh', 'جونية', 33.9808, 35.6178, 2), ('Nabatieh', 'النبطية', 33.3772, 35.4836, 2),
    ('Bsharri', 'بشرّي', 34.2508, 35.9411, 2), ('Batroun', 'البترون', 34.2553, 35.6581, 2), ('Hermel', 'الهرمل', 34.3942, 36.3847, 2),
    ('Jezzine', 'جزين', 33.5428, 35.5847, 2), ('Halba', 'حلبا', 34.5428, 36.0797, 2), ('Baabda', 'بعبدا', 33.8339, 35.5442, 2),
]
places = []
for en, ar, la, lo, rank in PLACES:
    x, y = P(lo, la); places.append({'en': en, 'ar': ar, 'x': round(x, 1), 'y': round(y, 1), 'rank': rank})

# Town centres for parishes that have not published coordinates yet (approximate, ~1 km).
TOWNS = [
    ('Hadath', 'الحدث', 33.8306, 35.5197), ('Baabda', 'بعبدا', 33.8339, 35.5442), ('Hazmieh', 'الحازمية', 33.8525, 35.5385),
    ('Louaizeh', 'اللويزة', 33.8440, 35.5560), ('Furn el Chebbak', 'فرن الشباك', 33.8660, 35.5280), ('Ain el Remmaneh', 'عين الرمانة', 33.8610, 35.5230),
    ('Beirut', 'بيروت', 33.8938, 35.5018), ('Achrafieh', 'الأشرفية', 33.8886, 35.5208), ('Sin el Fil', 'سن الفيل', 33.8708, 35.5397),
    ('Dekwaneh', 'الدكوانة', 33.8800, 35.5450), ('Jdeideh', 'الجديدة', 33.8931, 35.5592), ('Antelias', 'أنطلياس', 33.9147, 35.5872),
    ('Dbayeh', 'ضبية', 33.9333, 35.5833), ('Broummana', 'برمانا', 33.8822, 35.6200), ('Bikfaya', 'بكفيا', 33.9228, 35.6814),
    ('Zouk Mikael', 'زوق مكايل', 33.9700, 35.6130), ('Jounieh', 'جونية', 33.9808, 35.6178), ('Harissa', 'حريصا', 33.9819, 35.6514),
    ('Ghazir', 'غزير', 34.0200, 35.6600), ('Byblos', 'جبيل', 34.1230, 35.6519), ('Jbeil', 'جبيل', 34.1230, 35.6519),
    ('Amchit', 'عمشيت', 34.1489, 35.6439), ('Batroun', 'البترون', 34.2553, 35.6581), ('Douma', 'دوما', 34.2017, 35.8433),
    ('Bsharri', 'بشري', 34.2508, 35.9411), ('Ehden', 'إهدن', 34.3090, 35.9930), ('Zgharta', 'زغرتا', 34.3975, 35.8958),
    ('Tripoli', 'طرابلس', 34.4367, 35.8497), ('Halba', 'حلبا', 34.5428, 36.0797), ('Qobayat', 'القبيات', 34.5700, 36.2800),
    ('Hermel', 'الهرمل', 34.3942, 36.3847), ('Baalbek', 'بعلبك', 34.0047, 36.2110), ('Zahle', 'زحلة', 33.8463, 35.9020),
    ('Zahlé', 'زحلة', 33.8463, 35.9020), ('Aley', 'عاليه', 33.8100, 35.6000), ('Deir el Qamar', 'دير القمر', 33.6975, 35.5642),
    ('Beiteddine', 'بيت الدين', 33.6950, 35.5800), ('Jezzine', 'جزين', 33.5428, 35.5847), ('Sidon', 'صيدا', 33.5571, 35.3729),
    ('Saida', 'صيدا', 33.5571, 35.3729), ('Tyre', 'صور', 33.2705, 35.2038), ('Sour', 'صور', 33.2705, 35.2038),
    ('Nabatieh', 'النبطية', 33.3772, 35.4836), ('Marjayoun', 'مرجعيون', 33.3611, 35.5917), ('Rmeish', 'رميش', 33.0806, 35.3661),
    ('Rachaya', 'راشيا', 33.5000, 35.8433),
]
towns = []
for en, ar, la, lo in TOWNS:
    x, y = P(lo, la); towns.append({'en': en, 'ar': ar, 'x': round(x, 1), 'y': round(y, 1)})

LABELS = [('Mediterranean Sea', 'البحر المتوسط', 33.95, 35.30, 'sea', -62), ('Mount Lebanon', 'جبل لبنان', 34.05, 35.93, 'range', -55),
          ('Bekaa', 'البقاع', 33.86, 36.05, 'valley', -52), ('Anti-Lebanon', 'السلسلة الشرقية', 34.13, 36.47, 'range', -55),
          ('Qadisha Valley', 'وادي قاديشا', 34.40, 35.80, 'valley', 38)]
labels = []
for en, ar, la, lo, kind, rot in LABELS:
    x, y = P(lo, la); labels.append({'en': en, 'ar': ar, 'x': round(x, 1), 'y': round(y, 1), 'kind': kind, 'rotate': rot})

# ---- hillshade raster, aligned with the viewBox --------------------------
from PIL import Image, ImageDraw, ImageFilter
SCALE = 1.5
RW, RH = round(W * SCALE), round(H * SCALE)
px = (np.arange(RW) + 0.5) / SCALE; py = (np.arange(RH) + 0.5) / SCALE
RLON, RLAT = np.meshgrid(LON0 + px / (K * COS), LAT1 - py / K)
RZ = height(RLON, RLAT)
cell = 1 / (K * SCALE)  # degrees of latitude per pixel
dzdy, dzdx = np.gradient(RZ, cell * 111000, cell * 111000)
az, alt = math.radians(315), math.radians(42)
slope = np.arctan(2.2 * np.hypot(dzdx, dzdy)); aspect = np.arctan2(-dzdx, dzdy)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
flat = np.sin(alt)
light = np.clip((hs - flat) / (1 - flat), 0, 1); shade = np.clip((flat - hs) / flat, 0, 1)
mask = Image.new('L', (RW * 2, RH * 2), 0)
ImageDraw.Draw(mask).polygon([(x * SCALE * 2, y * SCALE * 2) for x, y in lebp.exterior.coords], fill=255)
mask = np.asarray(mask.resize((RW, RH), Image.LANCZOS)) / 255.0
rgba = np.zeros((RH, RW, 4))
lime = np.array([230, 222, 208]); night = np.array([8, 16, 32])
hl = light ** 0.8 * 0.40; sh = shade ** 0.9 * 0.50
alpha = hl + sh * (1 - hl)
col = (lime * hl[..., None] + night * (sh * (1 - hl))[..., None]) / np.maximum(alpha, 1e-6)[..., None]
rgba[..., :3] = col; rgba[..., 3] = alpha * mask * 255
Image.fromarray(rgba.astype(np.uint8), 'RGBA').save(sys.argv[3], 'WEBP', quality=78, method=6)

data = {
    'source': 'Outline and governorates: Natural Earth 1:10m (public domain). Relief is stylized from the main summits, not survey data; river courses are approximate.',
    'projection': {'lon0': LON0, 'lat1': LAT1, 'kx': round(K * COS, 4), 'ky': K},
    'width': W, 'height': H,
    'land': land_d, 'regions': path_lines(inner.simplify(0.4)),
    'relief': relief, 'rivers': rivers, 'places': places, 'labels': labels, 'towns': towns,
}
open(OUT, 'w').write('/* Generated by docs/tools/build_lebanon_map.py; see docs/homepage-design.md. */\nexport default ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('size', W, H, 'relief', [(r['level'], len(r['d'])) for r in relief])
