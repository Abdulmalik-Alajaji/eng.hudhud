import './styles/main.css';
import './styles/preview.css';
import { createHudhud, createHudhudShape, hudhudController, type HudhudOptions, type HudhudVariant } from './hudhud/hudhud';
import { BEIGE, DARK_PALETTE, LIGHT_PALETTE, contrast, paletteVars, type HudhudPalette } from './hudhud/palette';

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

/** كل هدهد متحرك في الصفحة، ليمكن إيقافه عند لحظة محددة لالتقاط الصور (window.hudhudPreview). */
const animated: HTMLElement[] = [];

/** ?seed=رقم في الرابط يثبّت الحركة (للمقارنة ولالتقاط الصور). بدونه تختلف الحركة في كل زيارة. */
const fixedSeed = Number(new URLSearchParams(location.search).get('seed')) || undefined;

function hudhudCard(variant: HudhudVariant, title: string, note: string, options: HudhudOptions = {}): HTMLElement {
  const hudhud = createHudhud(variant, 'هدهد الهندسة', { seed: fixedSeed, ...options });
  animated.push(hudhud);
  return card(title, note, hudhud);
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

/** نسبة التباين مع البيج (أو مع لون آخر) وعلامة نجاحها. */
function contrastRow(label: string, color: string, background = BEIGE): HTMLElement {
  const row = el('div', 'compare-option__contrast');
  const ratio = contrast(color, background);
  row.append(el('dt', undefined, label), el('dd', undefined, `${ratio.toFixed(1)} ${ratio >= 3 ? '✓' : '✗'}`));
  return row;
}

/** الهدهد المعتمد (قوي) وعلامة الوجهة بألوان مظهر واحد، ونسب التباين إن وُجدت. */
function themeCard(
  title: string,
  note: string,
  palette: HudhudPalette,
  dark: boolean,
  contrasts: [string, string, string?][] = [],
): HTMLElement {
  const option = el('article', dark ? 'compare-option compare-option--dark' : 'compare-option');
  for (const [name, value] of Object.entries(paletteVars(palette))) {
    if (value) option.style.setProperty(name, value);
  }
  const hudhud = createHudhud('strong', 'هدهد الهندسة', { seed: fixedSeed });
  animated.push(hudhud);
  const stage = el('div', 'compare-option__stage');
  stage.append(hudhud);

  const marker = createHudhud('still', 'الوجهة');
  marker.classList.add('compare-option__marker');
  const still = el('div', 'compare-option__still');
  still.append(marker, el('span', undefined, 'الهدهد الثابت (ومع «تقليل الحركة»)'));

  option.append(el('h3', undefined, title), stage, el('p', 'compare-option__name', 'هدهد الهندسة'), still, el('p', 'compare-option__note', note));
  if (contrasts.length > 0) {
    const list = el('dl', 'compare-option__contrasts');
    list.append(...contrasts.map(([label, color, background]) => contrastRow(label, color, background)));
    option.append(el('p', 'compare-option__label', 'التباين مع البيج (المطلوب 3 على الأقل):'), list);
  }
  return option;
}

function themes(): HTMLElement {
  const section = el('section', 'compare');
  section.setAttribute('aria-labelledby', 'compare-title');
  const heading = el('h2', undefined, 'الهدهد في المظهرين');
  heading.id = 'compare-title';
  const options = el('div', 'compare__options');
  options.append(
    themeCard(
      'الفاتح (البيج)',
      'الخيار «أ» الذي اعتمده الفريق: هدهد قرفي برتقالي دافئ، وخطوط بنية داكنة على الذيل، وساقان بنيتان، وصواعق ذهبية كهرمانية.',
      LIGHT_PALETTE,
      false,
      [
        ['الهدهد', LIGHT_PALETTE.bird],
        ['الساقان', LIGHT_PALETTE.parts?.legs ?? LIGHT_PALETTE.bird],
        ['الخطوط على الذيل', LIGHT_PALETTE.stripes ?? LIGHT_PALETTE.bird, LIGHT_PALETTE.bird],
        ['قلب الصاعقة', LIGHT_PALETTE.bolt],
      ],
    ),
    themeCard('الداكن (الأساس)', 'هدهد أزرق سماوي، وصواعق زرقاء بتوهج أبيض.', DARK_PALETTE, true),
  );
  section.append(
    heading,
    el(
      'p',
      'compare__intro',
      'الطالب يبدّل بينهما بزر «فاتح/داكن». الخريطة تبقى داكنة في المظهرين، والهدهد عليها بألوان الداكن.',
    ),
    options,
  );
  return section;
}

function render(root: HTMLElement): void {
  const header = el('header', 'preview-header');
  header.append(
    el('h1', undefined, 'معاينة هوية هدهد الهندسة'),
    el(
      'p',
      undefined,
      'ينقر الأرض مرة إلى ثلاث، يرفع رأسه ويلتفت ويُفرد تاجه، ويتنفّس باستمرار. الصواعق تُرسم من جديد في كل مرة، ولا يتكرر شيء حرفياً بين دورة وأخرى. اعتمد الفريق درجة الصواعق القوية.',
    ),
  );

  const grid = el('main', 'preview-grid');
  grid.append(
    hudhudCard('strong', 'الهدهد المعتمد: قوي', '5 إلى 6 صواعق في الدورة، دفعات متتالية، فروع كثيرة، وتوهج وشرارات قوية.'),
    hudhudCard(
      'strong',
      'تفكيك الأجزاء',
      'كل جزء بلون: الساقان، الجسم، الذيل، الرأس، التاج. الدوائر البيضاء هي المفاصل. في الهدهد الحقيقي كلها بلون واحد ولا تظهر فواصل.',
      { debug: true, seed: 7 },
    ),
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

  root.replaceChildren(header, themes(), grid);
}

const root = document.getElementById('app');
if (root) render(root);

declare global {
  interface Window {
    hudhudPreview?: { seek(ms: number): void; play(): void };
  }
}
window.hudhudPreview = {
  seek: (ms) => animated.forEach((el) => hudhudController(el)?.seek(ms)),
  play: () => animated.forEach((el) => hudhudController(el)?.play()),
};
