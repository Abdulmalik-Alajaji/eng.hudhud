import './styles/main.css';
import './styles/preview.css';
import { createHudhud, createHudhudShape, type HudhudVariant } from './hudhud/hudhud';
import { applyThemeChoice, readThemeChoice, type ThemeChoice } from './theme';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: 'تلقائي' },
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'داكن' },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function card(title: string, note: string, ...content: HTMLElement[]): HTMLElement {
  const section = el('section', 'preview-card');
  const stage = el('div', 'preview-card__stage');
  stage.append(...content);
  section.append(el('h2', undefined, title), stage, el('p', 'preview-card__note', note));
  return section;
}

function hudhudCard(variant: HudhudVariant, title: string, note: string): HTMLElement {
  return card(title, note, createHudhud(variant));
}

function themeSwitcher(): HTMLElement {
  const group = el('div', 'theme-switch');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'المظهر');
  const buttons = THEMES.map(({ value, label }) => {
    const button = el('button', undefined, label);
    button.type = 'button';
    button.addEventListener('click', () => {
      applyThemeChoice(value);
      sync(value);
    });
    return { value, button };
  });
  const sync = (current: ThemeChoice) => {
    for (const { value, button } of buttons) {
      button.setAttribute('aria-pressed', String(value === current));
    }
  };
  group.append(...buttons.map((b) => b.button));
  sync(readThemeChoice());
  return group;
}

function mapSample(): HTMLElement {
  const map = el('div', 'map-sample');
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', 'مثال: مسار على الخريطة ينتهي بالهدهد عند الوجهة');
  const route = el('div', 'map-sample__route');
  const start = el('div', 'map-sample__start');
  const destination = createHudhud('still', 'الوجهة');
  destination.classList.add('map-sample__destination');
  map.append(route, start, destination);
  return map;
}

function iconSizes(): HTMLElement {
  const row = el('div', 'icon-sizes');
  for (const size of [16, 32, 64]) {
    const box = el('div', `icon-sizes__box icon-sizes__box--${size}`);
    box.append(createHudhudShape());
    row.append(box);
  }
  return row;
}

function render(root: HTMLElement): void {
  applyThemeChoice(readThemeChoice());

  const header = el('header', 'preview-header');
  header.append(
    el('h1', undefined, 'معاينة هوية هدهد الهندسة'),
    el(
      'p',
      undefined,
      'الحركة: ينقر الأرض مرتين، يرفع رأسه، يلتفت، ثم تضربه صاعقة خفيفة. تأتي الصاعقة كل مرة من اتجاه: الأعلى ثم اليمين ثم اليسار. الدورة 8 ثوانٍ وتتكرر.',
    ),
    themeSwitcher(),
  );

  const grid = el('main', 'preview-grid');
  grid.append(
    hudhudCard('calm', 'الخيار أ: صواعق هادئة', 'صاعقة رفيعة ووهج خفيف.'),
    hudhudCard('bright', 'الخيار ب: صواعق أوضح', 'صاعقة أعرض ووهج أقوى وشرر صغير عند التاج.'),
    card(
      'علامة الوجهة على الخريطة',
      'نقطة البداية دائرة بسيطة، والوجهة هي الهدهد المصمت. الخريطة هنا رسم توضيحي فقط.',
      mapSample(),
    ),
    card(
      'مع «تقليل الحركة»',
      'من يفعّل «تقليل الحركة» في جواله يرى الهدهد ثابتاً بلا صواعق.',
      createHudhud('still'),
    ),
    card('أيقونة المتصفح', 'بأحجام 16 و32 و64 بكسل.', iconSizes()),
  );

  root.replaceChildren(header, grid);
}

const root = document.getElementById('app');
if (root) render(root);
