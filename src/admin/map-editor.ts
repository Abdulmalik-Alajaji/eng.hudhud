/**
 * محرر خريطة الطابق في صفحة الإدارة: النقاط والممرات والأماكن فوق صورة الخريطة.
 * - «تحديد ونقل»: انقر نقطة أو ممراً لتعديله، واسحب النقطة لنقلها.
 * - «إضافة نقاط»: كل نقرة تضيف نقطة، وتُربط بالنقطة المحددة بممر مستقيم (أفقي أو رأسي).
 * - «ربط بممر»: انقر نقطتين لربطهما.
 * الإحداثيات بالبكسل على صورة الخريطة، والأمتار يكتبها الفريق من قياسه.
 */
import type { Dataset, Floor, Point } from '../data/types';
import { mapUrl, svg, tapPosition, type MapView } from '../map-view';
import { addCorridor, addPoint, corridorProblem, straighten } from './model';
import type { Editor } from './model';

export type Mode = 'select' | 'point' | 'corridor';

export type Selection = { type: 'point'; id: string } | { type: 'corridor'; from: string; to: string } | null;

export interface MapState {
  floorId: string;
  mode: Mode;
  selection: Selection;
  /** أول نقطة في «ربط بممر». */
  pending: string | null;
  /** تكبير الخريطة: 1 = بعرض الشاشة. */
  zoom: number;
  showLabels: boolean;
  /** صور خرائط اختارها الفريق من جهازه (للعرض هنا فقط حتى يرفعها)، حسب مسار الخريطة. */
  localImages: Map<string, string>;
}

export interface MapEditorHooks {
  /** تغيّر التحديد أو الوضع: تُعاد رسم اللوحة. */
  onState: () => void;
  /** رسالة قصيرة للفريق (مثل سبب رفض ممر). */
  onMessage: (text: string) => void;
}

/** مسافة الالتقاط بالبكسل على الشاشة: النقطة المسحوبة تُحاذى مع جاراتها إن اقتربت منها. */
const SNAP_PX = 8;

