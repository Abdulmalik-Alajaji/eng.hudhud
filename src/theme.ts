export type ThemeChoice = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'hudhud-theme';

export function readThemeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** auto يتبع إعداد الجهاز. الاختيار يُحفظ في هذا المتصفح فقط إن أمكن. */
export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // التخزين غير متاح (تصفح خاص مثلاً): الاختيار يبقى لهذه الزيارة فقط.
  }
}
