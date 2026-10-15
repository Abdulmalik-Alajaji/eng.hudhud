import { describe, expect, it } from 'vitest';
import { findExternalUrls, hasStrictCsp, isIdentityChunk } from './build-checks.mjs';

describe('findExternalUrls', () => {
  it('يكتشف الروابط الخارجية بكل أشكالها', () => {
    const text = [
      '<link href="https://fonts.googleapis.com/css2?family=Cairo">',
      '<script src="//cdn.example.com/lib.js"></script>',
      '@font-face { src: url(//fonts.example.com/f.woff2) }',
      'fetch("http://api.example.com/stats")',
    ].join('\n');
    expect(findExternalUrls(text)).toHaveLength(4);
  });

  it('يتجاهل مساحات أسماء SVG والروابط الداخلية', () => {
    const text = [
      'document.createElementNS("http://www.w3.org/2000/svg", "svg")',
      '<script src="/eng.hudhud/assets/index.js"></script>',
      'url(./font.woff2)',
    ].join('\n');
    expect(findExternalUrls(text)).toEqual([]);
  });
});

describe('hasStrictCsp', () => {
  const page = (policy) =>
    `<head><meta http-equiv="Content-Security-Policy" content="${policy}"></head>`;

  it('يقبل سياسة تمنع الموارد الخارجية', () => {
    expect(hasStrictCsp(page("default-src 'self'; object-src 'none'"))).toBe(true);
  });

  it('يرفض الصفحة بلا سياسة أو بسياسة متساهلة', () => {
    expect(hasStrictCsp('<head></head>')).toBe(false);
    expect(hasStrictCsp(page("default-src 'self' 'unsafe-inline'"))).toBe(false);
    expect(hasStrictCsp(page('default-src *'))).toBe(false);
  });
});

describe('isIdentityChunk', () => {
  it('يتعرف على ملف الهوية فقط', () => {
    expect(isIdentityChunk('assets/hudhud-B-xa-0dm.js')).toBe(true);
    expect(isIdentityChunk('assets/main-Cv6d_Nhb.js')).toBe(false);
    expect(isIdentityChunk('assets/hudhud-DVxV1UPD.css')).toBe(false);
  });
});
