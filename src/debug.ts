/**
 * صفحة تجربة محرك المسارات للفريق (ليست واجهة الطلاب): اختر البداية والوجهة، فيُرسم الطريق
 * على خريطة كل طابق مع الشرح الكتابي. الاختيار يُحفظ في الرابط بعد # لمشاركته.
 */
import './styles/main.css';
import './styles/map.css';
import './styles/debug.css';
import { createDemoBanner } from './demo-banner';
import { loadDataset } from './data/dataset';
import { containsDemo, loadAllData } from './data/demo';
import { LEVEL_NAMES, LEVELS, type Floor, type Level } from './data/types';
import { createMap, drawLeg, drawStart, tapPosition } from './map-view';
import { buildGraph } from './route/graph';
import { encodeTap, parseStart, parseTarget } from './route/link';
import { type Leg, findRoute, placeLabel } from './route/route';
import { distance } from './route/directions';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** الحالة في الرابط: #from=B1-G-EN1&to=doctor:d1&lift=1، أو from=tap:B1-G:400:470 للنقر على الخريطة. */
interface State {
  from: string;
  to: string;
  lift: boolean;
}

function readState(): State {
  const params = new URLSearchParams(location.hash.slice(1));
  return { from: params.get('from') ?? '', to: params.get('to') ?? '', lift: params.get('lift') === '1' };
}

function writeState(state: State): void {
  const params = new URLSearchParams({ from: state.from, to: state.to });
  if (state.lift) params.set('lift', '1');
  history.replaceState(null, '', `#${params.toString()}`);
}

const result = loadDataset();
const graph = result.dataset ? buildGraph(result.dataset) : null;
/** العدد بالعربية: خريطة واحدة، خريطتان، 3 خرائط. */
const mapCount = (n: number): string => (n === 1 ? 'خريطة واحدة' : n === 2 ? 'خريطتان' : `${n} خرائط`);
function legCard(leg: Leg, index: number, count: number, last: boolean): HTMLElement {
  const card = el('section', 'debug-card');
  card.append(el('h2', undefined, `${index + 1} من ${count}: ${LEVEL_NAMES[leg.level]} · ${distance(leg.meters)}`));

  // الخريطة كاملة (لا الجزء حول الطريق كما في واجهة الطلاب) ليرى الفريق الطريق في سياقه.
  const map = createMap(leg, `خريطة ${LEVEL_NAMES[leg.level]}`);
  drawLeg(map, leg, last);
  card.append(map.root);

  const list = el('ol', 'debug-steps');
  for (const step of leg.steps) list.append(el('li', undefined, step));
  card.append(list);
  return card;
}

