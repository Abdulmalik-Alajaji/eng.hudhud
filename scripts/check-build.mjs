// يفحص النسخة المبنية في dist/ قبل النشر.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { MAX_IDENTITY_BYTES, MAX_SITE_BYTES, findExternalUrls, hasStrictCsp, isIdentityChunk } from './lib/build-checks.mjs';
import { pwaProblems } from './lib/pwa.mjs';

// المسار الأساسي للموقع على GitHub Pages (مثل BASE في vite.config.ts).
const BASE = '/eng.hudhud/';

const DIST = 'dist';
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt', '.xml']);

if (!existsSync(DIST)) {
  console.error('✗ مجلد dist غير موجود. شغّل npm run build أولاً.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk(DIST);
const problems = [];
let totalBytes = 0;
let identityBytes = 0;
let identityFiles = 0;

for (const file of files) {
  const rel = relative(DIST, file);
  const size = statSync(file).size;
  totalBytes += size;
  if (isIdentityChunk(rel)) {
    identityBytes += size;
    identityFiles++;
  }

  if (rel.split(sep).includes('materials')) {
    problems.push(`${rel}: ملف من materials/ وصل إلى الموقع المنشور`);
  }
  if (extname(file) === '.map') {
    problems.push(`${rel}: ملف source map لا يُنشر`);
  }

  const ext = extname(file);
  if (!TEXT_EXTENSIONS.has(ext)) continue;
  const text = readFileSync(file, 'utf8');

  for (const url of findExternalUrls(text)) {
    problems.push(`${rel}: رابط لموقع خارجي ${url}`);
  }
  if (ext === '.html' && !hasStrictCsp(text)) {
    problems.push(`${rel}: الصفحة بلا سياسة أمان (CSP) صارمة`);
  }
}

const identityKb = (identityBytes / 1024).toFixed(1);
if (identityFiles === 0) {
  problems.push('ملف الهوية assets/hudhud-*.js غير موجود: راجع codeSplitting في vite.config.ts');
} else if (identityBytes > MAX_IDENTITY_BYTES) {
  problems.push(`حجم الهوية ${identityKb} كيلوبايت ويتجاوز الحد (150 كيلوبايت)`);
}

problems.push(
  ...pwaProblems({
    files: files.map((file) => relative(DIST, file)),
    read: (path) => readFileSync(join(DIST, path), 'utf8'),
    base: BASE,
  }),
);

const sizeMb = (totalBytes / 1024 / 1024).toFixed(2);
if (totalBytes > MAX_SITE_BYTES) {
  problems.push(`حجم الموقع ${sizeMb} ميجا ويتجاوز الحد (5 ميجا)`);
}

if (problems.length > 0) {
  console.error('✗ فحص البناء فشل:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `✓ فحص البناء: ${files.length} ملف، الحجم ${sizeMb} ميجا من 5، الهوية ${identityKb} كيلوبايت من 150، لا روابط خارجية، والسياسة الأمنية موجودة، والموقع كله محفوظ للعمل بدون نت.`,
);
