/**
 * المسودة: التعديلات تُحفظ في هذا المتصفح تلقائياً، فلا تضيع إذا أُغلقت الصفحة قبل التنزيل.
 * تبقى في هذا الجهاز وهذا المتصفح فقط، والنسخة الاحتياطية تنقلها إلى جهاز آخر.
 */
import type { Dataset } from '../data/types';

export const DRAFT_KEY = 'hudhud-admin-draft';

export interface Draft {
  /** بصمة البيانات المنشورة حين بدأت المسودة (fingerprint في model.ts). */
  base: string;
  savedAt: string;
  data: Dataset;
}

function isDraft(value: unknown): value is Draft {
  const draft = value as Draft | null;
  return Boolean(draft && typeof draft.base === 'string' && draft.data && Array.isArray(draft.data.floors));
}

export function loadDraft(): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as unknown;
    return isDraft(value) ? value : null;
  } catch {
    return null;
  }
}

/** يعيد false إذا تعذّر الحفظ (التصفح الخاص، أو امتلاء المساحة). */
export function saveDraft(base: string, data: Dataset): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ base, savedAt: new Date().toISOString(), data }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // لا شيء: المسودة لم تُحفظ أصلاً.
  }
}

/** النسخة الاحتياطية: ملف يُنزَّل ثم يُستورد في جهاز آخر أو يُرسل لعضو آخر في الفريق. */
export function backupText(base: string, data: Dataset): string {
  return `${JSON.stringify({ base, savedAt: new Date().toISOString(), data })}\n`;
}

export function parseBackup(text: string): Draft | null {
  try {
    const value = JSON.parse(text) as unknown;
    return isDraft(value) ? value : null;
  } catch {
    return null;
  }
}

/** تنزيل ملف من المتصفح نفسه (بلا خادم). */
export function download(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