function render(root: HTMLElement): void {
  root.replaceChildren();
  if (containsDemo(loadAllData())) root.append(createDemoBanner());

  const header = el('header', 'debug-header');
  header.append(
    el('h1', undefined, 'تجربة المسارات'),
    el('p', undefined, 'صفحة للفريق لتجربة محرك المسارات على البيانات التجريبية، وليست واجهة الطلاب. الدرج والمصعد لا يُحسبان في الأمتار.'),
  );
  const main = el('main', 'debug-main');
  root.append(header, main);

  if (!graph || !result.dataset) {
    main.append(el('p', 'debug-error', 'في البيانات أخطاء، فلا يمكن حساب الطريق:'));
    const list = el('ul', 'debug-error');
    for (const error of result.errors) list.append(el('li', undefined, error));
    main.append(list);
    return;
  }

  const state = readState();
  const floors = result.dataset.floors;
  const buildingName = new Map(result.dataset.buildings.map((b) => [b.id, b.name]));
  const floorLabel = (f: Floor): string => `${buildingName.get(f.building) ?? f.building} · ${LEVEL_NAMES[f.level]}`;

  const placeOptions = (select: HTMLSelectElement): void => {
    for (const floor of floors) {
      const group = el('optgroup');
      group.label = floorLabel(floor);
      const sorted = [...floor.places].sort((a, b) => Number(!!b.landmark) - Number(!!a.landmark) || a.id.localeCompare(b.id));
      for (const place of sorted) {
        const option = el('option', undefined, `${placeLabel(place)}${place.landmark ? ' ★' : ''}`);
        option.value = place.id;
        group.append(option);
      }
      select.append(group);
    }
  };

  const form = el('form', 'debug-form');
  form.addEventListener('submit', (e) => e.preventDefault());

  const fromSelect = el('select');
  fromSelect.id = 'debug-from';
  const tapOption = el('option', undefined, 'نقطة أنقر عليها في الخريطة');
  tapOption.value = 'tap';
  fromSelect.append(tapOption);
  placeOptions(fromSelect);

  const toSelect = el('select');
  toSelect.id = 'debug-to';
  const doctorsGroup = el('optgroup');
  doctorsGroup.label = 'الدكاترة';
  for (const doctor of result.dataset.doctors) {
    const option = el('option', undefined, `${doctor.name} (${doctor.office})`);
    option.value = `doctor:${doctor.id}`;
    doctorsGroup.append(option);
  }
  toSelect.append(doctorsGroup);
  placeOptions(toSelect);

  const lift = el('input');
  lift.type = 'checkbox';
  lift.id = 'debug-lift';

  const field = (label: string, control: HTMLElement, id: string): HTMLElement => {
    const wrap = el('div', 'debug-field');
    const text = el('label', undefined, label);
    text.htmlFor = id;
    wrap.append(text, control);
    return wrap;
  };
  const liftWrap = el('div', 'debug-check');
  const liftLabel = el('label', undefined, 'بالمصعد فقط (بدون درج)');
  liftLabel.htmlFor = 'debug-lift';
  liftWrap.append(lift, liftLabel);
  form.append(field('من', fromSelect, 'debug-from'), field('إلى', toSelect, 'debug-to'), liftWrap);

  const picker = el('section', 'debug-card debug-picker');
  const output = el('div', 'debug-output');
  main.append(form, picker, output);

  // القيم من الرابط، أو أمثلة افتراضية.
  const tapValue = state.from.startsWith('tap:') ? state.from : '';
  fromSelect.value = tapValue ? 'tap' : state.from || 'B1-G-EN1';
  if (!fromSelect.value) fromSelect.value = 'B1-G-EN1';
  toSelect.value = state.to || 'doctor:d1';
  if (!toSelect.value) toSelect.selectedIndex = 0;
  lift.checked = state.lift;
  let tap = tapValue;
  const firstFloorOf = (level: Level): Floor => floors.find((f) => f.level === level) as Floor;
  let tapLevel: Level = (tap ? floors.find((f) => f.id === tap.split(':')[1])?.level : undefined) ?? 'G';

  const drawPicker = (): void => {
    picker.replaceChildren();
    picker.hidden = fromSelect.value !== 'tap';
    if (picker.hidden) return;
    picker.append(el('h2', undefined, 'انقر على مكانك في الخريطة'));
    const levels = el('div', 'debug-levels');
    for (const level of LEVELS) {
      const button = el('button', level === tapLevel ? 'is-active' : undefined, LEVEL_NAMES[level]);
      button.type = 'button';
      button.addEventListener('click', () => {
        tapLevel = level;
        tap = '';
        update();
      });
      levels.append(button);
    }
    const floor = firstFloorOf(tapLevel);
    const map = createMap(floor, `خريطة ${LEVEL_NAMES[tapLevel]}`);
    map.root.classList.add('map--pick');
    map.root.addEventListener('click', (event) => {
      const { x, y } = tapPosition(map, event);
      tap = encodeTap(floor.id, x, y);
      update();
    });
    const start = parseStart(tap);
    if (start && 'x' in start) drawStart(map, start.x, start.y);
    picker.append(levels, map.root);
  };

  const update = (): void => {
    const from = fromSelect.value === 'tap' ? tap : fromSelect.value;
    writeState({ from, to: toSelect.value, lift: lift.checked });
    drawPicker();
    output.replaceChildren();
    const start = parseStart(from);
    const target = parseTarget(toSelect.value);
    if (!start || !target) {
      output.append(el('p', 'debug-note', 'انقر على الخريطة لتحديد نقطة البداية.'));
      return;
    }
    const found = findRoute(graph, start, target, { avoidStairs: lift.checked });
    if (!found.ok) {
      output.append(el('p', 'debug-error', found.reason));
      return;
    }
    const { route } = found;
    output.append(
      el('p', 'debug-summary', `المسافة ${distance(route.meters)} · ${mapCount(route.legs.length)}`),
      el('p', 'debug-note', `من ${route.start.label} إلى ${placeLabel(route.destination)}`),
    );
    route.legs.forEach((leg, i) => output.append(legCard(leg, i, route.legs.length, i === route.legs.length - 1)));
  };

  for (const control of [fromSelect, toSelect, lift]) control.addEventListener('change', update);
  update();
}

const root = document.getElementById('app');
if (root) render(root);
