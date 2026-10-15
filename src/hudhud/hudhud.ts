import './hudhud.css';
import { HUDHUD_FEET, HUDHUD_HEIGHT, HUDHUD_PATH, HUDHUD_WIDTH } from './shape';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * calm: صواعق هادئة. bright: صواعق أوضح مع شرر. still: بلا حركة (علامة الوجهة على الخريطة).
 */
export type HudhudVariant = 'calm' | 'bright' | 'still';

/** كل دورة تأتي الصاعقة من اتجاه مختلف بهذا الترتيب. */
export const BOLT_DIRECTIONS = ['top', 'right', 'left'] as const;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** الهدهد المصمت وحده، بلون النص الحالي (currentColor). */
export function createHudhudShape(): SVGSVGElement {
  const root = svg('svg', {
    viewBox: `0 0 ${HUDHUD_WIDTH} ${HUDHUD_HEIGHT}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  root.append(svg('path', { d: HUDHUD_PATH, fill: 'currentColor', 'fill-rule': 'evenodd' }));
  return root;
}

function createBolt(direction: (typeof BOLT_DIRECTIONS)[number]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `hudhud__bolt hudhud__bolt--${direction}`;
  const icon = svg('svg', { viewBox: '0 0 20 60', 'aria-hidden': 'true', focusable: 'false' });
  icon.append(svg('path', { d: 'M13 1 L5 27 L13 27 L7 59' }));
  wrap.append(icon);
  return wrap;
}

function createSparks(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'hudhud__sparks';
  const icon = svg('svg', { viewBox: '-10 -10 20 20', 'aria-hidden': 'true', focusable: 'false' });
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.PI / 6;
    const x1 = (Math.cos(angle) * 4).toFixed(2);
    const y1 = (Math.sin(angle) * 4).toFixed(2);
    const x2 = (Math.cos(angle) * 8).toFixed(2);
    const y2 = (Math.sin(angle) * 8).toFixed(2);
    icon.append(svg('path', { d: `M${x1} ${y1} L${x2} ${y2}` }));
  }
  wrap.append(icon);
  return wrap;
}

/**
 * الهدهد بهويته الكاملة: ينقر الأرض مرتين، يرفع رأسه، يلتفت، تضربه صاعقة خفيفة، ثم يعود للنقر.
 * كل الحركات CSS (تحريك وشفافية فقط)، وتتوقف عند تفعيل «تقليل الحركة».
 */
export function createHudhud(variant: HudhudVariant = 'calm', label = 'هدهد الهندسة'): HTMLElement {
  const root = document.createElement('div');
  root.className = `hudhud hudhud--${variant}`;
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', label);

  if (variant !== 'still') {
    const glow = document.createElement('div');
    glow.className = 'hudhud__glow';
    root.append(glow);
  }

  const bird = document.createElement('div');
  bird.className = 'hudhud__bird';
  // محور النقر والالتفات: القدمان.
  bird.style.transformOrigin = `${(HUDHUD_FEET.x * 100).toFixed(1)}% ${(HUDHUD_FEET.y * 100).toFixed(1)}%`;
  bird.append(createHudhudShape());
  root.append(bird);

  if (variant !== 'still') {
    root.append(...BOLT_DIRECTIONS.map(createBolt));
  }
  if (variant === 'bright') {
    root.append(createSparks());
  }

  return root;
}
