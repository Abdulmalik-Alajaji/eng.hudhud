/**
 * المظهر: الداكن هو الأساس (الهوية المعتمدة)، والفاتح بلون البيج اختياري (طلب الفريق، الجلسة الرابعة).
 * الاختيار يُحفظ في متصفح الطالب، ويُطبَّق على واجهة الطلاب فقط (صفحات الفريق داكنة دائماً).
 * الألوان نفسها في src/styles/main.css تحت [data-theme='light'].
 */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'hudhud-theme';

/** لون شريط المتصفح في الجوال لكل مظهر (يطابق --bg). */
const THEME_COLOR: Record<Theme, string> = { dark: '#000000', light: '#f4ecdc' };

export function getTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // التصفح الخاص قد يمنع الحفظ: يتغير المظهر الآن ويعود داكناً في الفتح التالي.
  }
  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();
const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(theme: Theme): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  // يُعرض رمز المظهر الذي سينتقل إليه الزر: شمس للفاتح، وهلال للداكن.
  path.setAttribute(
    'd',
    theme === 'dark'
      ? 'M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'
      : 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  );
  svg.append(path);
  return svg;
}

/** زر صغير يبدّل بين الداكن والفاتح. */
export function createThemeToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  const render = (): void => {
    const current = getThemeFromDocument();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    const label = next === 'light' ? 'فاتح' : 'داكن';
    button.replaceChildren(icon(current), document.createTextNode(label));
    button.setAttribute('aria-label', `المظهر ${label}`);
  };
  button.addEventListener('click', () => setTheme(getThemeFromDocument() === 'dark' ? 'light' : 'dark'));
  listeners.add(render);
  render();
  return button;
}

/** المظهر المطبَّق الآن على الصفحة. */
function getThemeFromDocument(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
