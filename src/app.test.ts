import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_TITLE, landmarkCount, renderApp } from './app';
import { loadDataset } from './data/dataset';
import { DEMO_BANNER_TEXT } from './demo-banner';

const dataset = loadDataset().dataset;

function click(root: HTMLElement, selector: string, text?: string): void {
  const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
  const target = text === undefined ? nodes[0] : nodes.find((n) => n.textContent?.includes(text));
  if (!target) throw new Error(`لم أجد ${selector} ${text ?? ''}`);
  target.click();
}

function type(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`لم أجد ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

const hashParams = (): URLSearchParams => new URLSearchParams(location.hash.slice(1));

describe('renderApp', () => {
  let root: HTMLElement;

  beforeEach(() => {
    history.replaceState(null, '', '/');
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => {
    // يزيل مستمعي الصفحة قبل الاختبار التالي.
    renderApp(root, { demo: false, dataset: null });
    root.remove();
  });

  it('يعرض عنوان الموقع والهدهد المتحرك بالدرجة المعتمدة (قوي)', () => {
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('h1')?.textContent).toBe(APP_TITLE);
    const hudhud = root.querySelector('.hudhud');
    expect(hudhud?.classList.contains('hudhud--strong')).toBe(true);
    expect(hudhud?.getAttribute('aria-label')).toBe(APP_TITLE);
  });

  it('يعرض شريط النسخة التجريبية في الأعلى عند وجود بيانات تجريبية', () => {
    renderApp(root, { demo: true, dataset });
    const banner = root.firstElementChild;
    expect(banner?.classList.contains('demo-banner')).toBe(true);
    expect(banner?.textContent).toBe(DEMO_BANNER_TEXT);
  });

  it('لا يعرض الشريط عند عدم وجود بيانات تجريبية', () => {
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('.demo-banner')).toBeNull();
  });

  it('إعادة الرسم لا تكرر المحتوى', () => {
    renderApp(root, { demo: true, dataset });
    renderApp(root, { demo: true, dataset });
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelectorAll('.demo-banner')).toHaveLength(1);
  });

  it('زر المظهر في الصفحة الرئيسية وفي شاشة الطريق', () => {
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('.hero .theme-toggle')).not.toBeNull();
    history.replaceState(null, '', '/#from=B1-G-EN1&to=B1-G-CAF');
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('.topbar .theme-toggle')).not.toBeNull();
  });

  it('رسالة واضحة إذا تعذّر تحميل البيانات', () => {
    renderApp(root, { demo: false, dataset: null });
    expect(root.querySelector('.notice--error')?.textContent).toContain('تعذّر');
  });

  it('يعرض طرق تحديد المكان الثلاث، والبحث بأقرب قاعة أولاً', () => {
    renderApp(root, { demo: false, dataset });
    const tabs = [...root.querySelectorAll('.tabs__button')].map((t) => t.textContent);
    expect(tabs).toEqual(['أقرب قاعة', 'الخريطة', 'معلم']);
    expect(root.querySelector('#from-search')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('.actions .btn--primary')?.disabled).toBe(true);
  });

  it('من معلم إلى دكتور: يعرض الطريق ومقطعاً لكل طابق مع «التالي» و«السابق»', () => {
    renderApp(root, { demo: false, dataset });
    click(root, '.tabs__button', 'معلم');
    click(root, '.results--landmarks .result', 'المدخل الرئيسي');
    expect(root.querySelector('.choice__title')?.textContent).toBe('المدخل الرئيسي');

    type(root, '#to-search', 'احمد');
    expect(root.querySelector('.result__title')?.textContent).toBe('د. أحمد التجريبي');
    click(root, '.result');
    click(root, '.actions .btn--primary');

    expect(hashParams().get('from')).toBe('B1-G-EN1');
    expect(hashParams().get('to')).toBe('doctor:d1');
    expect(root.querySelector('.summary')?.textContent).toContain('د. أحمد التجريبي');
    expect(root.querySelector('.summary__total')?.textContent).toMatch(/م \(نحو \d+ خطو/);
    expect(root.querySelector('.leg__title')?.textContent).toBe('الطابق الأرضي');
    expect(root.querySelector('.leg__count')?.textContent).toBe('الخريطة 1 من 2');
    expect(root.querySelectorAll('.directions li').length).toBeGreaterThan(1);
    expect(root.querySelector('.leg .map-route')).not.toBeNull();
    expect(root.querySelector('.leg .map-exit')).not.toBeNull();

    click(root, '.leg__nav .btn--primary', 'التالي: الطابق الأول');
    expect(hashParams().get('leg')).toBe('2');
    expect(root.querySelector('.leg__title')?.textContent).toBe('الطابق الأول');
    expect(root.querySelector('.leg .map-destination')).not.toBeNull();
    expect(root.querySelector('.directions li:last-child')?.textContent).toContain('وصلت إلى');

    click(root, '.leg__nav .btn', 'السابق');
    expect(hashParams().get('leg')).toBeNull();
    expect(root.querySelector('.leg__title')?.textContent).toBe('الطابق الأرضي');
  });

  it('بحث المعالم يصفّي القائمة أثناء الكتابة بلا فروق الهمزات والتاء المربوطة', () => {
    renderApp(root, { demo: false, dataset });
    click(root, '.tabs__button', 'معلم');
    const all = root.querySelectorAll('.results--landmarks .result').length;
    expect(all).toBeGreaterThan(3);
    const input = root.querySelector<HTMLInputElement>('#landmark-search');
    expect(input?.labels?.[0]?.textContent).toBe('ابحث في المعالم');
    expect(input?.getAttribute('aria-controls')).toBe('landmark-list');

    type(root, '#landmark-search', 'مكتبه');
    const titles = [...root.querySelectorAll('.results--landmarks .result__title')].map((t) => t.textContent);
    expect(titles).toEqual(['المكتبة']);
    const status = root.querySelector('#landmark-status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('معلم واحد');

    // «مدخل» جزء من «المدخل الرئيسي» و«المدخل الشرقي» و«مدخل المبنى 2»، والمسافات الزائدة لا تؤثر.
    type(root, '#landmark-search', '  مدخل ');
    expect(root.querySelectorAll('.results--landmarks .result').length).toBe(3);
    expect(status?.textContent).toBe('3 معالم');
  });

  it('بحث المعالم بلا تطابق: «لا يوجد معلم بهذا الاسم» والقائمة كاملة تحته، والاختيار يعمل', () => {
    renderApp(root, { demo: false, dataset });
    click(root, '.tabs__button', 'معلم');
    const all = root.querySelectorAll('.results--landmarks .result').length;
    type(root, '#landmark-search', 'مسبح');
    expect(root.querySelector('#landmark-status')?.textContent).toBe('لا يوجد معلم بهذا الاسم');
    expect(root.querySelectorAll('.results--landmarks .result').length).toBe(all);
    type(root, '#landmark-search', '');
    expect(root.querySelector('#landmark-status')?.textContent).toBe('');
    type(root, '#landmark-search', 'كافتيريا');
    click(root, '.results--landmarks .result', 'الكافتيريا');
    expect(root.querySelector('.choice__title')?.textContent).toBe('الكافتيريا');
  });

  it('عدد المعالم بقواعد العدد العربية', () => {
    expect([1, 2, 3, 10, 11, 100].map(landmarkCount)).toEqual(['معلم واحد', 'معلمان', '3 معالم', '10 معالم', '11 معلماً', '100 معلماً']);
  });

  it('رمز القاعة بأحرف صغيرة وEnter يختار أول نتيجة', () => {
    renderApp(root, { demo: false, dataset });
    type(root, '#from-search', 'b1g101');
    root.querySelector<HTMLFormElement>('#from-search')?.form?.requestSubmit();
    expect(root.querySelector('.choice__title')?.textContent).toContain('B1-G101');
  });

  it('نص لا يطابق شيئاً يعرض «لا نتائج»', () => {
    renderApp(root, { demo: false, dataset });
    type(root, '#to-search', 'مسبح');
    const status = root.querySelector('#to-search')?.closest('form')?.querySelector('.search__status');
    expect(status?.textContent).toContain('لا نتائج');
  });

  it('رابط طريق مفتوح مباشرة يعرض الطريق، و«عدّل» يرجع للنموذج بالاختيارات نفسها', () => {
    history.replaceState(null, '', '/#from=B1-G-EN1&to=B1-S-LIB&lift=1');
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('.summary__note')?.textContent).toContain('بالمصعد فقط');
    expect(root.textContent).not.toContain('بالدرج');

    click(root, '.topbar .btn', 'عدّل');
    expect(location.hash).toBe('');
    const chosen = [...root.querySelectorAll('.choice__title')].map((c) => c.textContent);
    expect(chosen).toEqual(['المدخل الرئيسي', 'المكتبة']);
    expect(root.querySelector<HTMLInputElement>('#lift')?.checked).toBe(true);
  });

  it('«وجهة جديدة من هنا» تجعل الوجهة السابقة نقطة البداية', () => {
    history.replaceState(null, '', '/#from=B1-G-EN1&to=B1-G-CAF');
    renderApp(root, { demo: false, dataset });
    click(root, '.leg__nav .btn--primary', 'وجهة جديدة من هنا');
    expect(root.querySelector('.choice__title')?.textContent).toBe('الكافتيريا');
    expect(root.querySelector('#to-search')).not.toBeNull();
  });

  it('بداية بنقرة على الخريطة من الرابط', () => {
    history.replaceState(null, '', '/#from=tap:B1-F:500:400&to=B1-F202');
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('.summary')?.textContent).toContain('نقطة اخترتها على الخريطة');
    expect(root.querySelector('.leg .map-destination')).not.toBeNull();
  });

  it('رابط فيه وجهة غير موجودة يعرض السبب', () => {
    history.replaceState(null, '', '/#from=B1-G-EN1&to=B9-X1');
    renderApp(root, { demo: false, dataset });
    expect(root.querySelector('.notice--error')?.textContent).toContain('غير موجودة');
  });
});

describe('renderApp: ما يظهر أسفل شاشة الاختيار', () => {
  it('يظهر أسفل النموذج ويختفي في شاشة الطريق', () => {
    history.replaceState(null, '', '/');
    const root = document.createElement('div');
    document.body.append(root);
    const footer = document.createElement('section');
    footer.className = 'install';
    renderApp(root, { demo: false, dataset, footer });
    expect(root.querySelector('.view')?.lastElementChild).toBe(footer);
    history.replaceState(null, '', '/#from=B1-G-EN1&to=B1-G-CAF');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(root.querySelector('.install')).toBeNull();
    renderApp(root, { demo: false, dataset: null });
    root.remove();
  });
});
