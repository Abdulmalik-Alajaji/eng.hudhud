import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const pages = readdirSync(ROOT).filter((name) => name.endsWith('.html'));
const viteConfig = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');

describe.each(pages)('%s', (page) => {
  const html = readFileSync(resolve(ROOT, page), 'utf8');
  const doc = new DOMParser().parseFromString(html, 'text/html');

  it('مسجّلة في PAGES داخل vite.config.ts حتى تُبنى وتُنشر', () => {
    expect(viteConfig).toContain(`'${page}'`);
  });

  it('عربية ومن اليمين لليسار', () => {
    expect(doc.documentElement.getAttribute('lang')).toBe('ar');
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('مهيأة لشاشة الجوال وحواف الآيفون', () => {
    const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
  });

  it('لا تحمّل أي مورد من الخارج', () => {
    const urls = [...doc.querySelectorAll('[src], [href]')].map(
      (el) => el.getAttribute('src') ?? el.getAttribute('href') ?? '',
    );
    for (const url of urls) {
      expect(url).not.toMatch(/^(https?:)?\/\//i);
    }
  });
});

it('توجد صفحة رئيسية', () => {
  expect(pages).toContain('index.html');
});
