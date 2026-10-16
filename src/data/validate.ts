/**
 * فحص سلامة بيانات الكلية: الصيغة، والمراجع بين الملفات، والشبكة متصلة،
 * ورموز القاعات بنمط الجامعة، واتساق الأمتار مع البكسل لكشف أخطاء الإدخال.
 *
 * الأخطاء تمنع استخدام البيانات (ويفشل بها `npm test`)، والتنبيهات لما يُحتمل أنه خطأ إدخال.
 * الرسائل بالعربية لأن الفريق سيقرؤها عند إدخال البيانات الحقيقية.
 */
import {
  CODED_KINDS,
  LEVELS,
  PLACE_KINDS,
  type Building,
  type Corridor,
  type Dataset,
  type Doctor,
  type Floor,
  type Level,
  type Passage,
  type Place,
  type PlaceKind,
  type Point,
  type VerticalLink,
} from './types';

export interface ValidationResult {
  /** البيانات بعد الفحص، أو null إذا وُجد خطأ واحد على الأقل. */
  dataset: Dataset | null;
  errors: string[];
  warnings: string[];
}

export const BUILDINGS_FILE = '/data/buildings.json';
export const LINKS_FILE = '/data/links.json';
export const DOCTORS_FILE = '/data/doctors.json';
const FLOOR_FILE = /^\/data\/floors\/([^/]+)\.json$/;

export const BUILDING_ID = /^B[1-9]\d*$/;
/** رمز الجامعة: المبنى، ثم حرف الطابق، ثم رقم الغرفة. */
export const ROOM_CODE = /^(B[1-9]\d*)-([GFS])(\d+)$/;
const OTHER_PLACE_ID = /^(B[1-9]\d*)-([GFS])-[A-Za-z][A-Za-z0-9]*$/;
const MAP_PATH = /^maps\/[\w.-]+\.(png|jpe?g|webp|svg)$/;

/** أقصى ميل مسموح للممر عن الأفقي أو الرأسي: الممرات متعامدة، والميل الأكبر غالباً خطأ في الإحداثيات. */
const MAX_TILT_DEGREES = 10;
/** فرق نسبة (أمتار ÷ بكسل) عن الوسيط في الطابق الذي يُنبَّه عنده: غالباً خطأ في القياس أو الإدخال. */
const SCALE_TOLERANCE = 0.25;
const MIN_CORRIDORS_FOR_SCALE = 3;

class Report {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];
  error(where: string, message: string): void {
    this.errors.push(`${where}: ${message}`);
  }
  warn(where: string, message: string): void {
    this.warnings.push(`${where}: ${message}`);
  }
}

/** قارئ حقول لكائن واحد: يبلّغ عن الحقل الناقص أو بنوع خاطئ أو غير المعروف (مثل خطأ إملائي في اسمه). */
class Fields {
  constructor(
    private readonly report: Report,
    readonly where: string,
    private readonly record: Record<string, unknown>,
  ) {}

  private get(key: string, optional: boolean): unknown {
    const value = this.record[key];
    if (value === undefined && !optional) this.report.error(this.where, `الحقل «${key}» ناقص`);
    return value;
  }

  string(key: string, optional = false): string | undefined {
    const value = this.get(key, optional);
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.trim() === '') {
      this.report.error(this.where, `الحقل «${key}» يجب أن يكون نصاً غير فارغ`);
      return undefined;
    }
    return value;
  }

  number(key: string): number | undefined {
    const value = this.get(key, false);
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.report.error(this.where, `الحقل «${key}» يجب أن يكون رقماً`);
      return undefined;
    }
    return value;
  }

  boolean(key: string, optional = false): boolean | undefined {
    const value = this.get(key, optional);
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
      this.report.error(this.where, `الحقل «${key}» يجب أن يكون true أو false (بلا علامات تنصيص)`);
      return undefined;
    }
    return value;
  }

  array(key: string): unknown[] | undefined {
    const value = this.get(key, false);
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      this.report.error(this.where, `الحقل «${key}» يجب أن يكون قائمة [ ]`);
      return undefined;
    }
    return value;
  }

  /** نص أو null. */
  nullableString(key: string): string | null | undefined {
    if (this.record[key] === null) return null;
    return this.string(key);
  }
}

