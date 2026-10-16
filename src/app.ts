/**
 * واجهة الطلاب: «أين أنت؟» (أقرب قاعة أو مرفق، أو نقرة على الخريطة، أو معلم)، ثم «إلى أين؟»
 * (رمز القاعة أو اسم الدكتور)، ثم الطريق: مقطع لكل خريطة طابق مع الشرح تحته وزر «التالي».
 * الطريق يُحفظ في الرابط بعد # (#from=…&to=…&lift=1&leg=2) فيعمل زر الرجوع في المتصفح وتمكن مشاركته.
 */
import { createDemoBanner } from './demo-banner';
import { LEVEL_NAMES, LEVELS, type Dataset, type Floor, type Level } from './data/types';
import { createHudhud } from './hudhud/hudhud';
import { createThemeToggle } from './theme';
import { createMap, drawLeg, drawStart, routeView, tapPosition } from './map-view';
import { distance } from './route/directions';
import { buildGraph } from './route/graph';
import { encodeTap, parseStart, parseTarget } from './route/link';
import { findRoute, type Leg, type Route } from './route/route';
import { createIndex, datasetEntries, placeEntry, search, type SearchEntry, type SearchIndex } from './search';

export const APP_TITLE = 'هدهد الهندسة';
export const APP_TAGLINE = 'دليلك إلى قاعات كلية الهندسة ومكاتبها ومرافقها';

export interface AppOptions {
  /** يوجد عنصر تجريبي واحد على الأقل في البيانات. */
  demo: boolean;
  /** البيانات بعد فحصها، أو null إذا كان فيها خطأ. */
  dataset: Dataset | null;
  /** يظهر أسفل شاشة الاختيار فقط، مثل بطاقة الإضافة إلى الشاشة الرئيسية (src/pwa/install.ts). */
  footer?: HTMLElement | null;
}

/** طريقة تحديد الموقع: أقرب قاعة أو مرفق (الأدق)، أو النقر على الخريطة، أو معلم من القائمة. */
export type Method = 'near' | 'map' | 'landmark';

const METHODS: { id: Method; label: string }[] = [
  { id: 'near', label: 'أقرب قاعة' },
  { id: 'map', label: 'الخريطة' },
  { id: 'landmark', label: 'معلم' },
];

/** ما اختاره الطالب: القيمة كما في الرابط، ونص يعرّفه بها. */
interface Choice {
  value: string;
  title: string;
  detail: string;
}

