/**
 * أقصر طريق بالأمتار بين موقع الطالب ووجهته، مقسوماً إلى مقاطع: مقطع لكل خريطة طابق، وزر «التالي» بينها.
 */
import type { Floor, Level, Place } from '../data/types';
import { describeLeg, placeLabel } from './directions';

export { placeLabel };
import type { EdgeKind, Graph, GraphNode } from './graph';

/** من أين يبدأ الطالب: مكان (قاعة أو مرفق أو معلم)، أو نقطة نقر عليها في خريطة طابق. */
export type Start = { place: string } | { floor: string; x: number; y: number };
/** إلى أين: مكان، أو دكتور (فيُوجَّه إلى مكتبه). */
export type Target = { place: string } | { doctor: string };

export interface RouteOptions {
  /** المصعد فقط، لمن لا يستطيع الدرج. */
  avoidStairs?: boolean;
}

/**
 * كلفة تغيير الطابق عند المقارنة بين الطرق، بما يعادل الأمتار. لا تُحسب في المسافة المعروضة،
 * لكنها تمنع طريقاً يصعد وينزل ليختصر أمتاراً قليلة، وتفضّل الطريق الذي لا يغيّر الطابق.
 */
export const FLOOR_CHANGE_COST = 30;

/** معرّف نقطة البداية حين ينقر الطالب على الخريطة: ليست من نقاط البيانات. */
export const TAP_NODE = '@start';

export interface Hop {
  from: GraphNode;
  to: GraphNode;
  meters: number;
  kind: EdgeKind;
  via?: string;
}

/** نهاية مقطع ليس الأخير: درج أو مصعد إلى طابق آخر، أو ممر إلى خريطة أخرى. */
export type LegExit =
  | { kind: 'stairs' | 'elevator'; place: Place; toLevel: Level; arrival: Place }
  | { kind: 'passage'; name: string; toLevel: Level };

export interface Leg {
  level: Level;
  /** صورة الخريطة التي يُرسم عليها المقطع (مشتركة بين المبنيين). */
  map: string | null;
  width: number;
  height: number;
  /** نقاط الطريق بالترتيب على هذه الخريطة. */
  path: GraphNode[];
  hops: Hop[];
  meters: number;
  steps: string[];
  exit?: LegExit;
}

export interface Route {
  start: { label: string; node: GraphNode };
  destination: Place;
  /** المسافة كاملة بالأمتار (مجموع المقاطع). */
  meters: number;
  legs: Leg[];
}

export type RouteResult = { ok: true; route: Route } | { ok: false; reason: string };