function fields(report: Report, value: unknown, where: string, allowed: readonly string[]): Fields | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    report.error(where, 'يجب أن يكون كائناً { }');
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      report.error(where, `حقل غير معروف «${key}» (المسموح: ${allowed.join('، ')})`);
    }
  }
  return new Fields(report, where, record);
}

/** يقرأ كل عناصر القائمة ويُسقط ما فيه خطأ في الصيغة (الخطأ مُبلَّغ عنه). */
function readList<T>(items: unknown[] | undefined, read: (item: unknown, index: number) => T | null): T[] {
  const result: T[] = [];
  (items ?? []).forEach((item, index) => {
    const value = read(item, index);
    if (value !== null) result.push(value);
  });
  return result;
}

function allDefined<T extends object>(value: { [K in keyof T]: T[K] | undefined }, optionalKeys: string[] = []): value is T {
  return Object.entries(value).every(([key, v]) => v !== undefined || optionalKeys.includes(key));
}

/** «data/floors/B1-G.json» بدل المسار الداخلي «/data/floors/B1-G.json». */
function fileLabel(path: string): string {
  return path.replace(/^\//, '');
}

// ---------- قراءة الصيغة ----------

function readBuilding(report: Report, item: unknown, where: string): Building | null {
  const f = fields(report, item, where, ['id', 'name', 'demo']);
  if (!f) return null;
  const building = { id: f.string('id'), name: f.string('name'), demo: f.boolean('demo') };
  if (!allDefined<Building>(building)) return null;
  if (!BUILDING_ID.test(building.id)) {
    report.error(where, `معرّف المبنى «${building.id}» يجب أن يكون B ثم رقماً، مثل B1`);
  }
  return building;
}

function readPoint(report: Report, item: unknown, where: string): Point | null {
  const f = fields(report, item, where, ['id', 'x', 'y']);
  if (!f) return null;
  const point = { id: f.string('id'), x: f.number('x'), y: f.number('y') };
  return allDefined<Point>(point) ? point : null;
}

function readCorridor(report: Report, item: unknown, where: string): Corridor | null {
  const f = fields(report, item, where, ['from', 'to', 'length_m']);
  if (!f) return null;
  const corridor = { from: f.string('from'), to: f.string('to'), length_m: f.number('length_m') };
  return allDefined<Corridor>(corridor) ? corridor : null;
}

function readPlace(report: Report, item: unknown, where: string): Place | null {
  const f = fields(report, item, where, ['id', 'kind', 'name', 'point', 'landmark', 'demo']);
  if (!f) return null;
  const kind = f.string('kind');
  if (kind !== undefined && !(PLACE_KINDS as readonly string[]).includes(kind)) {
    report.error(where, `النوع «${kind}» غير معروف (المسموح: ${PLACE_KINDS.join('، ')})`);
    return null;
  }
  const place = {
    id: f.string('id'),
    kind: kind as PlaceKind | undefined,
    name: f.string('name', true),
    point: f.string('point'),
    landmark: f.boolean('landmark', true),
    demo: f.boolean('demo'),
  };
  if (!allDefined<Place>(place, ['name', 'landmark'])) return null;
  if (place.name === undefined) delete place.name;
  if (place.landmark === undefined) delete place.landmark;
  return place;
}

function readFloor(report: Report, value: unknown, file: string): Floor | null {
  const where = fileLabel(file);
  const f = fields(report, value, where, [
    'id', 'building', 'level', 'map', 'width', 'height', 'demo', 'points', 'corridors', 'places',
  ]);
  if (!f) return null;
  const level = f.string('level');
  if (level !== undefined && !(LEVELS as readonly string[]).includes(level)) {
    report.error(where, `الطابق «${level}» غير مسموح: الطوابق G (الأرضي) وF (الأول) وS (الثاني) فقط`);
    return null;
  }
  const map = f.nullableString('map');
  const floor = {
    id: f.string('id'),
    building: f.string('building'),
    level: level as Level | undefined,
    map,
    width: f.number('width'),
    height: f.number('height'),
    demo: f.boolean('demo'),
    points: readList(f.array('points'), (p, i) => readPoint(report, p, `${where}، النقطة ${i + 1}`)),
    corridors: readList(f.array('corridors'), (c, i) => readCorridor(report, c, `${where}، الممر ${i + 1}`)),
    places: readList(f.array('places'), (p, i) => readPlace(report, p, `${where}، المكان ${i + 1}`)),
  };
  return allDefined<Floor>(floor) ? floor : null;
}

function readVertical(report: Report, item: unknown, where: string): VerticalLink | null {
  const f = fields(report, item, where, ['id', 'kind', 'stops', 'demo']);
  if (!f) return null;
  const kind = f.string('kind');
  if (kind !== undefined && kind !== 'stairs' && kind !== 'elevator') {
    report.error(where, `النوع «${kind}» غير معروف (المسموح: stairs، elevator)`);
    return null;
  }
  const stops = f.array('stops');
  if (stops && !stops.every((s) => typeof s === 'string')) {
    report.error(where, 'الحقل «stops» يجب أن يكون قائمة معرّفات نصية');
    return null;
  }
  const link = {
    id: f.string('id'),
    kind: kind as VerticalLink['kind'] | undefined,
    stops: stops as string[] | undefined,
    demo: f.boolean('demo'),
  };
  return allDefined<VerticalLink>(link) ? link : null;
}

function readPassage(report: Report, item: unknown, where: string): Passage | null {
  const f = fields(report, item, where, ['id', 'name', 'from', 'to', 'length_m', 'demo']);
  if (!f) return null;
  const passage = {
    id: f.string('id'),
    name: f.string('name'),
    from: f.string('from'),
    to: f.string('to'),
    length_m: f.number('length_m'),
    demo: f.boolean('demo'),
  };
  return allDefined<Passage>(passage) ? passage : null;
}

function readDoctor(report: Report, item: unknown, where: string): Doctor | null {
  const f = fields(report, item, where, ['id', 'name', 'office', 'demo']);
  if (!f) return null;
  const doctor = { id: f.string('id'), name: f.string('name'), office: f.string('office'), demo: f.boolean('demo') };
  return allDefined<Doctor>(doctor) ? doctor : null;
}

/** ملف فيه قائمة واحدة باسم معيّن، مثل { "buildings": [...] }. */
function readListFile<T>(
  report: Report,
  files: Record<string, unknown>,
  file: string,
  keys: readonly string[],
  readers: Record<string, (item: unknown, where: string) => T | null>,
): Record<string, T[]> {
  const where = fileLabel(file);
  const result: Record<string, T[]> = {};
  if (!(file in files)) {
    report.error(where, 'الملف غير موجود');
    return result;
  }
  const f = fields(report, files[file], where, keys);
  for (const key of keys) {
    const read = readers[key];
    if (!read) continue;
    result[key] = readList(f?.array(key), (item, i) => read(item, `${where}، ${key} ${i + 1}`));
  }
  return result;
}

// ---------- الفحوص بين الملفات ----------

function checkUnique<T>(report: Report, items: T[], id: (item: T) => string, where: (item: T) => string, what: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = id(item);
    if (seen.has(key)) report.error(where(item), `${what} «${key}» مكرر`);
    seen.add(key);
  }
}

