import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { contrast } from './hudhud/palette';
import { THEME_KEY, applyTheme, createThemeToggle, getTheme } from './theme';

describe('المظهر', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.replaceChildren();
    for (const [name, content] of [['theme-color', '#000000'], ['color-scheme', 'dark']]) {
      const meta = document.createElement('meta');
      meta.name = name as string;
      meta.content = content as string;
      document.head.append(meta);
    }
    applyTheme('dark');
  });

  it('الداكن هو الأساس (الهوية المعتمدة)', () => {
    expect(getTheme()).toBe('dark');
  });

  it('الزر يبدّل إلى الفاتح ويحفظه، ثم يعود إلى الداكن', () => {
    const toggle = createThemeToggle();
    expect(toggle.textContent).toBe('فاتح');
    toggle.click();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(getTheme()).toBe('light');
    expect(toggle.textContent).toBe('داكن');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f4ecdc');
    toggle.click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#000000');
  });

  it('كل الأزرار في الصفحة تتحدث معاً', () => {
    const a = createThemeToggle();
    const b = createThemeToggle();
    a.click();
    expect(b.textContent).toBe('داكن');
    expect(b.getAttribute('aria-label')).toBe('المظهر داكن');
  });

  it('قيمة غير معروفة في المتصفح تعني الداكن', () => {
    localStorage.setItem(THEME_KEY, 'blue');
    expect(getTheme()).toBe('dark');
  });
});

describe('ألوان المظهر الفاتح', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'styles/main.css'), 'utf8');
  const start = css.indexOf(":root[data-theme='light'] {");
  const block = css.slice(start, css.indexOf('}', start));
  const color = (name: string): string => new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(block)?.[1] ?? '';

  it('الأزرار والروابط بلون دافئ يتسق مع الهدهد، لا بالأزرق (طلب الفريق)', () => {
    expect(color('--accent')).toBe('#9c5220');
  });

  it('النص بلون الأزرار يُقرأ على البيج والبطاقات، والنص الأبيض يُقرأ على الأزرار (4.5 على الأقل)', () => {
    for (const background of [color('--bg'), color('--surface')]) {
      expect(contrast(color('--accent'), background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color('--text'), background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color('--muted'), background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(color('--on-accent'), color('--accent'))).toBeGreaterThanOrEqual(4.5);
  });
});
