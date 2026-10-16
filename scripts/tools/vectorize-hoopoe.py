"""
يحوّل صورة الهدهد (materials/hoopoe.jpg) إلى:
- src/hudhud/shape.ts: الشكل المصمت كاملاً (منحنيات SVG) للهدهد الثابت.
- public/favicon.svg: أيقونة المتصفح.
- src/hudhud/rig-data.ts: الشكل مقسوماً إلى أجزاء متحركة (الساقان، الجسم، الذيل، الرأس، التاج) مع مفاصلها.

أداة تُشغَّل يدوياً مرة واحدة عند تغيير الصورة، وليست جزءاً من البناء:
    python3 -m venv .venv && .venv/bin/pip install potracer pillow numpy shapely
    .venv/bin/python scripts/tools/vectorize-hoopoe.py

إذا تغيّرت الصورة، راجع إحداثيات المفاصل في RIG أدناه (بوحدات مساحة الشكل).
"""

import sys
from pathlib import Path

import numpy as np
import potrace
from PIL import Image
from shapely import affinity
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'materials' / 'hoopoe.jpg'
SHAPE_TS = ROOT / 'src' / 'hudhud' / 'shape.ts'
FAVICON = ROOT / 'public' / 'favicon.svg'
RIG_TS = ROOT / 'src' / 'hudhud' / 'rig-data.ts'

PAD = 8  # هامش حول الطائر داخل مساحة الرسم
BRAND = '#4fc3f7'


def fmt(value: float) -> str:
    text = f'{value:.1f}'.rstrip('0').rstrip('.')
    return '0' if text == '-0' else text


def pt(point, ox: float, oy: float) -> str:
    return f'{fmt(point.x - ox)} {fmt(point.y - oy)}'


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(
            'صورة الهدهد غير موجودة في materials/hoopoe.jpg. استرجعها من سجل git:\n'
            '    mkdir -p materials && git show 3a2f7dd:materials/hoopoe.jpg > materials/hoopoe.jpg'
        )
    image = Image.open(SOURCE).convert('L')
    dark = np.array(image) < 128
    ys, xs = np.nonzero(dark)
    left, right, top, bottom = xs.min(), xs.max(), ys.min(), ys.max()
    ox, oy = left - PAD, top - PAD
    width = int(right - left + 1 + 2 * PAD)
    height = int(bottom - top + 1 + 2 * PAD)

    # potracer يعتبر القيم المنخفضة (الداكنة) هي الشكل المملوء.
    curves = potrace.Bitmap(~dark).trace(
        turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.4
    )

    parts = []
    for curve in curves:
        parts.append(f'M{pt(curve.start_point, ox, oy)}')
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f'L{pt(seg.c, ox, oy)}L{pt(seg.end_point, ox, oy)}')
            else:
                parts.append(
                    f'C{pt(seg.c1, ox, oy)} {pt(seg.c2, ox, oy)} {pt(seg.end_point, ox, oy)}'
                )
        parts.append('Z')
    path = ''.join(parts)

    # موضع القدمين: منتصف أسفل الطائر، محور حركة النقر.
    feet_rows = dark[bottom - 3 : bottom + 1]
    feet_x = np.nonzero(feet_rows.any(axis=0))[0]
    feet_center = (feet_x.min() + feet_x.max()) / 2 - ox

    SHAPE_TS.parent.mkdir(parents=True, exist_ok=True)
    SHAPE_TS.write_text(
        '// مولَّد آلياً من materials/hoopoe.jpg بواسطة scripts/tools/vectorize-hoopoe.py — لا تعدّله يدوياً.\n'
        f'export const HUDHUD_WIDTH = {width};\n'
        f'export const HUDHUD_HEIGHT = {height};\n'
        '/** موضع القدمين (محور النقر) بالنسبة لعرض الشكل وارتفاعه. */\n'
        f'export const HUDHUD_FEET = {{ x: {feet_center / width:.3f}, y: {(bottom - oy) / height:.3f} }};\n'
        f"export const HUDHUD_PATH =\n  '{path}';\n",
        encoding='utf-8',
    )

    size = max(width, height)
    fx, fy = (size - width) / 2, (size - height) / 2
    FAVICON.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
        f'<path transform="translate({fmt(fx)} {fmt(fy)})" fill="{BRAND}" fill-rule="evenodd" d="{path}"/>'
        '</svg>\n',
        encoding='utf-8',
    )

    write_rig(curves, ox, oy, width, height)
    print(f'viewBox {width}x{height}, {len(curves)} curves, path {len(path)} chars', file=sys.stderr)