/** إسقاط نقطة النقر على أقرب ممر في خرائط الطابق نفسه (قد يكون في المبنى الآخر على الصورة نفسها). */
function tapNode(graph: Graph, start: { floor: string; x: number; y: number }): { node: GraphNode; edges: Hop[] } | null {
  const chosen = graph.dataset.floors.find((f) => f.id === start.floor);
  if (!chosen) return null;
  const sameMap = graph.dataset.floors.filter(
    (f) => f.level === chosen.level && (f === chosen || (f.map !== null && f.map === chosen.map)),
  );
  let best: { floor: Floor; a: GraphNode; b: GraphNode; t: number; d: number; meters: number } | null = null;
  for (const floor of sameMap) {
    for (const corridor of floor.corridors) {
      const a = graph.nodes.get(corridor.from);
      const b = graph.nodes.get(corridor.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((start.x - a.x) * dx + (start.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(a.x + dx * t - start.x, a.y + dy * t - start.y);
      if (!best || d < best.d) best = { floor, a, b, t, d, meters: corridor.length_m };
    }
  }
  if (!best) return null;
  const { floor, a, b, t, meters } = best;
  const node: GraphNode = { id: TAP_NODE, floor, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return {
    node,
    edges: [
      { from: node, to: a, meters: meters * t, kind: 'corridor' },
      { from: node, to: b, meters: meters * (1 - t), kind: 'corridor' },
    ],
  };
}

/** خوارزمية Dijkstra: أقل كلفة من البداية إلى الهدف. الشبكة صغيرة (مئات النقاط)، فالبحث الخطي يكفي. */
function shortestHops(graph: Graph, start: GraphNode, extra: Hop[], goal: string, options: RouteOptions): Hop[] | null {
  const cost = new Map<string, number>([[start.id, 0]]);
  const via = new Map<string, Hop>();
  const done = new Set<string>();
  const neighbours = (id: string): Hop[] => {
    if (id === start.id && extra.length > 0) return extra;
    const from = graph.nodes.get(id) as GraphNode;
    return (graph.edges.get(id) ?? [])
      .filter((e) => !(options.avoidStairs && e.kind === 'stairs'))
      .map((e) => ({ from, to: graph.nodes.get(e.to) as GraphNode, meters: e.meters, kind: e.kind, via: e.via }));
  };

  for (;;) {
    let current: string | null = null;
    for (const [id, c] of cost) {
      if (!done.has(id) && (current === null || c < (cost.get(current) as number))) current = id;
    }
    if (current === null) return null;
    if (current === goal) break;
    done.add(current);
    for (const hop of neighbours(current)) {
      const vertical = hop.kind === 'stairs' || hop.kind === 'elevator';
      const next = (cost.get(current) as number) + hop.meters + (vertical ? FLOOR_CHANGE_COST : 0);
      if (!done.has(hop.to.id) && next < (cost.get(hop.to.id) ?? Infinity)) {
        cost.set(hop.to.id, next);
        via.set(hop.to.id, hop);
      }
    }
  }

  const hops: Hop[] = [];
  for (let id = goal; id !== start.id; ) {
    const hop = via.get(id) as Hop;
    hops.unshift(hop);
    id = hop.from.id;
  }
  return hops;
}

function exitArrival(exit: LegExit): string {
  return exit.kind === 'passage' ? `نهاية ${exit.name}` : placeLabel(exit.arrival);
}

const isVertical = (hop: Hop): boolean => hop.kind === 'stairs' || hop.kind === 'elevator';
/** المقاطع تُفصل حين تتغير صورة الخريطة: المبنيان في الطابق نفسه على صورة واحدة فيبقيان في مقطع واحد. */
const mapKey = (floor: Floor): string => `${floor.level}|${floor.map ?? floor.id}`;

function splitLegs(graph: Graph, start: GraphNode, hops: Hop[]): Omit<Leg, 'steps'>[] {
  const legs: Omit<Leg, 'steps'>[] = [];
  const open = (node: GraphNode): Omit<Leg, 'steps'> => {
    const leg = {
      level: node.floor.level,
      map: node.floor.map,
      width: node.floor.width,
      height: node.floor.height,
      path: [node],
      hops: [],
      meters: 0,
    };
    legs.push(leg);
    return leg;
  };
  let leg = open(start);

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i] as Hop;
    if (isVertical(hop)) {
      // درج أو مصعد: قد يمر بأكثر من طابق، فنجمع القفزات المتتالية في خطوة واحدة.
      let last = hop;
      while (i + 1 < hops.length && isVertical(hops[i + 1] as Hop)) last = hops[++i] as Hop;
      const kind = hop.kind as 'stairs' | 'elevator';
      const at = (node: GraphNode): Place =>
        (graph.placesAt.get(node.id) ?? []).find((p) => p.kind === kind) as Place;
      leg.exit = { kind, place: at(hop.from), toLevel: last.to.floor.level, arrival: at(last.to) };
      leg = open(last.to);
      continue;
    }
    if (mapKey(hop.to.floor) !== mapKey(leg.path[0]?.floor as Floor)) {
      // ممر إلى طابق على صورة أخرى: لا يُرسم على أي من الخريطتين، وطوله يُحسب في المقطع الحالي.
      leg.meters += hop.meters;
      leg.exit = { kind: 'passage', name: graph.passageNames.get(hop.via ?? '') ?? 'الممر', toLevel: hop.to.floor.level };
      leg = open(hop.to);
      continue;
    }
    leg.hops.push(hop);
    leg.path.push(hop.to);
    leg.meters += hop.meters;
  }
  return legs;
}

export function findRoute(graph: Graph, from: Start, to: Target, options: RouteOptions = {}): RouteResult {
  let destinationId: string;
  if ('doctor' in to) {
    const doctor = graph.doctors.get(to.doctor);
    if (!doctor) return { ok: false, reason: 'الدكتور غير موجود في البيانات' };
    destinationId = doctor.office;
  } else {
    destinationId = to.place;
  }
  const destination = graph.places.get(destinationId)?.place;
  if (!destination) return { ok: false, reason: `الوجهة «${destinationId}» غير موجودة في البيانات` };

  let startNode: GraphNode;
  let startLabel: string;
  let extra: Hop[] = [];
  if ('place' in from) {
    const place = graph.places.get(from.place)?.place;
    if (!place) return { ok: false, reason: `مكان البداية «${from.place}» غير موجود في البيانات` };
    startNode = graph.nodes.get(place.point) as GraphNode;
    startLabel = placeLabel(place);
  } else {
    const tap = tapNode(graph, from);
    if (!tap) return { ok: false, reason: 'لا يوجد ممر قريب من النقطة المختارة' };
    startNode = tap.node;
    extra = tap.edges;
    startLabel = 'النقطة التي اخترتها على الخريطة';
  }

  const hops = shortestHops(graph, startNode, extra, destination.point, options);
  if (!hops) {
    return {
      ok: false,
      reason: options.avoidStairs ? 'لا يوجد طريق بالمصعد فقط إلى هذه الوجهة' : 'لا يوجد طريق إلى هذه الوجهة',
    };
  }

  const legs = splitLegs(graph, startNode, hops).map((leg, index, all) => ({
    ...leg,
    steps: describeLeg(graph, leg, {
      first: index === 0,
      last: index === all.length - 1,
      startLabel: index === 0 ? startLabel : exitArrival((all[index - 1] as Omit<Leg, 'steps'>).exit as LegExit),
      destination,
    }),
  }));
  return {
    ok: true,
    route: {
      start: { label: startLabel, node: startNode },
      destination,
      meters: legs.reduce((sum, leg) => sum + leg.meters, 0),
      legs,
    },
  };
}
