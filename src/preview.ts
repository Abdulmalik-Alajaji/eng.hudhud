import './styles/main.css';
import './styles/preview.css';
import { createHudhud, createHudhudShape, hudhudController, type HudhudOptions, type HudhudVariant } from './hudhud/hudhud';

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

  root.replaceChildren(header, grid);
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
