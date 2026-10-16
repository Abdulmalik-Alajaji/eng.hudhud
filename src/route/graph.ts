/**
 * شبكة الكلية جاهزة للبحث عن الطريق: كل نقطة من نقاط الطوابق عقدة، والممرات والممرات بين المبنيين
 * والدرج والمصاعد حواف بينها. تُبنى مرة واحدة من البيانات بعد فحصها.
 */
import { LEVELS, type Dataset, type Doctor, type Floor, type Place } from '../data/types';

export type EdgeKind = 'corridor' | 'passage' | 'stairs' | 'elevator';

export interface Edge {
  to: string;
  /** الطول بالأمتار من قياس الفريق. الدرج والمصعد صفر: لا قياس لهما، ولا تُحسب في المسافة. */
  meters: number;
  kind: EdgeKind;
  /** معرّف الممر بين المبنيين أو الدرج أو المصعد. */
  via?: string;
}

export interface GraphNode {
  id: string;
  floor: Floor;
  x: number;
  y: number;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Edge[]>;
  places: Map<string, { place: Place; floor: Floor }>;
  /** الأماكن عند كل نقطة، للشرح الكتابي («عند المصعد انعطف يميناً»). */
  placesAt: Map<string, Place[]>;
  doctors: Map<string, Doctor>;
  passageNames: Map<string, string>;
  dataset: Dataset;
}

export function buildGraph(dataset: Dataset): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, Edge[]>();
  const places = new Map<string, { place: Place; floor: Floor }>();
  const placesAt = new Map<string, Place[]>();

  const link = (a: string, b: string, meters: number, kind: EdgeKind, via?: string): void => {
    edges.get(a)?.push({ to: b, meters, kind, via });
    edges.get(b)?.push({ to: a, meters, kind, via });
  };

  for (const floor of dataset.floors) {
    for (const point of floor.points) {
      nodes.set(point.id, { id: point.id, floor, x: point.x, y: point.y });
      edges.set(point.id, []);
    }
  }
  for (const floor of dataset.floors) {
    for (const corridor of floor.corridors) link(corridor.from, corridor.to, corridor.length_m, 'corridor');
    for (const place of floor.places) {
      places.set(place.id, { place, floor });
      placesAt.set(place.point, [...(placesAt.get(place.point) ?? []), place]);
    }
  }
  for (const passage of dataset.passages) link(passage.from, passage.to, passage.length_m, 'passage', passage.id);

  // الدرج والمصعد: تربط كل طابق بالذي يليه، مرتبة من الأرضي إلى الأعلى.
  for (const vertical of dataset.vertical) {
    const stops = vertical.stops
      .map((id) => places.get(id))
      .filter((stop) => stop !== undefined)
      .sort((a, b) => LEVELS.indexOf(a.floor.level) - LEVELS.indexOf(b.floor.level));
    for (let i = 1; i < stops.length; i++) {
      link((stops[i - 1] as { place: Place }).place.point, (stops[i] as { place: Place }).place.point, 0, vertical.kind, vertical.id);
    }
  }

  return {
    nodes,
    edges,
    places,
    placesAt,
    doctors: new Map(dataset.doctors.map((d) => [d.id, d])),
    passageNames: new Map(dataset.passages.map((p) => [p.id, p.name])),
    dataset,
  };
}
