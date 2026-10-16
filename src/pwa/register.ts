/**
 * تسجيل الـ service worker (dist/sw.js، يُبنى من src/pwa/sw.js) ليعمل الموقع بدون نت بعد أول فتح.
 * في النسخة المنشورة فقط: خادم التطوير لا يبني sw.js، والحفظ فيه يُخفي التعديلات.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  // بعد تحميل الصفحة، حتى لا ينافس حفظ الملفات أول عرض للموقع.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // إن فشل التسجيل (متصفح قديم، أو وضع التصفح الخاص) يبقى الموقع يعمل بالنت كالمعتاد.
    });
  });
}