# ---------------------------------------------------------------------------
# تقسيم الشكل إلى أجزاء
# ---------------------------------------------------------------------------

# المفاصل والقطوع بوحدات مساحة الشكل (العرض 725 والارتفاع 617).
# كل جزء يتداخل مع جاره عند المفصل حتى لا يظهر خط فاصل بين الأجزاء.
RIG = {
    # الرقبة: قطع أفقي بين مقدمة الرقبة ومؤخرتها، والرأس يدور حول منتصفه.
    'neck_y': 210,
    'neck_pivot': (287, 210),
    'neck_radius': 68,  # قرص المفصل (مع الجسم) يملأ الفراغ حين يدور الرأس
    'neck_overlap': 10,
    # قاعدة التاج: خط من الجبهة إلى مؤخرة الرأس. يبقى ثابتاً حين يُفرد التاج أو ينطوي.
    'crest_base': ((194, 96), (334, 123)),
    'crest_overlap': 6,
    # قاعدة الذيل: من التقاء البطن بالذيل إلى رأس الشق بين طرف الجناح والذيل، ثم داخل الشق.
    'tail_line': ((480, 482), (586, 466), (800, 573)),
    'tail_pivot': (505, 478),
    'tail_overlap': 6,
    # الورك: الجسم يميل حوله والساقان ثابتتان.
    'hip_y': 486,
    'hip_pivot': (370, 480),
    'legs_overlap': 18,
    'legs_max_x': 480,
    # مركز التنفّس داخل الصدر.
    'breath_origin': (330, 330),
}

FAR = 2000


def flatten(curve, ox, oy, steps=14):
    """يحوّل منحنى potrace إلى نقاط متتالية."""
    pts = []
    cur = (curve.start_point.x - ox, curve.start_point.y - oy)
    pts.append(cur)
    for seg in curve.segments:
        if seg.is_corner:
            pts.append((seg.c.x - ox, seg.c.y - oy))
            cur = (seg.end_point.x - ox, seg.end_point.y - oy)
            pts.append(cur)
            continue
        p0 = cur
        p1 = (seg.c1.x - ox, seg.c1.y - oy)
        p2 = (seg.c2.x - ox, seg.c2.y - oy)
        p3 = (seg.end_point.x - ox, seg.end_point.y - oy)
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            pts.append((
                u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
            ))
        cur = p3
    return pts


def silhouette(curves, ox, oy):
    """الشكل الكامل: المنحنى الخارجي مطروحاً منه الفتحات (الفراغ بين الساقين)."""
    rings = [Polygon(flatten(c, ox, oy)) for c in curves]
    rings.sort(key=lambda r: r.area, reverse=True)
    shape = rings[0]
    for hole in rings[1:]:
        shape = shape.difference(hole)
    return shape.buffer(0)


def above_line(a, b, shift=0.0):
    """المنطقة فوق الخط المار بالنقطتين a و b (y أصغر)، مُزاحاً للأعلى بمقدار shift."""
    (x1, y1), (x2, y2) = a, b
    slope = (y2 - y1) / (x2 - x1)
    ly = lambda x: y1 + (x - x1) * slope - shift
    return Polygon([(-FAR, ly(-FAR)), (FAR, ly(FAR)), (FAR, -FAR), (-FAR, -FAR)])


def tail_region(shift=0.0):
    (ax, ay), (nx, ny), (ex, ey) = RIG['tail_line']
    return Polygon([
        (ax, ay + shift), (nx, ny + shift), (ex, ey + shift), (ex, FAR), (ax, FAR),
    ])


