import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_TITLE } from '../app';

const PUBLIC = resolve(import.meta.dirname, '../../public');
const manifest = JSON.parse(readFileSync(resolve(PUBLIC, 'manifest.webmanifest'), 'utf8'));
const index = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

/** عرض صورة PNG وارتفاعها من ترويسة الملف. */
function pngSize(file: string): string {
  const data = readFileSync(file);
  return `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`;
}

describe('manifest.webmanifest', () => {
  it('عربي من اليمين لليسار باسم الموقع', () => {
    expect(manifest.name).toBe(APP_TITLE);
    expect(manifest.lang).toBe('ar');
    expect(manifest.dir).toBe('rtl');
  });

  it('يفتح الصفحة الرئيسية داخل مسار الموقع، كتطبيق بلا شريط المتصفح', () => {
    // مسارات نسبية: تعمل تحت /eng.hudhud/ على GitHub Pages.
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
  });

  it('بألوان الهوية: خلفية سوداء', () => {
    expect(manifest.background_color).toBe('#000000');
    expect(manifest.theme_color).toBe('#000000');
  });

  it('كل أيقونة موجودة ومقاسها كما هو مكتوب، ومنها أيقونة لأندرويد (maskable)', () => {
    for (const icon of manifest.icons) {
      const file = resolve(PUBLIC, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file), icon.src).toBe(icon.sizes);
    }
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('index.html', () => {
  it('يربط manifest وأيقونة الآيفون الموجودة', () => {
    expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(index).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(pngSize(resolve(PUBLIC, 'icons/apple-touch-icon.png'))).toBe('180x180');
  });
});
