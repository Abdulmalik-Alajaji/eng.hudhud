/**
 * «أضف هدهد الهندسة إلى شاشتك الرئيسية»: بطاقة صغيرة أسفل الصفحة الرئيسية (طلب الفريق).
 * - أندرويد (Chrome وما يشبهه): زر يفتح نافذة الإضافة من المتصفح نفسه (beforeinstallprompt).
 * - الآيفون: لا يسمح Safari بزر كهذا، فنكتب الخطوات.
 * - غيرهما: خطوات عامة من قائمة المتصفح.
 * لا تظهر إذا فُتح الموقع من الشاشة الرئيسية، أو بعد الإضافة، أو بعد أن يخفيها الطالب.
 */

/** حدث المتصفح قبل نافذة الإضافة (Chrome وEdge وSamsung Internet). ليس في أنواع TypeScript القياسية. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios' | 'other';

/** يُحفظ في المتصفح بعد «إخفاء» حتى لا تعود البطاقة. */
export const HIDDEN_KEY = 'hudhud-install-hidden';

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((listener) => listener());

/**
 * يلتقط حدث الإضافة من المتصفح. يُستدعى مبكراً (في main.ts) لأن الحدث قد يصل قبل رسم الصفحة.
 */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // نمنع شريط المتصفح التلقائي، ونعرض زرنا بدله.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

/** فُتح الموقع من الشاشة الرئيسية (كتطبيق)، فلا حاجة للبطاقة. */
export function isStandalone(): boolean {
  const media = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  return media || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** آيفون أو آيباد (الآيباد الحديث يعرّف نفسه كجهاز ماك بشاشة لمس). */
export function isIos(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints ?? 0): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1);
}

export function currentPlatform(): InstallPlatform {
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : 'other';
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(): void {
  try {
    localStorage.setItem(HIDDEN_KEY, '1');
  } catch {
    // التصفح الخاص قد يمنع الحفظ: تختفي البطاقة الآن وقد تعود في الفتح التالي.
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function steps(items: string[]): HTMLOListElement {
  const list = el('ol', 'install__steps');
  for (const item of items) list.append(el('li', undefined, item));
  return list;
}

/** خطوات الإضافة لكل نوع من المتصفحات (حين لا يتوفر زر). */
export const INSTALL_STEPS: Record<Exclude<InstallPlatform, 'prompt'>, string[]> = {
  ios: [
    'افتح الموقع في Safari.',
    'اضغط زر المشاركة (مربع يخرج منه سهم للأعلى) أسفل الشاشة.',
    'اختر «إضافة إلى الشاشة الرئيسية»، ثم اضغط «إضافة».',
  ],
  other: [
    'افتح قائمة المتصفح (⋮ أو ☰).',
    'اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».',
  ],
};

/**
 * البطاقة، أو null إذا لم تكن لازمة. تتحدث وحدها حين يصل حدث الإضافة من المتصفح أو تتم الإضافة.
 * platform للاختبار فقط.
 */
export function createInstallHint(platform?: () => InstallPlatform): HTMLElement | null {
  if (isStandalone() || readHidden()) return null;
  const which = platform ?? currentPlatform;

  const card = el('section', 'install');
  card.setAttribute('aria-labelledby', 'install-title');

  const render = (): void => {
    card.replaceChildren();
    if (installed) {
      card.hidden = true;
      return;
    }
    const title = el('h2', 'install__title', 'أضف هدهد الهندسة إلى شاشتك الرئيسية');
    title.id = 'install-title';
    card.append(title, el('p', 'install__text', 'يُفتح كتطبيق بلمسة، ويعمل بدون نت.'));

    const current = which();
    const actions = el('div', 'install__actions');
    if (current === 'prompt') {
      const add = el('button', 'btn btn--primary', 'أضفه الآن');
      add.type = 'button';
      add.addEventListener('click', async () => {
        const event = deferred;
        if (!event) return;
        deferred = null;
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') installed = true;
        render();
      });
      actions.append(add);
    } else {
      card.append(steps(INSTALL_STEPS[current]));
    }
    const hide = el('button', 'btn btn--ghost', 'إخفاء');
    hide.type = 'button';
    hide.addEventListener('click', () => {
      writeHidden();
      card.remove();
      listeners.delete(render);
    });
    actions.append(hide);
    card.append(actions);
  };

  listeners.add(render);
  render();
  return card;
}

/** للاختبارات: يعيد الحالة كما عند فتح الصفحة. */
export function resetInstallState(): void {
  deferred = null;
  installed = false;
  listeners.clear();
}

/** للاختبارات: كأن المتصفح أرسل حدث الإضافة. */
export function simulateInstallPrompt(event: InstallPromptEvent): void {
  deferred = event;
  notify();
}
