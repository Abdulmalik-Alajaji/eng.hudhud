// أيقونات إضافة الموقع إلى الشاشة الرئيسية للجوال (public/icons/)، من شكل الهدهد في src/hudhud/shape.ts
// (المولَّد من صورة الفريق). الهدهد أزرق سماوي على خلفية سوداء، بلا أي رسم إضافي.
//
// أداة تُشغَّل يدوياً عند تغيير شكل الهدهد، وليست جزءاً من البناء. ترسم الأيقونات بمتصفح Chromium:
//     npm install --no-save playwright
//     node scripts/tools/make-icons.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'public/icons');
const BIRD = '#4fc3f7';
const BACKGROUND = '#000000';

const shape = readFileSync(resolve(ROOT, 'src/hudhud/shape.ts'), 'utf8');
const width = Number(shape.match(/HUDHUD_WIDTH = (\d+)/)?.[1]);
const height = Number(shape.match(/HUDHUD_HEIGHT = (\d+)/)?.[1]);
const path = shape.match(/HUDHUD_PATH =\s*'([^']+)'/)?.[1];
if (!width || !height || !path) throw new Error('لم أجد شكل الهدهد في src/hudhud/shape.ts');

/**
 * الأيقونات: fill نسبة أطول بُعد للهدهد من عرض الأيقونة.
 * maskable: أنظمة أندرويد تقص الأيقونة دائرة أو مربعاً مدوّراً، فالهدهد داخل المنطقة الآمنة (الدائرة الوسطى 80%).
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, fill: 0.78 },
  { file: 'icon-512.png', size: 512, fill: 0.78 },
  { file: 'icon-maskable-512.png', size: 512, fill: 0.6 },
  // آيفون يدوّر الزوايا بنفسه.
  { file: 'apple-touch-icon.png', size: 180, fill: 0.72 },
];

function iconSvg(size, fill) {
  const scale = (size * fill) / Math.max(width, height);
  const x = (size - width * scale) / 2;
  const y = (size - height * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
<path transform="translate(${x} ${y}) scale(${scale})" fill="${BIRD}" fill-rule="evenodd" d="${path}"/>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(`<style>html,body{margin:0;background:${BACKGROUND}}svg{display:block}</style>${iconSvg(icon.size, icon.fill)}`);
  await page.screenshot({ path: resolve(OUT, icon.file), omitBackground: false });
  console.log(`✓ public/icons/${icon.file}`);
}
await browser.close();
