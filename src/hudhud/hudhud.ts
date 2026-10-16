import './hudhud.css';
import type { Level } from './cycle';
import type { Matrix } from './rig';
import { HUDHUD_HEIGHT, HUDHUD_PATH, HUDHUD_WIDTH } from './shape';
import { HudhudScene, SCENE, SCENE_HEIGHT, SCENE_WIDTH } from './scene';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** دقة الرسم القصوى (ضعف دقة الشاشة)، وتنخفض تلقائياً إذا كان الجهاز بطيئاً. */
const PIXEL_RATIOS = [2, 1.5, 1] as const;
/** إذا زاد متوسط زمن الإطار عن هذا الحد (ملّي ثانية) على مدى ثانية، نخفض الدقة درجة. */
const SLOW_FRAME = 18;

/**
 * calm/medium/strong: الهدهد المتحرك بدرجات الصواعق، والمعتمدة strong (اختيار الفريق).
 * still: ثابت (علامة الوجهة على الخريطة).
 */
export type HudhudVariant = Level | 'still';

export interface HudhudOptions {
  /** بذرة العشوائية: نفس البذرة = نفس الحركة (للاختبار والمعاينة). */
  seed?: number;
  /** يرسم كل جزء بلون مع مفاصله. */
  debug?: boolean;
}

export interface HudhudController {
  readonly running: boolean;
  /** إيقاف يدوي (يبقى متوقفاً حتى play). */
  pause(): void;
  play(): void;
  /** يرسم لحظة محددة (ملّي ثانية من البداية) ويبقى متوقفاً عندها. */
  seek(ms: number): void;
}

const controllers = new WeakMap<HTMLElement, HudhudController>();

export function hudhudController(element: HTMLElement): HudhudController | undefined {
  return controllers.get(element);
}

/** الهدهد المصمت وحده، بلون النص الحالي (currentColor). */
export function createHudhudShape(): SVGSVGElement {
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', `0 0 ${HUDHUD_WIDTH} ${HUDHUD_HEIGHT}`);
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', HUDHUD_PATH);
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  root.append(path);
  return root;
}

function prefersReducedMotion(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
}

/**
 * الهدهد بهويته: ينقر ويلتفت ويتنفّس، وتضربه صواعق زرقاء بتوهج أبيض.
 * يتوقف حين تكون الصفحة في الخلفية أو حين يخرج من الشاشة، ويظهر ثابتاً مع «تقليل الحركة».
 */
export function createHudhud(
  variant: HudhudVariant = 'strong',
  label = 'هدهد الهندسة',
  options: HudhudOptions = {},
): HTMLElement {
  const root = document.createElement('div');
  root.className = `hudhud hudhud--${variant}`;
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', label);

  if (variant === 'still') {
    root.append(createHudhudShape());
    return root;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'hudhud__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // الـ canvas أوسع من الهدهد حتى تأتي الصواعق من بعيد ويظهر الوميض حوله.
  canvas.style.left = `${(SCENE.left / HUDHUD_WIDTH) * 100}%`;
  canvas.style.top = `${(SCENE.top / HUDHUD_HEIGHT) * 100}%`;
  canvas.style.width = `${(SCENE_WIDTH / HUDHUD_WIDTH) * 100}%`;
  canvas.style.height = `${(SCENE_HEIGHT / HUDHUD_HEIGHT) * 100}%`;
  root.append(canvas);

  const scene = new HudhudScene(variant, options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

  let time = 0;
  let frame = 0;
  let lastNow = 0;
  let visible = true;
  let onScreen = true;
  let manualPause = false;
  let colors: { bird: string; bolt: string; halo: string } | null = null;
  const reduced = prefersReducedMotion();
  let quality = PIXEL_RATIOS.findIndex((r) => r <= (window.devicePixelRatio || 1));
  if (quality < 0) quality = PIXEL_RATIOS.length - 1;
  let slowSum = 0;
  let slowCount = 0;

  const draw = () => {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIOS[quality] as number);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!colors) {
      const style = getComputedStyle(root);
      colors = {
        bird: style.getPropertyValue('--hudhud-color').trim() || '#4fc3f7',
        bolt: style.getPropertyValue('--bolt-color').trim() || '#4d9dff',
        halo: style.getPropertyValue('--bolt-halo').trim() || '#ffffff',
      };
    }
    const k = width / SCENE_WIDTH;
    const view: Matrix = [k, 0, 0, k, -SCENE.left * k, -SCENE.top * k];
    scene.render(ctx, time, view, ratio / k, colors, options.debug);
  };

  const shouldRun = () => visible && onScreen && !manualPause && !reduced?.matches;

  const tick = (now: number) => {
    frame = 0;
    if (!shouldRun()) return;
    // بعد التوقف لا نقفز: نكمل من حيث توقفنا.
    const dt = lastNow ? Math.min(now - lastNow, 100) : 16;
    lastNow = now;
    time += dt;
    // جهاز بطيء: نخفض دقة الرسم درجة (ولا نرفعها مرة أخرى) حتى تبقى الحركة ناعمة.
    slowSum += dt;
    slowCount++;
    if (slowCount === 60) {
      if (slowSum / slowCount > SLOW_FRAME && quality < PIXEL_RATIOS.length - 1) quality++;
      slowSum = 0;
      slowCount = 0;
    }
    draw();
    frame = requestAnimationFrame(tick);
  };

  const update = () => {
    if (shouldRun()) {
      if (!frame) {
        lastNow = 0;
        frame = requestAnimationFrame(tick);
      }
    } else {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      slowSum = 0;
      slowCount = 0;
      if (reduced?.matches) {
        // «تقليل الحركة»: الهدهد ثابت في وضعه الطبيعي بلا صواعق.
        time = 0;
        draw();
      }
    }
  };

  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState !== 'hidden';
    update();
  });
  reduced?.addEventListener?.('change', update);

  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (!onScreen || reduced?.matches) draw();
      update();
    }).observe(root);
  } else {
    queueMicrotask(update);
  }
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => draw()).observe(root);
  }

  controllers.set(root, {
    get running() {
      return frame !== 0;
    },
    pause() {
      manualPause = true;
      update();
    },
    play() {
      manualPause = false;
      update();
    },
    seek(ms: number) {
      manualPause = true;
      update();
      time = ms;
      draw();
    },
  });

  return root;
}
