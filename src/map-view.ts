/**
 * رسم خريطة طابق وعليها الطريق: صورة الخريطة داخل SVG واحد بإحداثيات الصورة نفسها،
 * فيمكن تكبير جزء منها (حول الطريق) بتغيير viewBox فقط. تستعمله واجهة الطلاب وصفحة تجربة المسارات.
 */
import type { Floor } from './data/types';
import { createHudhudShape } from './hudhud/hudhud';
import { HUDHUD_FEET, HUDHUD_HEIGHT, HUDHUD_WIDTH } from './hudhud/shape';
import type { GraphNode } from './route/graph';
import type { Leg } from './route/route';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type MapFloor = Pick<Floor, 'map' | 'width' | 'height'>;

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapView {
  root: HTMLElement;
  layer: SVGSVGElement;
  view: ViewBox;
  /** وحدات الخريطة لكل بكسل تقريباً على شاشة جوال، لتبقى الخطوط والعلامات بحجم ثابت مهما كُبّرت الخريطة. */
  unit: number;
}

/** عرض الخريطة على شاشة جوال تقريباً بالبكسل: أساس أحجام الخطوط والعلامات. */
const SCREEN_WIDTH = 340;
/** طول الهدهد عند الوجهة بالبكسل تقريباً. */
const DESTINATION_SIZE = 40;

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

export const mapUrl = (map: string): string => `${import.meta.env.BASE_URL}${map}`;

export const fullView = (floor: MapFloor): ViewBox => ({ x: 0, y: 0, w: floor.width, h: floor.height });

/** الخريطة (أو جزء منها) بطبقة رسم بإحداثيات الصورة. */
export function createMap(floor: MapFloor, label: string, view: ViewBox = fullView(floor)): MapView {
  const root = document.createElement('div');
  root.className = 'map';
  root.style.aspectRatio = `${view.w} / ${view.h}`;
  const layer = svg('svg', {
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    class: 'map__layer',
    role: 'img',
    'aria-label': label,
  });
  if (floor.map) {
    layer.append(svg('image', { href: mapUrl(floor.map), x: 0, y: 0, width: floor.width, height: floor.height }));
  }
  root.append(layer);
  return { root, layer, view, unit: view.w / SCREEN_WIDTH };
}

/**
 * الجزء من الخريطة الذي يُعرض للمقطع: الطريق كاملاً مع هامش ومكان للهدهد فوق الوجهة،
 * بنسبة عرض إلى ارتفاع معقولة للجوال، ولا يخرج عن حدود الصورة.
 */
export function routeView(leg: Pick<Leg, 'path' | 'width' | 'height'>, withDestination: boolean): ViewBox {
  const floor = { width: leg.width, height: leg.height };
  if (leg.path.length === 0) return fullView({ ...floor, map: null });
  const xs = leg.path.map((n) => n.x);
  const ys = leg.path.map((n) => n.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // أصغر جزء يُعرض: ثلث عرض الخريطة تقريباً، حتى لا يُكبَّر مقطع قصير أكثر من اللازم.
  const minW = Math.min(floor.width, Math.max(360, floor.width * 0.36));
  const unit = Math.max(maxX - minX + 120, minW) / SCREEN_WIDTH;
  if (withDestination) {
    const end = leg.path[leg.path.length - 1] as GraphNode;
    const h = DESTINATION_SIZE * unit;
    minY = Math.min(minY, end.y - h);
    minX = Math.min(minX, end.x - h * 0.6);
    maxX = Math.max(maxX, end.x + h * 0.6);
  }
  const pad = 30 * unit;
  let w = Math.max(maxX - minX + 2 * pad, minW);
  let h = Math.max(maxY - minY + 2 * pad, minW * 0.6);
  // النسبة بين 1:1 و16:9 (أعرض من الطول) حتى تبقى الخريطة مقروءة على الجوال.
  if (w / h > 16 / 9) h = (w * 9) / 16;
  if (w / h < 1) w = h;
  w = Math.min(w, floor.width);
  h = Math.min(h, floor.height);
  const clamp = (v: number, size: number, max: number): number => Math.max(0, Math.min(v, max - size));
  return {
    x: clamp((minX + maxX) / 2 - w / 2, w, floor.width),
    y: clamp((minY + maxY) / 2 - h / 2, h, floor.height),
    w,
    h,
  };
}

/** نقطة البداية: دائرة بسيطة. */
export function drawStart(map: MapView, x: number, y: number): void {
  map.layer.append(svg('circle', { cx: x, cy: y, r: 7 * map.unit, 'stroke-width': 3 * map.unit, class: 'map-start' }));
}

/** الوجهة: الهدهد الثابت، قدماه عند النقطة. */
export function drawDestination(map: MapView, x: number, y: number): void {
  const h = DESTINATION_SIZE * map.unit;
  const w = (h * HUDHUD_WIDTH) / HUDHUD_HEIGHT;
  const shape = createHudhudShape();
  for (const [key, value] of Object.entries({ x: x - HUDHUD_FEET.x * w, y: y - HUDHUD_FEET.y * h, width: w, height: h })) {
    shape.setAttribute(key, String(value));
  }
  shape.classList.add('map-destination');
  map.layer.append(shape);
}

/** خط الطريق للمقطع: البداية دائرة، والنهاية الهدهد (الوجهة) أو مربع (الدرج أو المصعد). */
export function drawLeg(map: MapView, leg: Pick<Leg, 'path'>, last: boolean): void {
  const points = leg.path.map((n) => `${n.x},${n.y}`).join(' ');
  map.layer.append(
    svg('polyline', { points, class: 'map-route__casing', 'stroke-width': 9 * map.unit }),
    svg('polyline', { points, class: 'map-route', 'stroke-width': 5 * map.unit }),
  );
  const first = leg.path[0];
  const end = leg.path[leg.path.length - 1];
  if (first) drawStart(map, first.x, first.y);
  if (end && last) {
    drawDestination(map, end.x, end.y);
  } else if (end) {
    const s = 7 * map.unit;
    map.layer.append(
      svg('rect', { x: end.x - s, y: end.y - s, width: 2 * s, height: 2 * s, rx: s / 3, 'stroke-width': 3 * map.unit, class: 'map-exit' }),
    );
  }
}

/** موضع النقر على الخريطة بإحداثيات الصورة. */
export function tapPosition(map: MapView, event: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = map.layer.getBoundingClientRect();
  return {
    x: Math.round(map.view.x + ((event.clientX - rect.left) / (rect.width || 1)) * map.view.w),
    y: Math.round(map.view.y + ((event.clientY - rect.top) / (rect.height || 1)) * map.view.h),
  };
}