function floorOfId(id: string): string | null {
  const room = ROOM_CODE.exec(id);
  if (room) return `${room[1]}-${room[2]}`;
  const other = OTHER_PLACE_ID.exec(id);
  if (other) return `${other[1]}-${other[2]}`;
  return null;
}

function checkFloor(report: Report, floor: Floor, buildings: Map<string, Building>): void {
  const where = `data/floors/${floor.id}.json`;
  const building = buildings.get(floor.building);
  if (!building) {
    report.error(where, `المبنى «${floor.building}» غير موجود في data/buildings.json`);
  } else if (!floor.demo && building.demo) {
    report.error(where, `طابق حقيقي في مبنى تجريبي «${building.id}»`);
  }
  if (floor.id !== `${floor.building}-${floor.level}`) {
    report.error(where, `معرّف الطابق يجب أن يكون «${floor.building}-${floor.level}» (المبنى ثم حرف الطابق)`);
  }
  if (floor.map !== null && !MAP_PATH.test(floor.map)) {
    report.error(where, `مسار الخريطة «${floor.map}» يجب أن يكون مثل maps/${floor.id}.png`);
  }
  if (floor.width <= 0 || floor.height <= 0) {
    report.error(where, 'أبعاد الخريطة (width وheight) يجب أن تكون أكبر من صفر');
  }

  // النقاط
  const points = new Map<string, Point>();
  checkUnique(report, floor.points, (p) => p.id, () => where, 'معرّف النقطة');
  for (const point of floor.points) {
    points.set(point.id, point);
    if (!point.id.startsWith(`${floor.id}:`)) {
      report.error(where, `معرّف النقطة «${point.id}» يجب أن يبدأ بـ «${floor.id}:»`);
    }
    if (point.x < 0 || point.y < 0 || point.x > floor.width || point.y > floor.height) {
      report.error(where, `النقطة «${point.id}» خارج حدود الخريطة`);
    }
  }

  // الممرات
  const pairs = new Set<string>();
  const ratios: { corridor: Corridor; ratio: number }[] = [];
  for (const corridor of floor.corridors) {
    const label = `الممر ${corridor.from} ← ${corridor.to}`;
    const a = points.get(corridor.from);
    const b = points.get(corridor.to);
    if (!a || !b) {
      report.error(where, `${label}: نقطة غير موجودة في هذا الطابق`);
      continue;
    }
    if (a === b) {
      report.error(where, `${label}: البداية والنهاية النقطة نفسها`);
      continue;
    }
    const pair = [a.id, b.id].sort().join('|');
    if (pairs.has(pair)) report.error(where, `${label}: مكرر`);
    pairs.add(pair);
    if (corridor.length_m <= 0) {
      report.error(where, `${label}: الطول بالأمتار يجب أن يكون أكبر من صفر`);
      continue;
    }
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const tilt = (Math.atan2(Math.min(dx, dy), Math.max(dx, dy)) * 180) / Math.PI;
    if (tilt > MAX_TILT_DEGREES) {
      report.error(where, `${label}: مائل ${Math.round(tilt)}°، والممرات متعامدة (أفقي أو رأسي). راجع إحداثيات النقطتين`);
    }
    ratios.push({ corridor, ratio: corridor.length_m / Math.hypot(dx, dy) });
  }

  // اتساق الأمتار مع البكسل: كل الطابق بمقياس رسم واحد، فالممر الشاذ غالباً خطأ قياس أو إدخال.
  if (ratios.length >= MIN_CORRIDORS_FOR_SCALE) {
    const sorted = ratios.map((r) => r.ratio).sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    for (const { corridor, ratio } of ratios) {
      if (Math.abs(ratio - median) / median > SCALE_TOLERANCE) {
        const expected = Math.round((corridor.length_m / ratio) * median * 10) / 10;
        report.warn(
          where,
          `الممر ${corridor.from} ← ${corridor.to}: طوله ${corridor.length_m} م، والمتوقع من الخريطة نحو ${expected} م. راجع القياس أو الإحداثيات`,
        );
      }
    }
  }

  // الأماكن
  for (const place of floor.places) {
    const label = `المكان «${place.id}»`;
    if (!points.has(place.point)) {
      report.error(where, `${label}: النقطة «${place.point}» غير موجودة في هذا الطابق`);
    }
    if (place.id !== place.id.trim()) report.error(where, `${label}: في المعرّف مسافات زائدة`);
    if (CODED_KINDS.includes(place.kind)) {
      if (!ROOM_CODE.test(place.id)) {
        report.error(where, `${label}: الرمز يجب أن يكون بنمط الجامعة مثل ${floor.id}215`);
      }
    } else {
      if (!OTHER_PLACE_ID.test(place.id)) {
        report.error(where, `${label}: المعرّف يجب أن يكون مثل ${floor.id}-WC1 (حروف وأرقام إنجليزية بعد الشرطة)`);
      }
      if (place.name === undefined) report.error(where, `${label}: الاسم ناقص`);
    }
    const placeFloor = floorOfId(place.id);
    if (placeFloor !== null && placeFloor !== floor.id) {
      report.error(where, `${label}: الرمز يدل على الطابق ${placeFloor} لكنه في ملف الطابق ${floor.id}`);
    }
    if (!place.demo && floor.demo) report.error(where, `${label}: مكان حقيقي في طابق تجريبي`);
  }
}

