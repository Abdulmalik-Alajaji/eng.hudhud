/**
 * تعديل بيانات الكلية في صفحة الإدارة: عمليات على نسخة من البيانات في المتصفح، ثم ملفات JSON
 * بالتنسيق نفسه تُنزَّل ويرفعها الفريق إلى data/ في GitHub (الخيار «أ»، قرار الفريق).
 *
 * لا تخترع العمليات أي قياس: الممر الجديد طوله 0 حتى يكتب الفريق طوله المقاس، وفحص البيانات
 * (validate.ts) يعدّ ذلك خطأً يمنع التنزيل إلى أن يُكمل.
 */
import {
  type Dataset,
  type Doctor,
  type Floor,
  type Passage,
  type Place,
  type PlaceKind,
  type Point,
  type VerticalLink,
} from '../data/types';
import { BUILDINGS_FILE, DOCTORS_FILE, LINKS_FILE, validateData, type ValidationResult } from '../data/validate';
import { formatDataFile } from './format';

export const floorFile = (id: string): string => `/data/floors/${id}.json`;

/** البيانات المنشورة (ملفات data/ بعد فحصها) كنسخة قابلة للتعديل. */
export function fromFiles(files: Record<string, unknown>): Dataset {
  const copy = structuredClone(files) as Record<string, Record<string, unknown>>;
  const links = copy[LINKS_FILE] as { vertical: VerticalLink[]; passages: Passage[] };
  return {
    buildings: (copy[BUILDINGS_FILE] as { buildings: Dataset['buildings'] }).buildings,
    floors: Object.entries(copy)
      .filter(([path]) => path.startsWith('/data/floors/'))
      .map(([, floor]) => floor as unknown as Floor)
      .sort((a, b) => a.id.localeCompare(b.id)),
    vertical: links.vertical,
    passages: links.passages,
    doctors: (copy[DOCTORS_FILE] as { doctors: Doctor[] }).doctors,
  };
}

/** المكان بترتيب الحقول المعتاد في الملفات، بلا الحقول الاختيارية الفارغة. */
function placeRecord(place: Place): Place {
  const record: Place = { id: place.id, kind: place.kind } as Place;
  if (place.name) record.name = place.name;
  record.point = place.point;
  if (place.landmark) record.landmark = true;
  record.demo = place.demo;
  return record;
}

/** الملفات كما تُكتب في data/، بمساراتها في الموقع (/data/...). */
export function toFiles(data: Dataset): Record<string, unknown> {
  const files: Record<string, unknown> = {
    [BUILDINGS_FILE]: { buildings: data.buildings },
    [LINKS_FILE]: { vertical: data.vertical, passages: data.passages },
    [DOCTORS_FILE]: { doctors: data.doctors },
  };
  for (const floor of data.floors) {
    files[floorFile(floor.id)] = {
      id: floor.id,
      building: floor.building,
      level: floor.level,
      map: floor.map,
      width: floor.width,
      height: floor.height,
      demo: floor.demo,
      points: floor.points.map((p) => ({ id: p.id, x: p.x, y: p.y })),
      corridors: floor.corridors.map((c) => ({ from: c.from, to: c.to, length_m: c.length_m })),
      places: floor.places.map(placeRecord),
    };
  }
  return files;
}

export const validate = (data: Dataset): ValidationResult => validateData(toFiles(data));

export interface FileChange {
  /** المسار في المستودع، مثل data/floors/B1-G.json. */
  path: string;
  /** اسم الملف عند التنزيل، مثل B1-G.json. */
  name: string;
  text: string;
}