interface Planner {
  from: Choice | null;
  to: Choice | null;
  lift: boolean;
  method: Method;
  level: Level;
  fromQuery: string;
  toQuery: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/** «خريطة واحدة»، «خريطتان»، «3 خرائط». */
const mapCount = (n: number): string => (n === 1 ? 'خريطة واحدة' : n === 2 ? 'خريطتان' : `${n} خرائط`);

/** إزالة مستمعي النسخة السابقة إذا رُسمت الواجهة من جديد في العنصر نفسه. */
const cleanups = new WeakMap<HTMLElement, () => void>();

export function renderApp(root: HTMLElement, options: AppOptions): void {
  cleanups.get(root)?.();
  root.replaceChildren();
  if (options.demo) root.append(createDemoBanner());
  const view = el('div', 'view');
  root.append(view);

  // الهدهد المتحرك يُنشأ مرة واحدة ويُنقل بين الشاشات، فلا تبدأ حركته من جديد مع كل اختيار.
  const hero = el('header', 'hero');
  const hudhud = createHudhud('strong', APP_TITLE);
  hudhud.classList.add('hero__hudhud');
  hero.append(createThemeToggle(), hudhud, el('h1', 'hero__title', APP_TITLE), el('p', 'hero__tagline', APP_TAGLINE));

  const { dataset } = options;
  if (!dataset) {
    view.append(hero, el('p', 'notice notice--error', 'تعذّر تحميل بيانات الكلية. حاول لاحقاً.'));
    return;
  }

  const graph = buildGraph(dataset);
  const startEntries = datasetEntries(dataset);
  const targetEntries = datasetEntries(dataset, { doctors: true });
  const startIndex = createIndex(startEntries);
  const targetIndex = createIndex(targetEntries);
  const entryByValue = new Map([...startEntries, ...targetEntries].map((e) => [e.value, e]));
  const landmarks = dataset.floors.flatMap((f) => f.places.filter((p) => p.landmark).map((p) => placeEntry(dataset, p, f)));
  const floorOfLevel = (level: Level): Floor => dataset.floors.find((f) => f.level === level) as Floor;

  const planner: Planner = { from: null, to: null, lift: false, method: 'near', level: 'G', fromQuery: '', toQuery: '' };
  /** الرابط الذي تعرضه الشاشة الآن، حتى لا تُرسم مرتين حين يصل popstate وhashchange معاً. */
  let shown: string | null = null;
  /** وصل الطالب إلى الطريق من النموذج، فزر «عدّل» يرجع خطوة في سجل المتصفح بدل إضافة خطوة. */
  let fromForm = false;

  const choiceOf = (entry: SearchEntry): Choice => ({ value: entry.value, title: entry.title, detail: entry.detail });

  /** وصف قيمة من الرابط (عند فتح رابط طريق مباشرة). */
  const describe = (value: string): Choice | null => {
    const start = value.startsWith('tap:') ? parseStart(value) : null;
    if (start && 'floor' in start) {
      const floor = dataset.floors.find((f) => f.id === start.floor);
      return { value, title: 'نقطة اخترتها على الخريطة', detail: floor ? LEVEL_NAMES[floor.level] : '' };
    }
    const entry = entryByValue.get(value);
    return entry ? choiceOf(entry) : null;
  };

  const navigate = (hash: string, replace = false): void => {
    const url = `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`;
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    show();
  };

  const routeHash = (from: string, to: string, lift: boolean, leg = 1): string => {
    const params = new URLSearchParams({ from, to });
    if (lift) params.set('lift', '1');
    if (leg > 1) params.set('leg', String(leg));
    return params.toString();
  };

  const scrollTop = (): void => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // ---------- شاشة الاختيار ----------

  /** صندوق البحث: النتائج تتحدث مع الكتابة، وEnter يختار أول نتيجة. */
  const searchBox = (config: {
    id: string;
    label: string;
    placeholder: string;
    index: SearchIndex;
    query: string;
    onQuery: (q: string) => void;
    onPick: (entry: SearchEntry) => void;
  }): HTMLElement => {
    const form = el('form', 'search');
    form.setAttribute('role', 'search');
    const label = el('label', 'search__label', config.label);
    label.htmlFor = config.id;
    const input = el('input', 'search__input');
    input.id = config.id;
    input.type = 'search';
    input.placeholder = config.placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'search';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.value = config.query;
    const status = el('p', 'search__status');
    status.setAttribute('aria-live', 'polite');
    const list = el('ul', 'results');

    let found: SearchEntry[] = [];
    const update = (): void => {
      config.onQuery(input.value);
      found = search(config.index, input.value);
      list.replaceChildren();
      status.textContent = input.value.trim() && found.length === 0 ? 'لا نتائج. جرّب الرمز كاملاً أو جزءاً من الاسم.' : '';
      for (const entry of found) {
        const item = el('li');
        const pick = el('button', 'result');
        pick.type = 'button';
        pick.append(el('span', 'result__title', entry.title), el('span', 'result__detail', entry.detail));
        pick.addEventListener('click', () => config.onPick(entry));
        item.append(pick);
        list.append(item);
      }
    };
    input.addEventListener('input', update);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (found[0]) config.onPick(found[0]);
    });
    form.append(label, input, status, list);
    update();
    return form;
  };

  /** ما اختاره الطالب مع زر «غيّر». */
  const choiceRow = (choice: Choice, onChange: () => void): HTMLElement => {
    const row = el('div', 'choice');
    const text = el('div', 'choice__text');
    text.append(el('span', 'choice__title', choice.title), el('span', 'choice__detail', choice.detail));
    row.append(text, button('غيّر', 'btn btn--ghost', onChange));
    return row;
  };

  const step = (number: number, title: string): { section: HTMLElement; body: HTMLElement } => {
    const section = el('section', 'step');
    const heading = el('h2', 'step__title');
    heading.append(el('span', 'step__number', String(number)), document.createTextNode(title));
    const body = el('div', 'step__body');
    section.append(heading, body);
    return { section, body };
  };

  const plannerRoot = el('main', 'planner');

  const renderMapPicker = (body: HTMLElement): void => {
    const levels = el('div', 'levels');
    levels.setAttribute('role', 'group');
    levels.setAttribute('aria-label', 'الطابق');
    for (const level of LEVELS) {
      const choose = button(LEVEL_NAMES[level], 'levels__button', () => {
        planner.level = level;
        if (planner.from?.value.startsWith('tap:')) planner.from = null;
        renderPlanner();
      });
      choose.setAttribute('aria-pressed', String(level === planner.level));
      levels.append(choose);
    }
    const floor = floorOfLevel(planner.level);
    const map = createMap(floor, `خريطة ${LEVEL_NAMES[planner.level]}: انقر على مكانك`);
    map.root.classList.add('map--pick');
    map.root.addEventListener('click', (event) => {
      const { x, y } = tapPosition(map, event);
      planner.from = { value: encodeTap(floor.id, x, y), title: 'نقطة اخترتها على الخريطة', detail: LEVEL_NAMES[planner.level] };
      renderPlanner();
    });
    const start = planner.from ? parseStart(planner.from.value) : null;
    if (start && 'x' in start) drawStart(map, start.x, start.y);
    body.append(
      levels,
      el('p', 'hint', planner.from ? 'يمكنك النقر مرة أخرى لتعديل مكانك.' : 'اختر الطابق، ثم انقر على مكانك في الخريطة.'),
      map.root,
    );
  };

  const renderPlanner = (): void => {
    plannerRoot.replaceChildren();

    // 1. أين أنت؟
    const where = step(1, 'أين أنت الآن؟');
    if (planner.from) {
      where.body.append(
        choiceRow(planner.from, () => {
          planner.from = null;
          renderPlanner();
          document.getElementById('from-search')?.focus();
        }),
      );
    } else {
      const tabs = el('div', 'tabs');
      tabs.setAttribute('role', 'group');
      tabs.setAttribute('aria-label', 'طريقة تحديد مكانك');
      for (const method of METHODS) {
        const tab = button(method.label, 'tabs__button', () => {
          planner.method = method.id;
          renderPlanner();
        });
        tab.setAttribute('aria-pressed', String(method.id === planner.method));
        tabs.append(tab);
      }
      where.body.append(tabs);
    }
    if (planner.method === 'map') {
      renderMapPicker(where.body);
    } else if (!planner.from && planner.method === 'near') {
      where.body.append(
        searchBox({
          id: 'from-search',
          label: 'اكتب رمز أقرب قاعة حولك أو اسم مرفق قريب',
          placeholder: 'مثل B1-G105 أو المصلى',
          index: startIndex,
          query: planner.fromQuery,
          onQuery: (q) => (planner.fromQuery = q),
          onPick: (entry) => {
            planner.from = choiceOf(entry);
            renderPlanner();
          },
        }),
      );
    } else if (!planner.from && planner.method === 'landmark') {
      const list = el('ul', 'results results--landmarks');
      for (const entry of landmarks) {
        const item = el('li');
        const pick = el('button', 'result');
        pick.type = 'button';
        pick.append(el('span', 'result__title', entry.title), el('span', 'result__detail', entry.detail));
        pick.addEventListener('click', () => {
          planner.from = choiceOf(entry);
          renderPlanner();
        });
        item.append(pick);
        list.append(item);
      }
      where.body.append(el('p', 'hint', 'اختر أقرب معلم إليك.'), list);
    }

    // 2. إلى أين؟
    const whereTo = step(2, 'إلى أين؟');
    if (planner.to) {
      whereTo.body.append(
        choiceRow(planner.to, () => {
          planner.to = null;
          renderPlanner();
          document.getElementById('to-search')?.focus();
        }),
      );
    } else {
      whereTo.body.append(
        searchBox({
          id: 'to-search',
          label: 'اكتب رمز القاعة أو اسم الدكتور',
          placeholder: 'مثل B1-F215 أو اسم الدكتور',
          index: targetIndex,
          query: planner.toQuery,
          onQuery: (q) => (planner.toQuery = q),
          onPick: (entry) => {
            planner.to = choiceOf(entry);
            renderPlanner();
          },
        }),
      );
    }

    // المصعد فقط، ثم زر الطريق.
    const lift = el('input', 'check__input');
    lift.type = 'checkbox';
    lift.id = 'lift';
    lift.checked = planner.lift;
    lift.addEventListener('change', () => (planner.lift = lift.checked));
    const liftLabel = el('label', 'check__label', 'بالمصعد فقط (بدون درج)');
    liftLabel.htmlFor = 'lift';
    const check = el('div', 'check');
    check.append(lift, liftLabel);

    const ready = planner.from !== null && planner.to !== null;
    const go = button('اعرض الطريق', 'btn btn--primary btn--wide', () => {
      if (!planner.from || !planner.to) return;
      fromForm = true;
      navigate(routeHash(planner.from.value, planner.to.value, planner.lift));
    });
    go.disabled = !ready;
    const actions = el('div', 'actions');
    actions.append(check, go);
    if (!ready) actions.append(el('p', 'hint', 'اختر مكانك ووجهتك أولاً.'));

    plannerRoot.append(where.section, whereTo.section, actions);
  };

  const showForm = (): void => {
    view.replaceChildren(hero, plannerRoot, ...(options.footer ? [options.footer] : []));
    renderPlanner();
  };

  // ---------- شاشة الطريق ----------

  const legSection = (route: Route, index: number, onLeg: (i: number) => void): HTMLElement => {
    const leg = route.legs[index] as Leg;
    const count = route.legs.length;
    const last = index === count - 1;
    const section = el('section', 'leg');
    section.setAttribute('aria-labelledby', 'leg-title');

    const head = el('div', 'leg__head');
    const title = el('h2', 'leg__title', LEVEL_NAMES[leg.level]);
    title.id = 'leg-title';
    title.tabIndex = -1;
    head.append(title);
    if (count > 1) head.append(el('span', 'leg__count', `الخريطة ${index + 1} من ${count}`));
    section.append(head, el('p', 'leg__distance', distance(leg.meters)));

    const map = createMap(leg, `خريطة ${LEVEL_NAMES[leg.level]} وعليها الطريق`, routeView(leg, last));
    drawLeg(map, leg, last);
    section.append(map.root);

    const steps = el('ol', 'directions');
    for (const text of leg.steps) steps.append(el('li', undefined, text));
    section.append(steps);

    const nav = el('div', 'leg__nav');
    if (index > 0) nav.append(button('السابق', 'btn btn--ghost', () => onLeg(index - 1)));
    if (!last) {
      const next = route.legs[index + 1] as Leg;
      nav.append(button(`التالي: ${LEVEL_NAMES[next.level]}`, 'btn btn--primary', () => onLeg(index + 1)));
    } else {
      nav.append(
        button('وجهة جديدة من هنا', 'btn btn--primary', () => {
          const here = entryByValue.get(route.destination.id);
          planner.from = here ? choiceOf(here) : null;
          planner.method = 'near';
          planner.to = null;
          planner.toQuery = '';
          fromForm = false;
          navigate('');
        }),
      );
    }
    section.append(nav);
    return section;
  };

  const showRoute = (params: URLSearchParams): void => {
    const fromValue = params.get('from') ?? '';
    const toValue = params.get('to') ?? '';
    const lift = params.get('lift') === '1';
    // رابط مفتوح مباشرة: نملأ النموذج بما فيه حتى يعمل زر «عدّل».
    planner.from = describe(fromValue) ?? planner.from;
    planner.to = describe(toValue) ?? planner.to;
    planner.lift = lift;
    if (fromValue.startsWith('tap:')) {
      planner.method = 'map';
      const floor = dataset.floors.find((f) => f.id === fromValue.split(':')[1]);
      if (floor) planner.level = floor.level;
    } else if (planner.method === 'map') {
      planner.method = 'near';
    }

    const bar = el('header', 'topbar');
    const home = el('a', 'topbar__brand');
    home.href = '#';
    const mark = createHudhud('still', '');
    mark.removeAttribute('role');
    mark.removeAttribute('aria-label');
    mark.classList.add('topbar__mark');
    home.append(mark, el('span', undefined, APP_TITLE));
    const edit = button('عدّل', 'btn btn--ghost', () => {
      if (fromForm) history.back();
      else navigate('');
    });
    const actions = el('div', 'topbar__actions');
    actions.append(createThemeToggle(), edit);
    bar.append(home, actions);

    const main = el('main', 'route');
    view.replaceChildren(bar, main);

    const start = parseStart(fromValue);
    const target = parseTarget(toValue);
    const found = start && target ? findRoute(graph, start, target, { avoidStairs: lift }) : null;
    if (!found || !found.ok) {
      main.append(
        el('p', 'notice notice--error', found ? found.reason : 'الرابط غير مكتمل: اختر مكانك ووجهتك من جديد.'),
        button('عدّل الطريق', 'btn btn--primary btn--wide', () => edit.click()),
      );
      return;
    }
    const { route } = found;

    const summary = el('section', 'summary');
    summary.setAttribute('aria-label', 'ملخص الطريق');
    const rows = el('dl', 'summary__rows');
    const row = (term: string, value: string): void => {
      const wrap = el('div', 'summary__row');
      wrap.append(el('dt', undefined, term), el('dd', undefined, value));
      rows.append(wrap);
    };
    row('من', planner.from?.title ?? route.start.label);
    row('إلى', planner.to?.title ?? route.destination.id);
    summary.append(rows, el('p', 'summary__total', `المسافة ${distance(route.meters)} · ${mapCount(route.legs.length)}`));
    if (lift) summary.append(el('p', 'summary__note', 'بالمصعد فقط، بدون درج'));

    const legIndex = Math.min(Math.max(Number(params.get('leg') ?? '1') - 1, 0), route.legs.length - 1) || 0;
    const onLeg = (i: number): void => {
      navigate(routeHash(fromValue, toValue, lift, i + 1), true);
      scrollTop();
      document.getElementById('leg-title')?.focus({ preventScroll: true });
    };
    main.append(summary, legSection(route, legIndex, onLeg));
  };

  // ---------- التنقل ----------

  const show = (): void => {
    const hash = location.hash.slice(1);
    if (hash === shown) return;
    const firstShow = shown === null;
    shown = hash;
    const params = new URLSearchParams(hash);
    if (params.get('from') && params.get('to')) {
      showRoute(params);
    } else {
      showForm();
    }
    if (!firstShow) scrollTop();
  };

  const onHistory = (): void => show();
  window.addEventListener('popstate', onHistory);
  window.addEventListener('hashchange', onHistory);
  cleanups.set(root, () => {
    window.removeEventListener('popstate', onHistory);
    window.removeEventListener('hashchange', onHistory);
  });
  show();
}
