import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BEIGE, DARK_PALETTE, LIGHT_PALETTE, STRIKE_LIGHT, contrast, mix, paletteVars, readPalette } from './palette';

const css = (file: string): string => readFileSync(resolve(import.meta.dirname, '../styles', file), 'utf8');

/** متغيرات CSS في أول قاعدة بهذا المحدد (initial = غير معرَّف، كما يقرؤه المتصفح). */
function blockVars(source: string, selector: string): Record<string, string> {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`لم أجد ${selector}`);
  const block = source.slice(start, source.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[name as string] = value?.trim() === 'initial' ? '' : (value?.trim() ?? '');
  }
  return vars;
}

const asStyle = (vars: Record<string, string>) => ({ getPropertyValue: (name: string) => vars[name] ?? '' });

/** الداكن كما يقرؤه الهدهد: كله بلون واحد بلا خطوط. */
const DARK_READ = { ...DARK_PALETTE, parts: {}, stripes: undefined };

describe('ألوان المظهر الداكن', () => {
  it('هي الهوية المعتمدة نفسها في main.css', () => {
    expect(readPalette(asStyle(blockVars(css('main.css'), ':root')))).toEqual(DARK_READ);
  });

  it('ما لم يُعرَّف من المتغيرات يأخذ قيمة الداكن', () => {
    expect(readPalette(asStyle({}))).toEqual(DARK_READ);
  });

  it('الخريطة داكنة في المظهرين، فالهدهد والصواعق عليها بألوان الداكن حتى في الفاتح', () => {
    const light = blockVars(css('main.css'), ":root[data-theme='light']");
    const map = blockVars(css('map.css'), '.map');
    expect(readPalette(asStyle({ ...light, ...map }))).toEqual(DARK_READ);
  });
});

describe('المظهر الفاتح (الخيار «أ» المعتمد)', () => {
  it('main.css يعرّف ألوان LIGHT_PALETTE نفسها', () => {
    const light = blockVars(css('main.css'), ":root[data-theme='light']");
    const expected = Object.fromEntries(Object.entries(paletteVars(LIGHT_PALETTE)).filter(([, v]) => v));
    expect(Object.fromEntries(Object.keys(expected).map((name) => [name, light[name]]))).toEqual(expected);
    expect(readPalette(asStyle(light))).toEqual({ ...LIGHT_PALETTE, parts: LIGHT_PALETTE.parts });
  });

  it('تباين الهدهد (حتى لحظة الضربة) وقلب الصاعقة مع البيج 3 على الأقل', () => {
    for (const color of [LIGHT_PALETTE.bird, ...Object.values(LIGHT_PALETTE.parts ?? {})]) {
      expect(contrast(color, BEIGE)).toBeGreaterThanOrEqual(3);
      expect(contrast(mix(color, LIGHT_PALETTE.lit, STRIKE_LIGHT), BEIGE)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(LIGHT_PALETTE.bolt, BEIGE)).toBeGreaterThanOrEqual(3);
  });

  it('الخطوط البنية تظهر على لون الذيل', () => {
    const tail = LIGHT_PALETTE.parts?.tail ?? LIGHT_PALETTE.bird;
    expect(contrast(LIGHT_PALETTE.stripes as string, tail)).toBeGreaterThanOrEqual(3);
  });

  it('المتغيرات تعيد اللوحة نفسها', () => {
    const vars = paletteVars(LIGHT_PALETTE);
    expect(readPalette(asStyle(vars))).toEqual({ ...LIGHT_PALETTE, parts: LIGHT_PALETTE.parts });
  });
});

describe('mix', () => {
  it('الهدهد الداكن لحظة الضربة يفتح نحو الأبيض كما كان', () => {
    expect(mix('#4fc3f7', DARK_PALETTE.lit, STRIKE_LIGHT)).toBe('#84d5f9');
    expect(mix('#4fc3f7', '#ffffff', 0)).toBe('#4fc3f7');
  });
});

describe('contrast', () => {
  it('الأسود على الأبيض 21، واللون مع نفسه 1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#4fc3f7', '#4fc3f7')).toBe(1);
  });
});
