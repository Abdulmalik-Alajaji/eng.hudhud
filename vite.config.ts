import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

// اسم المستودع على GitHub Pages: الموقع يُنشر تحت هذا المسار.
const BASE = '/eng.hudhud/';

// كل صفحة HTML منفصلة تُضاف هنا (لاحقاً: admin.html).
// لا نستخدم مسارات مثل /admin لأن GitHub Pages يعطي 404 عند فتحها مباشرة.
const PAGES = {
  main: resolve(import.meta.dirname, 'index.html'),
  preview: resolve(import.meta.dirname, 'preview.html'),
  debug: resolve(import.meta.dirname, 'debug.html'),
};

// سياسة الأمان: المتصفح يرفض أي مورد من خارج الموقع.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// تُحقن وقت البناء فقط: في التطوير المحلي تحتاج أداة Vite إلى أنماط مضمّنة تمنعها هذه السياسة.
function cspPlugin(): Plugin {
  return {
    name: 'hudhud-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [cspPlugin()],
  build: {
    target: ['es2022', 'safari15', 'chrome100'],
    sourcemap: false,
    rolldownOptions: {
      input: PAGES,
      output: {
        // الهوية (الهدهد) في ملف مستقل حتى يُقاس حجمها: scripts/check-build.mjs يفرض ألا تتجاوز 150 كيلوبايت.
        codeSplitting: {
          groups: [{ name: 'hudhud', test: /[\\/]src[\\/]hudhud[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