export function createMapEditor(editor: Editor, state: MapState, hooks: MapEditorHooks): { root: HTMLElement; render: () => void } {
  const root = document.createElement('div');
  root.className = 'adm-map';
  const layer = svg('svg', { class: 'adm-map__svg', role: 'img' });
  root.append(layer);

  let dragging: { id: string; moved: boolean; neighbours: Point[] } | null = null;

  const floor = (): Floor => editor.data.floors.find((f) => f.id === state.floorId) as Floor;
  const view = (): MapView => {
    const f = floor();
    return { root, layer, view: { x: 0, y: 0, w: f.width, h: f.height }, unit: unit() };
  };
  /** وحدات الخريطة لكل بكسل على الشاشة، لتبقى العلامات بحجم ثابت مهما كُبّرت. */
  const unit = (): number => floor().width / ((root.clientWidth || 340) * state.zoom);

  const selectedPoint = (): Point | undefined =>
    state.selection?.type === 'point' ? floor().points.find((p) => p.id === (state.selection as { id: string }).id) : undefined;

  const draw = (): void => {
    const f = floor();
    const u = unit();
    layer.replaceChildren();
    layer.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
    layer.setAttribute('aria-label', `خريطة ${f.id}`);
    root.style.width = `${state.zoom * 100}%`;
    root.style.aspectRatio = `${f.width} / ${f.height}`;

    const href = f.map ? (state.localImages.get(f.map) ?? mapUrl(f.map)) : null;
    if (href) layer.append(svg('image', { href, x: 0, y: 0, width: f.width, height: f.height, class: 'adm-map__image' }));
    else layer.append(svg('rect', { x: 0, y: 0, width: f.width, height: f.height, class: 'adm-map__blank' }));

    const points = new Map(f.points.map((p) => [p.id, p]));
    const selected = state.selection;
    for (const corridor of f.corridors) {
      const a = points.get(corridor.from);
      const b = points.get(corridor.to);
      if (!a || !b) continue;
      const isSelected =
        selected?.type === 'corridor' &&
        ((selected.from === corridor.from && selected.to === corridor.to) || (selected.from === corridor.to && selected.to === corridor.from));
      const classes = ['adm-corridor', corridor.length_m > 0 ? '' : 'adm-corridor--missing', isSelected ? 'adm-corridor--selected' : '']
        .filter(Boolean)
        .join(' ');
      const coords = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      layer.append(svg('line', { ...coords, class: classes, 'stroke-width': 4 * u }));
      // خط أعرض شفاف لتسهيل النقر على الممر بالإصبع.
      layer.append(svg('line', { ...coords, class: 'adm-hit', 'stroke-width': 16 * u, 'data-from': a.id, 'data-to': b.id }));
    }

    const placesAt = new Map<string, string[]>();
    for (const place of f.places) placesAt.set(place.point, [...(placesAt.get(place.point) ?? []), place.name ?? place.id]);
    const passagePoints = new Set(editor.data.passages.flatMap((p) => [p.from, p.to]));

    for (const point of f.points) {
      const classes = ['adm-point'];
      if (placesAt.has(point.id)) classes.push('adm-point--place');
      if (passagePoints.has(point.id)) classes.push('adm-point--passage');
      if (selected?.type === 'point' && selected.id === point.id) classes.push('adm-point--selected');
      if (state.pending === point.id) classes.push('adm-point--pending');
      layer.append(svg('circle', { cx: point.x, cy: point.y, r: 6 * u, 'stroke-width': 2 * u, class: classes.join(' '), 'data-id': point.id }));
      const names = placesAt.get(point.id);
      const isSelected = selected?.type === 'point' && selected.id === point.id;
      if (names && (state.showLabels || isSelected)) {
        const label = svg('text', { x: point.x + 9 * u, y: point.y - 7 * u, 'font-size': 12 * u, 'stroke-width': 3 * u, class: 'adm-label' });
        label.textContent = names.join('، ');
        layer.append(label);
      }
    }
  };

  const hitPoint = (target: EventTarget | null): string | null =>
    target instanceof Element ? (target.closest('[data-id]')?.getAttribute('data-id') ?? null) : null;
  const hitCorridor = (target: EventTarget | null): { from: string; to: string } | null => {
    const line = target instanceof Element ? target.closest('[data-from]') : null;
    return line ? { from: line.getAttribute('data-from') as string, to: line.getAttribute('data-to') as string } : null;
  };

  layer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const pointId = hitPoint(event.target);
    const corridor = pointId ? null : hitCorridor(event.target);
    const position = tapPosition(view(), event);

    if (state.mode === 'corridor') {
      if (!pointId) return;
      if (!state.pending) {
        state.pending = pointId;
        state.selection = { type: 'point', id: pointId };
      } else {
        const from = state.pending;
        state.pending = null;
        const problem = corridorProblem(editor.data, from, pointId);
        if (problem) {
          hooks.onMessage(problem);
          state.selection = { type: 'point', id: pointId };
        } else {
          state.selection = { type: 'corridor', from, to: pointId };
          editor.change((data) => addCorridor(data, from, pointId));
          hooks.onMessage('أُضيف الممر. اكتب طوله المقاس بالأمتار.');
        }
      }
      hooks.onState();
      return;
    }

    if (state.mode === 'point') {
      if (pointId) {
        state.selection = { type: 'point', id: pointId };
        hooks.onState();
        return;
      }
      const from = selectedPoint();
      const at = from ? straighten(from, position) : position;
      const f = floor();
      if (at.x < 0 || at.y < 0 || at.x > f.width || at.y > f.height) return;
      const id = editor.change((data) => {
        const point = addPoint(data, state.floorId, at.x, at.y);
        if (from) addCorridor(data, from.id, point.id);
        return point.id;
      });
      state.selection = { type: 'point', id };
      if (from) hooks.onMessage('أُضيفت نقطة وممر إليها. اكتب طول الممر المقاس.');
      hooks.onState();
      return;
    }

    // تحديد ونقل
    if (pointId) {
      state.selection = { type: 'point', id: pointId };
      const f = floor();
      const linked = new Set(f.corridors.flatMap((c) => (c.from === pointId ? [c.to] : c.to === pointId ? [c.from] : [])));
      dragging = { id: pointId, moved: false, neighbours: f.points.filter((p) => linked.has(p.id)) };
      editor.checkpoint();
      layer.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      draw();
      hooks.onState();
    } else if (corridor) {
      state.selection = { type: 'corridor', ...corridor };
      hooks.onState();
    } else {
      state.selection = null;
      hooks.onState();
    }
  });

  layer.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const position = tapPosition(view(), event);
    const snap = SNAP_PX * unit();
    for (const n of dragging.neighbours) {
      if (Math.abs(position.x - n.x) < snap) position.x = n.x;
      if (Math.abs(position.y - n.y) < snap) position.y = n.y;
    }
    const f = floor();
    position.x = Math.min(Math.max(position.x, 0), f.width);
    position.y = Math.min(Math.max(position.y, 0), f.height);
    const point = f.points.find((p) => p.id === dragging?.id);
    if (!point || (point.x === position.x && point.y === position.y)) return;
    dragging.moved = true;
    point.x = position.x;
    point.y = position.y;
    draw();
  });

  const endDrag = (): void => {
    if (!dragging) return;
    if (!dragging.moved) editor.discardCheckpoint();
    const moved = dragging.moved;
    dragging = null;
    // الحفظ وإعادة رسم اللوحة (الإحداثيات الجديدة) بعد انتهاء السحب.
    if (moved) editor.live(() => undefined);
  };
  layer.addEventListener('pointerup', endDrag);
  layer.addEventListener('pointercancel', endDrag);

  return { root, render: draw };
}

/** الطول على الخريطة بالبكسل بين نقطتين (معلومة مساعدة، لا تُستعمل بدل القياس). */
export function pixelLength(data: Dataset, from: string, to: string): number | null {
  const points = data.floors.flatMap((f) => f.points);
  const a = points.find((p) => p.id === from);
  const b = points.find((p) => p.id === to);
  return a && b ? Math.round(Math.hypot(b.x - a.x, b.y - a.y)) : null;
}
