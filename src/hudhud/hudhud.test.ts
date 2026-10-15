import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOLT_DIRECTIONS, createHudhud, createHudhudShape } from './hudhud';
import { HUDHUD_FEET, HUDHUD_HEIGHT, HUDHUD_PATH, HUDHUD_WIDTH } from './shape';

describe('شكل الهدهد', () => {
  it('مسار SVG صالح بأبعاد موجبة', () => {
    expect(HUDHUD_PATH.startsWith('M')).toBe(true);
    expect(HUDHUD_WIDTH).toBeGreaterThan(0);
    expect(HUDHUD_HEIGHT).toBeGreaterThan(0);
  });

  it('القدمان داخل حدود الشكل وفي أسفله', () => {
    expect(HUDHUD_FEET.x).toBeGreaterThan(0);
    expect(HUDHUD_FEET.x).toBeLessThan(1);
    expect(HUDHUD_FEET.y).toBeGreaterThan(0.9);
    expect(HUDHUD_FEET.y).toBeLessThanOrEqual(1);
  });

  it('createHudhudShape يرسم الشكل بلون النص الحالي', () => {
    const svg = createHudhudShape();
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${HUDHUD_WIDTH} ${HUDHUD_HEIGHT}`);
    expect(svg.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('createHudhud', () => {
  it('صورة لها وصف عربي لقارئات الشاشة', () => {
    const hudhud = createHudhud();
    expect(hudhud.getAttribute('role')).toBe('img');
    expect(hudhud.getAttribute('aria-label')).toBe('هدهد الهندسة');
  });

  it('الخيار الهادئ: صاعقة لكل اتجاه، بلا شرر', () => {
    const hudhud = createHudhud('calm');
    expect(hudhud.classList.contains('hudhud--calm')).toBe(true);
    expect(hudhud.querySelectorAll('.hudhud__bolt')).toHaveLength(BOLT_DIRECTIONS.length);
    expect(hudhud.querySelector('.hudhud__glow')).not.toBeNull();
    expect(hudhud.querySelector('.hudhud__sparks')).toBeNull();
  });

  it('الخيار الأوضح: صواعق وشرر', () => {
    const hudhud = createHudhud('bright');
    expect(hudhud.querySelectorAll('.hudhud__bolt')).toHaveLength(BOLT_DIRECTIONS.length);
    expect(hudhud.querySelector('.hudhud__sparks')).not.toBeNull();
  });

  it('الثابت (علامة الوجهة): الهدهد وحده بلا صواعق ولا وهج', () => {
    const hudhud = createHudhud('still', 'الوجهة');
    expect(hudhud.getAttribute('aria-label')).toBe('الوجهة');
    expect(hudhud.querySelector('.hudhud__bolt')).toBeNull();
    expect(hudhud.querySelector('.hudhud__glow')).toBeNull();
    expect(hudhud.querySelector('.hudhud__bird svg')).not.toBeNull();
  });

  it('محور الحركة عند القدمين', () => {
    const bird = createHudhud().querySelector<HTMLElement>('.hudhud__bird');
    expect(bird?.style.transformOrigin).toBe(
      `${(HUDHUD_FEET.x * 100).toFixed(1)}% ${(HUDHUD_FEET.y * 100).toFixed(1)}%`,
    );
  });
});

describe('hudhud.css', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'hudhud.css'), 'utf8');

  function keyframeBlocks(source: string): string[] {
    const blocks: string[] = [];
    let index = source.indexOf('@keyframes');
    while (index !== -1) {
      const open = source.indexOf('{', index);
      let depth = 0;
      let end = open;
      for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        if (source[end] === '}' && --depth === 0) break;
      }
      blocks.push(source.slice(open + 1, end));
      index = source.indexOf('@keyframes', end);
    }
    return blocks;
  }

  it('الحركات بالتحريك والشفافية فقط (خفيفة على الجوال)', () => {
    const allowed = new Set(['transform', 'opacity', 'scale', 'rotate', 'translate']);
    const blocks = keyframeBlocks(css);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      for (const [, property] of block.matchAll(/([a-z-]+)\s*:/g)) {
        expect(allowed, `خاصية غير مسموحة في الحركة: ${property}`).toContain(property);
      }
    }
  });

  it('الحركة تتوقف عند تفعيل «تقليل الحركة»', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });
});
