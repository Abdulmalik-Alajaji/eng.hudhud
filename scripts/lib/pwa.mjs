// بناء sw.js (العمل بدون نت) من القالب src/pwa/sw.js وقائمة ملفات الموقع المبنية.
import { createHash } from 'node:crypto';

/** اسم ملف الـ service worker في الموقع المبني. */
export const SERVICE_WORKER = 'sw.js';

/** ملفات لا تُحفظ للعمل بدون نت: الـ service worker نفسه (المتصفح يديره)، وملفات source map. */
export function isPrecached(relativePath) {
  const path = relativePath.replaceAll('\\', '/');
  return path !== SERVICE_WORKER && !path.endsWith('.map');
}

/**
 * قائمة المسارات الكاملة المحفوظة، مرتبة ليكون الناتج ثابتاً.
 * @param {string[]} relativePaths مسارات الملفات داخل dist/
 * @param {string} base المسار الأساسي للموقع، مثل /eng.hudhud/
 */
export function precacheUrls(relativePaths, base) {
  return relativePaths
    .map((p) => p.replaceAll('\\', '/'))
    .filter(isPrecached)
    .sort()
    .map((p) => `${base}${p}`);
}

/**
 * رقم النسخة: يتغير إذا تغيّر أي ملف أو اسمه، فيحفظ المتصفح النسخة الجديدة.
 * @param {{ path: string, content: Uint8Array | string }[]} files
 */
export function cacheVersion(files) {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

/** يضع القيم مكان العلامات في القالب، ويفشل إذا بقيت علامة أو نقصت. */
export function renderServiceWorker(template, { version, base, urls }) {
  const values = {
    __HUDHUD_VERSION__: version,
    __HUDHUD_BASE__: base,
    __HUDHUD_PRECACHE__: JSON.stringify(urls, null, 2),
  };
  let output = template;
  for (const [mark, value] of Object.entries(values)) {
    if (!output.includes(mark)) throw new Error(`القالب لا يحتوي ${mark}`);
    output = output.replaceAll(mark, value);
  }
  return output;
}

/** المسارات المحفوظة داخل sw.js مبني (لفحص البناء). */
export function readPrecache(serviceWorker) {
  const match = serviceWorker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  return match ? JSON.parse(match[1]) : null;
}

/**
 * مشكلات العمل بدون نت في الموقع المبني (فارغة إذا كان كل شيء سليماً).
 * @param {{ files: string[], read: (path: string) => string, base: string }} build
 *   files: مسارات كل الملفات داخل dist/، وread يقرأ ملفاً منها.
 */
export function pwaProblems({ files, read, base }) {
  const problems = [];
  const paths = files.map((p) => p.replaceAll('\\', '/'));

  if (!paths.includes(SERVICE_WORKER)) {
    problems.push(`${SERVICE_WORKER} غير موجود: الموقع لن يعمل بدون نت (راجع pwaPlugin في vite.config.ts)`);
  } else {
    const urls = readPrecache(read(SERVICE_WORKER));
    if (!urls) {
      problems.push(`${SERVICE_WORKER}: لم أجد قائمة الملفات المحفوظة`);
    } else {
      const expected = precacheUrls(paths, base);
      for (const url of expected.filter((u) => !urls.includes(u))) {
        problems.push(`${SERVICE_WORKER}: الملف ${url} لا يُحفظ للعمل بدون نت`);
      }
      for (const url of urls.filter((u) => !expected.includes(u))) {
        problems.push(`${SERVICE_WORKER}: يحفظ ${url} وهو غير موجود في الموقع`);
      }
    }
  }

  if (!paths.includes('manifest.webmanifest')) {
    problems.push('manifest.webmanifest غير موجود: لا يمكن إضافة الموقع إلى الشاشة الرئيسية');
  } else {
    let manifest = null;
    try {
      manifest = JSON.parse(read('manifest.webmanifest'));
    } catch {
      problems.push('manifest.webmanifest: ليس JSON صحيحاً');
    }
    if (manifest) {
      for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
        if (!manifest[key]) problems.push(`manifest.webmanifest: الحقل ${key} ناقص`);
      }
      for (const icon of manifest.icons ?? []) {
        if (!paths.includes(icon.src)) problems.push(`manifest.webmanifest: الأيقونة ${icon.src} غير موجودة`);
      }
      const sizes = (manifest.icons ?? []).map((i) => i.sizes);
      if (!sizes.includes('192x192') || !sizes.includes('512x512')) {
        problems.push('manifest.webmanifest: تلزم أيقونتان بمقاس 192 و512 على الأقل');
      }
    }
  }

  if (paths.includes('index.html')) {
    const index = read('index.html');
    if (!/<link[^>]+rel="manifest"/.test(index)) problems.push('index.html: لا يربط manifest.webmanifest');
    const touch = index.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/)?.[1];
    if (!touch || !paths.includes(touch.replace(base, ''))) problems.push('index.html: أيقونة الآيفون (apple-touch-icon) غير موجودة');
  }
  return problems;
}
