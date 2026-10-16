import { validateData, type ValidationResult } from './validate';

/** كل ملفات JSON داخل مجلد data/ تُضمَّن في الموقع وقت البناء، بمساراتها مثل /data/floors/B1-G.json. */
export function loadDataFiles(): Record<string, unknown> {
  return import.meta.glob<unknown>('/data/**/*.json', { eager: true, import: 'default' });
}

/** بيانات الكلية بعد فحصها. اختبار validate.test.ts يضمن ألا تصل للموقع بيانات فيها خطأ. */
export function loadDataset(): ValidationResult {
  return validateData(loadDataFiles());
}