/** الشبكة كاملة متصلة: من أي نقطة يمكن الوصول لأي نقطة أخرى في الكلية. */
function checkConnected(report: Report, floors: Floor[], vertical: VerticalLink[], passages: Passage[], placeById: Map<string, Place>): void {
  const neighbours = new Map<string, string[]>();
  const connect = (a: string, b: string): void => {
    if (!neighbours.has(a) || !neighbours.has(b)) return;
    neighbours.get(a)?.push(b);
    neighbours.get(b)?.push(a);
  };
  for (const floor of floors) for (const point of floor.points) neighbours.set(point.id, []);
  for (const floor of floors) for (const c of floor.corridors) connect(c.from, c.to);
  for (const p of passages) connect(p.from, p.to);
  for (const link of vertical) {
    const stopPoints = link.stops.map((s) => placeById.get(s)?.point).filter((p) => p !== undefined);
    for (let i = 1; i < stopPoints.length; i++) connect(stopPoints[0] as string, stopPoints[i] as string);
  }

  const start = neighbours.keys().next();
  if (start.done) return;
  const reached = new Set<string>([start.value]);
  const queue = [start.value];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const next of neighbours.get(current) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  for (const floor of floors) {
    const cut = floor.points.filter((p) => !reached.has(p.id)).map((p) => p.id);
    if (cut.length > 0) {
      report.error(
        `data/floors/${floor.id}.json`,
        `نقاط لا يمكن الوصول إليها من بقية الكلية: ${cut.join('، ')}. ينقصها ممر أو درج أو مصعد`,
      );
    }
  }
}

