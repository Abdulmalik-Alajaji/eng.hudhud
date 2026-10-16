/*
 * هدهد الهندسة يعمل بدون نت بعد أول فتح.
 *
 * هذا قالب: لا يُستورد في الموقع. وقت البناء يقرأه vite.config.ts ويضع مكان العلامات
 * (الكلمات بين شرطتين سفليتين مزدوجتين) رقم النسخة والمسار الأساسي وقائمة كل ملفات
 * الموقع المبنية، ثم يكتبه في dist/sw.js (انظر scripts/lib/pwa.mjs).
 *
 * الطريقة:
 * - أول فتح: يحفظ كل ملفات الموقع (نحو ربع ميجا) في ذاكرة المتصفح.
 * - بعدها: كل طلب يُجاب من المحفوظ أولاً، فيعمل الموقع بلا نت وبسرعة على شبكة ضعيفة.
 * - عند نشر نسخة جديدة يتغير رقم النسخة، فيحفظ المتصفح النسخة الجديدة في الخلفية،
 *   وتظهر في الفتح التالي. لا تُعاد تحميل صفحة مفتوحة حتى لا يضيع على الطالب ما يقرؤه.
 * - صفحات الفريق (الإدارة وتجربة المسارات والمعاينة) تُطلب من النت أولاً، والمحفوظ بلا نت فقط:
 *   صفحة الإدارة يجب أن تعرض آخر بيانات منشورة، وإلا عدّل الفريق نسخة قديمة وألغى برفعها تعديلاً دُمج.
 */

const VERSION = '__HUDHUD_VERSION__';
const BASE = '__HUDHUD_BASE__';
/** كل ملفات الموقع بمساراتها الكاملة، مثل /eng.hudhud/index.html. */
const PRECACHE = __HUDHUD_PRECACHE__;
const PREFIX = 'hudhud-';
/** صفحات تُطلب من النت أولاً (انظر أعلاه). */
const NETWORK_FIRST = ['admin.html', 'debug.html', 'preview.html'];
const CACHE = `${PREFIX}${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: 'reload' يتجاوز ذاكرة المتصفح العادية، حتى لا تُحفظ صفحة قديمة مع ملفات جديدة.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // نحذف النسخ القديمة ونبقي السابقة مباشرة: صفحة مفتوحة من النسخة السابقة
      // قد تطلب ملفاً منها (خط مثلاً) بعد التحديث، وهو لم يعد موجوداً على الخادم.
      const old = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== CACHE);
      await Promise.all(old.slice(0, -1).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  event.respondWith(respond(request, url));
});

async function respond(request, url) {
  const navigate = request.mode === 'navigate';
  // الصفحة تُعرف بمسارها فقط: ما بعد ? لا يغيّرها، وما بعد # (الطريق) لا يصل إلى هنا أصلاً.
  const key = navigate ? (url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname) : request;
  const options = { ignoreSearch: navigate };
  const cache = await caches.open(CACHE);
  if (navigate && NETWORK_FIRST.some((page) => url.pathname === `${BASE}${page}`)) {
    try {
      return await fetch(request);
    } catch {
      // بلا نت: المحفوظ أدناه.
    }
  }
  // النسخة الحالية أولاً، ثم السابقة (لصفحة مفتوحة منها).
  const cached = (await cache.match(key, options)) ?? (await caches.match(key, options));
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (error) {
    // بلا نت وصفحة غير محفوظة: الصفحة الرئيسية أفضل من صفحة خطأ المتصفح.
    if (navigate) {
      const home = await cache.match(`${BASE}index.html`);
      if (home) return home;
    }
    throw error;
  }
}
