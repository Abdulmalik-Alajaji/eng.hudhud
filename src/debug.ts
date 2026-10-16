/**
 * صفحة تجربة محرك المسارات للفريق (ليست واجهة الطلاب): اختر البداية والوجهة، فيُرسم الطريق
 * على خريطة كل طابق مع الشرح الكتابي. الاختيار يُحفظ في الرابط بعد # لمشاركته.
 */
import './styles/main.css';
import './styles/debug.css';
import { createDemoBanner } from './demo-banner';
import { loadDataset } from './data/dataset';
import { containsDemo, loadAllData } from './data/demo';
import { LEVEL_NAMES, LEVELS, type Floor, type Level } from './data/types';
import { createHudhud } from './hudhud/hudhud';
import { buildGraph } from './route/graph';
import { type Leg, type Start, type Target, findRoute, placeLabel } from './route/route';
import { distance } from './route/directions';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
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

function parseStart(value: string): Start | null {
  if (value.startsWith('tap:')) {
    const [, floor, x, y] = value.split(':');
    if (!floor || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) return null;
    return { floor, x: Number(x), y: Number(y) };
  }
  return value ? { place: value } : null;
}

function parseTarget(value: string): Target | null {
  if (value.startsWith('doctor:')) return { doctor: value.slice('doctor:'.length) };
  return value ? { place: value } : null;
}

const result = loadDataset();
const graph = result.dataset ? buildGraph(result.dataset) : null;
/** العدد بالعربية: خريطة واحدة، خريطتان، 3 خرائط. */
const mapCount = (n: number): string => (n === 1 ? 'خريطة واحدة' : n === 2 ? 'خريطتان' : `${n} خرائط`);
const mapUrl = (map: string): string => `${import.meta.env.BASE_URL}${map}`;

/** الخريطة مع طبقة رسم فوقها بإحداثيات الصورة نفسها. */
function mapView(floor: Pick<Floor, 'map' | 'width' | 'height'>, label: string): { root: HTMLElement; layer: SVGSVGElement } {
  const root = el('div', 'debug-map');
  root.style.aspectRatio = `${floor.width} / ${floor.height}`;
  if (floor.map) {
    const img = el('img', 'debug-map__image');
    img.src = mapUrl(floor.map);
    img.alt = label;
    root.append(img);
  }
  const layer = svg('svg', { viewBox: `0 0 ${floor.width} ${floor.height}`, class: 'debug-map__layer', 'aria-hidden': 'true' });
  root.append(layer);
  return { root, layer };
}

/** موضع عنصر HTML فوق الخريطة بالنسبة المئوية من إحداثيات الصورة. */
function pin(root: HTMLElement, node: HTMLElement, x: number, y: number, floor: { width: number; height: number }): void {
  node.style.left = `${(x / floor.width) * 100}%`;
  node.style.top = `${(y / floor.height) * 100}%`;
  root.append(node);
}

function legCard(leg: Leg, index: number, count: number, last: boolean): HTMLElement {
  const card = el('section', 'debug-card');
  card.append(el('h2', undefined, `${index + 1} من ${count}: ${LEVEL_NAMES[leg.level]} · ${distance(leg.meters)}`));

  const { root, layer } = mapView(leg, `خريطة ${LEVEL_NAMES[leg.level]}`);
  const points = leg.path.map((n) => `${n.x},${n.y}`).join(' ');
  layer.append(
    svg('polyline', { points, class: 'debug-route__casing' }),
    svg('polyline', { points, class: 'debug-route' }),
  );
  const first = leg.path[0];
  const end = leg.path[leg.path.length - 1];
  if (first) layer.append(svg('circle', { cx: first.x, cy: first.y, r: 13, class: 'debug-start' }));
  if (end && last) {
    const destination = createHudhud('still', 'الوجهة');
    destination.classList.add('debug-destination');
    pin(root, destination, end.x, end.y, leg);
  } else if (end) {
    layer.append(svg('rect', { x: end.x - 13, y: end.y - 13, width: 26, height: 26, rx: 6, class: 'debug-exit' }));
  }
  card.append(root);

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
    const { root: map, layer } = mapView(floor, `خريطة ${LEVEL_NAMES[tapLevel]}`);
    map.classList.add('debug-map--pick');
    map.addEventListener('click', (event) => {
      const rect = map.getBoundingClientRect();
      const x = Math.round(((event.clientX - rect.left) / rect.width) * floor.width);
      const y = Math.round(((event.clientY - rect.top) / rect.height) * floor.height);
      tap = `tap:${floor.id}:${x}:${y}`;
      update();
    });
    if (tap) {
      const [, , x, y] = tap.split(':');
      layer.append(svg('circle', { cx: Number(x), cy: Number(y), r: 13, class: 'debug-start' }));
    }
    picker.append(levels, map);
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
