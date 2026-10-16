import { beforeEach, describe, expect, it } from 'vitest';
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