export function validateData(files: Record<string, unknown>): ValidationResult {
  const report = new Report();

  for (const file of Object.keys(files)) {
    if (file !== BUILDINGS_FILE && file !== LINKS_FILE && file !== DOCTORS_FILE && !FLOOR_FILE.test(file)) {
      report.error(fileLabel(file), 'ملف غير معروف: الملفات المسموحة buildings.json وlinks.json وdoctors.json وfloors/*.json');
    }
  }

  const { buildings = [] } = readListFile<Building>(report, files, BUILDINGS_FILE, ['buildings'], {
    buildings: (item, where) => readBuilding(report, item, where),
  });
  const links = readListFile<VerticalLink | Passage>(report, files, LINKS_FILE, ['vertical', 'passages'], {
    vertical: (item, where) => readVertical(report, item, where),
    passages: (item, where) => readPassage(report, item, where),
  });
  const vertical = (links.vertical ?? []) as VerticalLink[];
  const passages = (links.passages ?? []) as Passage[];
  const { doctors = [] } = readListFile<Doctor>(report, files, DOCTORS_FILE, ['doctors'], {
    doctors: (item, where) => readDoctor(report, item, where),
  });

  const floors: Floor[] = [];
  for (const [file, value] of Object.entries(files)) {
    const match = FLOOR_FILE.exec(file);
    if (!match) continue;
    const floor = readFloor(report, value, file);
    if (!floor) continue;
    if (floor.id !== match[1]) {
      report.error(fileLabel(file), `اسم الملف يجب أن يطابق معرّف الطابق: ${floor.id}.json`);
    }
    floors.push(floor);
  }
  floors.sort((a, b) => a.id.localeCompare(b.id));
  if (floors.length === 0) report.error('data/floors/', 'لا يوجد أي طابق');

  checkUnique(report, buildings, (b) => b.id, () => 'data/buildings.json', 'المبنى');
  checkUnique(report, floors, (f) => f.id, (f) => `data/floors/${f.id}.json`, 'الطابق');
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  for (const floor of floors) checkFloor(report, floor, buildingById);

  // المعرّفات فريدة في الكلية كلها، لأن البحث والروابط بين الملفات تعتمد عليها.
  const allPlaces = floors.flatMap((f) => f.places.map((place) => ({ place, floor: f })));
  checkUnique(report, allPlaces, (p) => p.place.id, (p) => `data/floors/${p.floor.id}.json`, 'المكان');
  const placeById = new Map(allPlaces.map((p) => [p.place.id, p.place]));
  const placeFloor = new Map(allPlaces.map((p) => [p.place.id, p.floor]));
  const pointFloor = new Map(floors.flatMap((f) => f.points.map((p) => [p.id, f] as const)));

  // الدرج والمصاعد
  checkUnique(report, vertical, (v) => v.id, () => 'data/links.json', 'الدرج أو المصعد');
  const linked = new Map<string, string>();
  for (const link of vertical) {
    const where = `data/links.json، ${link.kind === 'stairs' ? 'الدرج' : 'المصعد'} «${link.id}»`;
    if (link.stops.length < 2) report.error(where, 'يجب أن يقف عند طابقين على الأقل');
    const stopFloors = new Set<string>();
    for (const stop of link.stops) {
      const place = placeById.get(stop);
      const floor = placeFloor.get(stop);
      if (!place || !floor) {
        report.error(where, `المكان «${stop}» غير موجود`);
        continue;
      }
      if (place.kind !== link.kind) report.error(where, `المكان «${stop}» نوعه ${place.kind} لا ${link.kind}`);
      if (stopFloors.has(floor.id)) report.error(where, `يقف مرتين في الطابق ${floor.id}`);
      stopFloors.add(floor.id);
      if (!link.demo && place.demo) report.error(where, `عنصر حقيقي يشير إلى مكان تجريبي «${stop}»`);
      const other = linked.get(stop);
      if (other !== undefined) report.error(where, `المكان «${stop}» مستخدم أيضاً في «${other}»`);
      linked.set(stop, link.id);
    }
    const buildingsOfStops = new Set(link.stops.map((s) => placeFloor.get(s)?.building).filter((b) => b !== undefined));
    if (buildingsOfStops.size > 1) report.error(where, 'الدرج أو المصعد يجب أن يكون في مبنى واحد');
  }
  for (const [id, place] of placeById) {
    if ((place.kind === 'stairs' || place.kind === 'elevator') && !linked.has(id)) {
      report.error(
        `data/floors/${placeFloor.get(id)?.id}.json`,
        `«${id}» لا يربطه شيء في data/links.json بطابق آخر`,
      );
    }
  }

  // الممرات بين الطوابق (مثل الممر بين المبنيين)
  checkUnique(report, passages, (p) => p.id, () => 'data/links.json', 'الممر');
  for (const passage of passages) {
    const where = `data/links.json، الممر «${passage.id}»`;
    const from = pointFloor.get(passage.from);
    const to = pointFloor.get(passage.to);
    if (!from) report.error(where, `النقطة «${passage.from}» غير موجودة`);
    if (!to) report.error(where, `النقطة «${passage.to}» غير موجودة`);
    if (from && to && from === to) report.error(where, 'النقطتان في الطابق نفسه: ضعه في ممرات ملف الطابق');
    if (passage.length_m <= 0) report.error(where, 'الطول بالأمتار يجب أن يكون أكبر من صفر');
    if (!passage.demo && (from?.demo || to?.demo)) report.error(where, 'ممر حقيقي يشير إلى طابق تجريبي');
  }

  // الدكاترة
  checkUnique(report, doctors, (d) => d.id, () => 'data/doctors.json', 'معرّف الدكتور');
  for (const doctor of doctors) {
    const where = `data/doctors.json، «${doctor.name}»`;
    const office = placeById.get(doctor.office);
    if (!office) report.error(where, `المكتب «${doctor.office}» غير موجود في ملفات الطوابق`);
    else if (office.kind !== 'office') report.error(where, `«${doctor.office}» نوعه ${office.kind} لا office`);
    else if (!doctor.demo && office.demo) report.error(where, `دكتور حقيقي في مكتب تجريبي «${doctor.office}»`);
  }

  if (![...placeById.values()].some((p) => p.landmark === true)) {
    report.warn('data/floors/', 'لا يوجد أي معلم (landmark: true)، وقائمة المعالم في الواجهة ستكون فارغة');
  }

  checkConnected(report, floors, vertical, passages, placeById);

  const dataset = report.errors.length === 0 ? { buildings, floors, vertical, passages, doctors } : null;
  return { dataset, errors: report.errors, warnings: report.warnings };
}
