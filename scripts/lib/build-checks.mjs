export const MAX_SITE_BYTES = 5 * 1024 * 1024;
/** حجم الهوية كاملة (كود الهدهد وبياناته) لا يتجاوز 150 كيلوبايت. */
export const MAX_IDENTITY_BYTES = 150 * 1024;

/** ملفات الهوية في البناء: assets/hudhud-*.js (الاسم مضبوط في vite.config.ts). */
export function isIdentityChunk(relativePath) {
  return /(^|[\\/])assets[\\/]hudhud-[\w-]+\.js$/.test(relativePath);
}

// معرّفات مساحات أسماء SVG/XML: نصوص ثابتة وليست طلبات شبكة.
const ALLOWED_URL_PREFIXES = ['http://www.w3.org/'];

/** يعيد كل رابط لموقع خارجي داخل النص (عدا المسموح). */
export function findExternalUrls(text) {
  const found = new Set();
  for (const match of text.matchAll(/\bhttps?:\/\/[^\s"'`)<>\\]+/gi)) {
    const url = match[0];
    if (!ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) found.add(url);
  }
  // روابط بلا بروتوكول مثل //cdn.example.com
  for (const match of text.matchAll(/(?:\b(?:src|href)\s*=\s*["']?|url\(\s*["']?)(\/\/[^\s"'`)<>]+)/gi)) {
    found.add(match[1]);
  }
  return [...found];
}

/** هل في الصفحة سياسة أمان صارمة تمنع الموارد الخارجية؟ */
export function hasStrictCsp(html) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/http-equiv\s*=\s*(["'])Content-Security-Policy\1/i.test(tag)) continue;
    const content = tag.match(/content\s*=\s*(["'])(.*?)\1/i);
    const policy = (content?.[2] ?? '').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
    return policy.includes("default-src 'self'") && !policy.includes("'unsafe-");
  }
  return false;
}