def path_of(geom, digits=1):
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    out = []
    for poly in polys:
        for ring in [poly.exterior, *poly.interiors]:
            coords = list(ring.coords)[:-1]
            out.append('M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in coords) + 'Z')
    return ''.join(out)


def write_rig(curves, ox, oy, width, height):
    full = silhouette(curves, ox, oy)
    r = RIG
    world = box(-FAR, -FAR, FAR, FAR)

    crest_poly = full.intersection(above_line(*r['crest_base']))
    head_poly = (
        full.intersection(box(-FAR, -FAR, FAR, r['neck_y']))
        .difference(above_line(*r['crest_base'], shift=r['crest_overlap']))
    )
    tail_poly = full.intersection(tail_region())
    legs_core = box(-FAR, r['hip_y'], r['legs_max_x'], FAR)
    legs_poly = full.intersection(box(-FAR, r['hip_y'] - r['legs_overlap'], r['legs_max_x'], FAR))
    body_area = (
        world.intersection(box(-FAR, r['neck_y'] - r['neck_overlap'], FAR, FAR))
        .difference(tail_region(shift=r['tail_overlap']))
        .difference(legs_core)
    )
    body_poly = full.intersection(body_area)
    neck_disk = Point(*r['neck_pivot']).buffer(r['neck_radius'], quad_segs=24)
    tail_disk = Point(*r['tail_pivot']).buffer(10, quad_segs=12).intersection(full)
    body_poly = unary_union([body_poly, neck_disk.intersection(full), tail_disk])

    parts = {
        'legs': legs_poly,
        'tail': tail_poly,
        'body': body_poly,
        'head': head_poly,
        'crest': crest_poly,
    }

    # تحقق: اتحاد الأجزاء يطابق الشكل الأصلي.
    union = unary_union(list(parts.values()))
    missing = full.difference(union).area
    extra = union.difference(full.buffer(0.5)).area
    print(f'rig: missing area {missing:.1f}, extra area {extra:.1f}', file=sys.stderr)
    if missing > 1 or extra > 1:
        raise SystemExit('الأجزاء لا تطابق الشكل الأصلي')

    lines = [
        '// مولَّد آلياً من materials/hoopoe.jpg بواسطة scripts/tools/vectorize-hoopoe.py — لا تعدّله يدوياً.',
        '// أجزاء الهدهد المتحركة بوحدات مساحة الشكل، ومفاصلها.',
        '',
        'export type Point = readonly [number, number];',
        '',
        'export const RIG_WIDTH = %d;' % width,
        'export const RIG_HEIGHT = %d;' % height,
        '',
        'export const RIG_JOINTS = {',
        f"  hip: [{fmt(r['hip_pivot'][0])}, {fmt(r['hip_pivot'][1])}] as Point,",
        f"  neck: [{fmt(r['neck_pivot'][0])}, {fmt(r['neck_pivot'][1])}] as Point,",
        f"  tail: [{fmt(r['tail_pivot'][0])}, {fmt(r['tail_pivot'][1])}] as Point,",
        f"  crestBase: [[{r['crest_base'][0][0]}, {r['crest_base'][0][1]}], [{r['crest_base'][1][0]}, {r['crest_base'][1][1]}]] as readonly [Point, Point],",
        f"  breath: [{fmt(r['breath_origin'][0])}, {fmt(r['breath_origin'][1])}] as Point,",
        '};',
        '',
        '/** مسار كل جزء (SVG path بخطوط مستقيمة). الترتيب هو ترتيب الرسم. */',
        'export const RIG_PARTS = {',
    ]
    total = 0
    for name, geom in parts.items():
        simple = geom.simplify(0.35, preserve_topology=True)
        d = path_of(simple)
        total += len(d)
        lines.append(f"  {name}:\n    '{d}',")
    lines += ['} as const;', '']
    RIG_TS.write_text('\n'.join(lines), encoding='utf-8')
    print(f'rig: {total} chars of part paths', file=sys.stderr)


if __name__ == '__main__':
    main()
