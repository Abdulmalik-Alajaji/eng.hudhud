import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheVersion, isPrecached, precacheUrls, pwaProblems, readPrecache, renderServiceWorker } from './pwa.mjs';

const BASE = '/eng.hudhud/';
const TEMPLATE = readFileSync(resolve(import.meta.dirname, '../../src/pwa/sw.js'), 'utf8');

describe('precacheUrls', () => {
  it('كل الملفات بمساراتها الكاملة ومرتبة، عدا sw.js وsource maps', () => {
    expect(precacheUrls(['index.html', 'assets/a.js', 'sw.js', 'assets/a.js.map', 'maps\\x.svg'], BASE)).toEqual([
      '/eng.hudhud/assets/a.js',
      '/eng.hudhud/index.html',
      '/eng.hudhud/maps/x.svg',
    ]);
    expect(isPrecached('sw.js')).toBe(false);
  });
});

describe('cacheVersion', () => {
  const files = [
    { path: 'index.html', content: '<p>1</p>' },
    { path: 'a.js', content: 'x' },
  ];

  it('ثابت لنفس الملفات بأي ترتيب', () => {
    expect(cacheVersion(files)).toBe(cacheVersion([...files].reverse()));
    expect(cacheVersion(files)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('يتغير إذا تغيّر محتوى ملف أو اسمه', () => {
    expect(cacheVersion([files[0], { path: 'a.js', content: 'y' }])).not.toBe(cacheVersion(files));
    expect(cacheVersion([files[0], { path: 'b.js', content: 'x' }])).not.toBe(cacheVersion(files));
  });
});

describe('renderServiceWorker', () => {
  const urls = ['/eng.hudhud/index.html', '/eng.hudhud/assets/a.js'];
  const sw = renderServiceWorker(TEMPLATE, { version: 'abc123', base: BASE, urls });

  it('يضع النسخة والمسار والقائمة مكان كل العلامات', () => {
    expect(sw).not.toMatch(/__HUDHUD_\w+__/);
    expect(sw).toContain("const VERSION = 'abc123';");
    expect(sw).toContain(`const BASE = '${BASE}';`);
    expect(readPrecache(sw)).toEqual(urls);
  });

  it('الناتج JavaScript صحيح', () => {
    expect(() => new Function(sw)).not.toThrow();
  });

  it('يفشل إذا نقصت علامة من القالب', () => {
    expect(() => renderServiceWorker('const VERSION = 1;', { version: 'a', base: BASE, urls })).toThrow('__HUDHUD_');
  });
});

describe('pwaProblems', () => {
  const manifest = JSON.stringify({
    name: 'هدهد الهندسة',
    short_name: 'هدهد',
    start_url: './',
    display: 'standalone',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192' },
      { src: 'icons/icon-512.png', sizes: '512x512' },
    ],
  });
  const index = '<link rel="manifest" href="/eng.hudhud/manifest.webmanifest"><link rel="apple-touch-icon" href="/eng.hudhud/icons/apple-touch-icon.png">';
  const site = ['index.html', 'assets/a.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
  const build = (files, overrides = {}) => {
    const contents = {
      'sw.js': renderServiceWorker(TEMPLATE, { version: 'v', base: BASE, urls: precacheUrls(site, BASE) }),
      'manifest.webmanifest': manifest,
      'index.html': index,
      ...overrides,
    };
    return pwaProblems({ files, read: (p) => contents[p] ?? '', base: BASE });
  };

  it('لا مشكلات في موقع سليم', () => {
    expect(build([...site, 'sw.js'])).toEqual([]);
  });

  it('sw.js غير موجود', () => {
    expect(build(site).join()).toContain('sw.js غير موجود');
  });

  it('ملف جديد في الموقع لا يحفظه sw.js، وملف محفوظ غير موجود', () => {
    expect(build([...site, 'sw.js', 'assets/new.js']).join()).toContain('/eng.hudhud/assets/new.js لا يُحفظ');
    expect(build([...site.filter((f) => f !== 'assets/a.js'), 'sw.js']).join()).toContain('يحفظ /eng.hudhud/assets/a.js وهو غير موجود');
  });

  it('أيقونة في manifest غير موجودة، أو manifest تالف', () => {
    expect(build([...site.filter((f) => f !== 'icons/icon-512.png'), 'sw.js']).join()).toContain('icons/icon-512.png غير موجودة');
    expect(build([...site, 'sw.js'], { 'manifest.webmanifest': '{' }).join()).toContain('ليس JSON');
  });

  it('index.html لا يربط manifest أو أيقونة الآيفون', () => {
    const problems = build([...site, 'sw.js'], { 'index.html': '<p></p>' }).join();
    expect(problems).toContain('لا يربط manifest');
    expect(problems).toContain('apple-touch-icon');
  });
});