/** الملفات التي تغيّر نصها عن المنشور (بالتنسيق نفسه، فلا يظهر ملف لم يتغير فيه شيء). */
export function changedFiles(published: Record<string, unknown>, data: Dataset): FileChange[] {
  const current = toFiles(data);
  return Object.entries(current)
    .filter(([path, value]) => !(path in published) || formatDataFile(published[path]) !== formatDataFile(value))
    .map(([path, value]) => ({
      path: path.replace(/^\//, ''),
      name: path.split('/').pop() as string,
      text: formatDataFile(value),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** بصمة قصيرة لنص (لمعرفة هل تغيّرت البيانات المنشورة منذ بدأت المسودة). */
export function fingerprint(files: Record<string, unknown>): string {
  let hash = 0x811c9dc5;
  const text = Object.keys(files)
    .sort()
    .map((path) => path + formatDataFile(files[path]))
    .join('\n');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

// ---------- البحث ----------

export function getFloor(data: Dataset, id: string): Floor {
  const floor = data.floors.find((f) => f.id === id);
  if (!floor) throw new Error(`الطابق ${id} غير موجود`);
  return floor;
}

export function floorOfPoint(data: Dataset, pointId: string): Floor | undefined {
  return data.floors.find((f) => f.points.some((p) => p.id === pointId));
}

export function findPlace(data: Dataset, id: string): { place: Place; floor: Floor } | undefined {
  for (const floor of data.floors) {
    const place = floor.places.find((p) => p.id === id);
    if (place) return { place, floor };
  }
  return undefined;
}

// ---------- النقاط ----------

export function nextPointId(floor: Floor): string {
  const numbers = floor.points.map((p) => Number(/:p(\d+)$/.exec(p.id)?.[1] ?? 0));
  return `${floor.id}:p${Math.max(0, ...numbers) + 1}`;
}

export function addPoint(data: Dataset, floorId: string, x: number, y: number): Point {
  const floor = getFloor(data, floorId);
  const point = { id: nextPointId(floor), x: Math.round(x), y: Math.round(y) };
  floor.points.push(point);
  return point;
}

export function movePoint(data: Dataset, pointId: string, x: number, y: number): void {
  const point = floorOfPoint(data, pointId)?.points.find((p) => p.id === pointId);
  if (!point) return;
  point.x = Math.round(x);
  point.y = Math.round(y);
}

export interface PointUsage {
  corridors: number;
  places: Place[];
  passages: Passage[];
}

/** ما يُحذف مع النقطة: ممراتها، وأماكنها، والممرات بين الطوابق التي تبدأ أو تنتهي عندها. */
export function pointUsage(data: Dataset, pointId: string): PointUsage {
  const floor = floorOfPoint(data, pointId);
  return {
    corridors: floor?.corridors.filter((c) => c.from === pointId || c.to === pointId).length ?? 0,
    places: floor?.places.filter((p) => p.point === pointId) ?? [],
    passages: data.passages.filter((p) => p.from === pointId || p.to === pointId),
  };
}

export function deletePoint(data: Dataset, pointId: string): void {
  const floor = floorOfPoint(data, pointId);
  if (!floor) return;
  for (const place of floor.places.filter((p) => p.point === pointId)) deletePlace(data, place.id);
  floor.points = floor.points.filter((p) => p.id !== pointId);
  floor.corridors = floor.corridors.filter((c) => c.from !== pointId && c.to !== pointId);
  data.passages = data.passages.filter((p) => p.from !== pointId && p.to !== pointId);
}

/**
 * إحداثيات نقطة جديدة متصلة بنقطة أخرى بممر مستقيم: الممرات متعامدة، فتُحاذى النقطة أفقياً
 * أو رأسياً مع الأخرى (حسب الاتجاه الأقرب لما نقره الفريق).
 */
export function straighten(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

// ---------- الممرات ----------

const samePair = (a: { from: string; to: string }, from: string, to: string): boolean =>
  (a.from === from && a.to === to) || (a.from === to && a.to === from);

/** سبب رفض ممر بين نقطتين، أو null إذا أمكن. */
export function corridorProblem(data: Dataset, from: string, to: string): string | null {
  if (from === to) return 'اختر نقطتين مختلفتين';
  const floor = floorOfPoint(data, from);
  if (!floor || floorOfPoint(data, to) !== floor) return 'النقطتان يجب أن تكونا في الطابق نفسه';
  if (floor.corridors.some((c) => samePair(c, from, to))) return 'بين النقطتين ممر من قبل';
  return null;
}

/** ممر جديد بلا طول (0) حتى يكتب الفريق طوله المقاس. يعيد سبب الرفض إن وُجد. */
export function addCorridor(data: Dataset, from: string, to: string): string | null {
  const problem = corridorProblem(data, from, to);
  if (problem) return problem;
  floorOfPoint(data, from)?.corridors.push({ from, to, length_m: 0 });
  return null;
}

export function setCorridorLength(data: Dataset, from: string, to: string, length: number): void {
  const corridor = floorOfPoint(data, from)?.corridors.find((c) => samePair(c, from, to));
  if (corridor) corridor.length_m = length;
}

export function deleteCorridor(data: Dataset, from: string, to: string): void {
  const floor = floorOfPoint(data, from);
  if (floor) floor.corridors = floor.corridors.filter((c) => !samePair(c, from, to));
}

// ---------- الأماكن ----------

export function addPlace(data: Dataset, floorId: string, place: Omit<Place, 'demo'> & { demo?: boolean }): Place {
  const floor = getFloor(data, floorId);
  const record = placeRecord({ ...place, demo: place.demo ?? floor.demo } as Place);
  floor.places.push(record);
  return record;
}

/**
 * تعديل مكان. تغيير المعرّف يُطبَّق أيضاً على الدرج والمصاعد التي تقف عنده وعلى الدكاترة
 * الذين مكتبهم فيه، حتى لا تنقطع الروابط.
 */
export function updatePlace(data: Dataset, id: string, patch: Partial<Omit<Place, 'point'>>): void {
  const found = findPlace(data, id);
  if (!found) return;
  const { floor, place } = found;
  const updated = placeRecord({ ...place, ...patch });
  floor.places[floor.places.indexOf(place)] = updated;
  if (patch.id !== undefined && patch.id !== id) {
    for (const link of data.vertical) link.stops = link.stops.map((s) => (s === id ? updated.id : s));
    for (const doctor of data.doctors) if (doctor.office === id) doctor.office = updated.id;
  }
}

/** حذف مكان، وإزالته من وقفات الدرج والمصاعد. الدكاترة في مكتب محذوف يبقون، وفحص البيانات ينبّه عنهم. */
export function deletePlace(data: Dataset, id: string): void {
  const found = findPlace(data, id);
  if (!found) return;
  found.floor.places = found.floor.places.filter((p) => p.id !== id);
  for (const link of data.vertical) link.stops = link.stops.filter((s) => s !== id);
}

/** بداية مقترحة لمعرّف مكان جديد: الرمز للقاعات (B1-F)، والطابق ثم شرطة لغيرها (B1-F-). */
export function placeIdPrefix(floor: Floor, kind: PlaceKind): string {
  return ['room', 'lab', 'office'].includes(kind) ? floor.id : `${floor.id}-`;
}

// ---------- الدكاترة ----------

export function addDoctor(data: Dataset, office: string): Doctor {
  const numbers = data.doctors.map((d) => Number(/^d(\d+)$/.exec(d.id)?.[1] ?? 0));
  const doctor = {
    id: `d${Math.max(0, ...numbers) + 1}`,
    name: '',
    office,
    demo: findPlace(data, office)?.place.demo ?? false,
  };
  data.doctors.push(doctor);
  return doctor;
}

export function updateDoctor(data: Dataset, id: string, patch: Partial<Omit<Doctor, 'id'>>): void {
  const doctor = data.doctors.find((d) => d.id === id);
  if (doctor) Object.assign(doctor, patch);
}

export function deleteDoctor(data: Dataset, id: string): void {
  data.doctors = data.doctors.filter((d) => d.id !== id);
}

// ---------- الدرج والمصاعد والممرات بين الطوابق ----------

export function addVertical(data: Dataset, id: string, kind: VerticalLink['kind']): VerticalLink | string {
  if (!id.trim()) return 'اكتب معرّفاً مثل B1-ST4';
  if (data.vertical.some((v) => v.id === id)) return `المعرّف «${id}» مستخدم`;
  const demo = data.floors.some((f) => f.demo && id.startsWith(`${f.building}-`));
  const link = { id: id.trim(), kind, stops: [], demo };
  data.vertical.push(link);
  return link;
}

export function updateVertical(data: Dataset, id: string, patch: Partial<VerticalLink>): void {
  const link = data.vertical.find((v) => v.id === id);
  if (link) Object.assign(link, patch);
}

export function deleteVertical(data: Dataset, id: string): void {
  data.vertical = data.vertical.filter((v) => v.id !== id);
}

export function addPassage(data: Dataset, id: string, from: string, to: string): Passage | string {
  if (!id.trim()) return 'اكتب معرّفاً للممر';
  if (data.passages.some((p) => p.id === id)) return `المعرّف «${id}» مستخدم`;
  const demo = Boolean(floorOfPoint(data, from)?.demo || floorOfPoint(data, to)?.demo);
  const passage = { id: id.trim(), name: '', from, to, length_m: 0, demo };
  data.passages.push(passage);
  return passage;
}

export function updatePassage(data: Dataset, id: string, patch: Partial<Passage>): void {
  const passage = data.passages.find((p) => p.id === id);
  if (passage) Object.assign(passage, patch);
}

export function deletePassage(data: Dataset, id: string): void {
  data.passages = data.passages.filter((p) => p.id !== id);
}

// ---------- المحرر: التعديلات مع «تراجع» ----------

const MAX_HISTORY = 100;

/** يحفظ البيانات قبل كل تعديل ليمكن التراجع عنه، ويُعلم الصفحة لتعيد الرسم. */
export class Editor {
  private past: string[] = [];
  private future: string[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(public data: Dataset) {}

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** حفظ الحالة قبل تعديل يتم على مراحل (مثل سحب نقطة)، ثم commit في آخره. */
  checkpoint(): void {
    this.past.push(JSON.stringify(this.data));
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
  }

  change<T>(edit: (data: Dataset) => T): T {
    this.checkpoint();
    const result = edit(this.data);
    this.emit();
    return result;
  }

  /** إلغاء آخر checkpoint إذا لم يتغير شيء (نقر نقطة بلا سحب). */
  discardCheckpoint(): void {
    this.past.pop();
  }

  /** تحديث بلا نقطة تراجع جديدة (أثناء السحب). */
  live(edit: (data: Dataset) => void): void {
    edit(this.data);
    this.emit();
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const previous = this.past.pop();
    if (previous === undefined) return;
    this.future.push(JSON.stringify(this.data));
    this.data = JSON.parse(previous) as Dataset;
    this.emit();
  }

  redo(): void {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(JSON.stringify(this.data));
    this.data = JSON.parse(next) as Dataset;
    this.emit();
  }

  /** استبدال البيانات كلها (استيراد نسخة، أو الرجوع للمنشور)، ويمكن التراجع عنه. */
  replace(data: Dataset): void {
    this.checkpoint();
    this.data = data;
    this.emit();
  }
}
