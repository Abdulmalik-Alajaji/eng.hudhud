import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('index.html', () => {
  it('عربي ومن اليمين لليسار', () => {
    expect(doc.documentElement.getAttribute('lang')).toBe('ar');
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('مهيأ لشاشة الجوال وحواف الآيفون', () => {
    const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
  });

  it('لا يحمّل أي مورد من الخارج', () => {
    const urls = [...doc.querySelectorAll('[src], [href]')].map(
      (el) => el.getAttribute('src') ?? el.getAttribute('href') ?? '',
    );
    for (const url of urls) {
      expect(url).not.toMatch(/^(https?:)?\/\//i);
    }
  });
});
