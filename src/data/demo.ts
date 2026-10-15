/**
 * البيانات التجريبية: كل عنصر تجريبي يحمل "demo": true.
 * ما دام في البيانات عنصر واحد بهذه العلامة، يظهر شريط «نسخة تجريبية».
 */

/** يبحث في أي عمق داخل البيانات عن عنصر فيه "demo": true (القيمة المنطقية فقط). */
export function containsDemo(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsDemo);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.demo === true) {
      return true;
    }
    return Object.values(record).some(containsDemo);
  }
  return false;
}

/** كل ملفات JSON داخل مجلد data/ تُضمَّن في الموقع وقت البناء. */
export function loadAllData(): unknown[] {
  const modules = import.meta.glob<unknown>('/data/**/*.json', {
    eager: true,
    import: 'default',
  });
  return Object.values(modules);
}
