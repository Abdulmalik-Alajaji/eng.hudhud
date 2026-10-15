"""
يحوّل صورة الهدهد (materials/hoopoe.jpg) إلى شكل SVG مصمت: src/hudhud/shape.ts و public/favicon.svg.

أداة تُشغَّل يدوياً مرة واحدة عند تغيير الصورة، وليست جزءاً من البناء:
    python3 -m venv .venv && .venv/bin/pip install potracer pillow numpy
    .venv/bin/python scripts/tools/vectorize-hoopoe.py
"""

import sys
from pathlib import Path

import numpy as np
import potrace
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'materials' / 'hoopoe.jpg'
SHAPE_TS = ROOT / 'src' / 'hudhud' / 'shape.ts'
FAVICON = ROOT / 'public' / 'favicon.svg'

PAD = 8  # هامش حول الطائر داخل مساحة الرسم
BRAND = '#4fc3f7'


def fmt(value: float) -> str:
    text = f'{value:.1f}'.rstrip('0').rstrip('.')
    return '0' if text == '-0' else text


def pt(point, ox: float, oy: float) -> str:
    return f'{fmt(point.x - ox)} {fmt(point.y - oy)}'


def main() -> None:
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

    print(f'viewBox {width}x{height}, {len(curves)} curves, path {len(path)} chars', file=sys.stderr)


if __name__ == '__main__':
    main()
