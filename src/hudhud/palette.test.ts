import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BEIGE, DARK_PALETTE, LIGHT_NATURAL, LIGHT_NAVY, STRIKE_LIGHT, contrast, mix, paletteVars, readPalette } from './palette';

const mainCss = readFileSync(resolve(import.meta.dirname, '../styles/main.css'), 'utf8');
const rootVars = mainCss.slice(mainCss.indexOf(':root {'), mainCss.indexOf('}', mainCss.indexOf(':root {')));
const varOf = (name: string): string | undefined => new RegExp(`${name}:\\s*([^;]+);`).exec(rootVars)?.[1]?.trim();

describe('ألوان المظهر الداكن', () => {
  it('هي الهوية المعتمدة نفسها في main.css', () => {
    expect(varOf('--hudhud-color')).toBe(DARK_PALETTE.bird);
    expect(varOf('--bolt-color')).toBe(DARK_PALETTE.bolt);
    expect(varOf('--bolt-halo')).toBe(DARK_PALETTE.halo);
  });

  it('ما لم يُعرَّف من المتغيرات يأخذ قيمة الداكن، والهدهد كله بلون واحد بلا خطوط', () => {
    const palette = readPalette({ getPropertyValue: () => '' });
    expect(palette).toEqual({ ...DARK_PALETTE, parts: {}, stripes: undefined });
  });
});

describe('خيارا المظهر الفاتح', () => {
  it.each([
    ['(أ) الطبيعي', LIGHT_NATURAL],
    ['(ب) الكحلي', LIGHT_NAVY],
  ])('%s: تباين الهدهد (حتى لحظة الضربة) وقلب الصاعقة مع البيج 3 على الأقل', (_, palette) => {
    for (const color of [palette.bird, ...Object.values(palette.parts ?? {})]) {
      expect(contrast(color, BEIGE)).toBeGreaterThanOrEqual(3);
      expect(contrast(mix(color, palette.lit, STRIKE_LIGHT), BEIGE)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(palette.bolt, BEIGE)).toBeGreaterThanOrEqual(3);
  });

  it('(أ): الخطوط البنية تظهر على لون الذيل', () => {
    const tail = LIGHT_NATURAL.parts?.tail ?? LIGHT_NATURAL.bird;
    expect(contrast(LIGHT_NATURAL.stripes as string, tail)).toBeGreaterThanOrEqual(3);
  });

  it('المتغيرات تعيد اللوحة نفسها', () => {
    for (const palette of [LIGHT_NATURAL, LIGHT_NAVY]) {
      const vars = paletteVars(palette);
      const read = readPalette({ getPropertyValue: (name: string) => vars[name] ?? '' });
      expect(read).toEqual({ ...palette, parts: palette.parts ?? {}, stripes: palette.stripes });
    }
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
