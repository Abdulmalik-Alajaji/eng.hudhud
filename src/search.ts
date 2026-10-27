/**
 * البحث عن قاعة أو مرفق أو دكتور كما يكتبه الطالب: بلا تمييز بين الهمزات (أ إ آ ا)،
 * ولا بين التاء المربوطة والهاء، ولا بين الألف المقصورة والياء، وبالأرقام العربية أو الهندية،
 * والرمز بشرطة أو بدونها (B1-F215 أو b1f215 أو F215 أو 215).
 */
import { CODED_KINDS, LEVEL_NAMES, PLACE_KIND_NAMES, type Dataset, type Floor, type Place } from './data/types';
import { placeLabel } from './route/directions';

/** النص بصيغة موحّدة للمقارنة: حروف صغيرة، بلا تشكيل ولا تطويل، والهمزات والتاء المربوطة والألف المقصورة موحّدة. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * هل يطابق الاسم ما كتبه الطالب؟ أي جزء من الاسم («مكتبة» تجد «المكتبة المركزية»)، بلا فروق الهمزات
 * والتاء المربوطة والألف المقصورة والتشكيل والمسافات الزائدة. إن كتب أكثر من كلمة فكلها يجب أن توجد.
 * النص الفارغ يطابق كل شيء.
 */
export function nameMatches(name: string, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const n = normalizeText(name);
  return q.split(' ').every((word) => n.includes(word));
}

/** الرمز بلا مسافات ولا شرطات: B1-F215 ← b1f215. */
const compact = (text: string): string => normalizeText(text).replace(/ /g, '');

export interface SearchEntry {
  /** القيمة المختارة: معرّف المكان، أو doctor:d1. */
  value: string;
  title: string;
  detail: string;
  /** رمز الجامعة إن وجد (B1-F215). */
  code?: string;
  /** كلمات أخرى يُبحث فيها ولا تُعرض كلها (نوع المكان، أسماء الدكاترة في المكتب). */
  keywords?: string[];
}

interface Indexed {
  entry: SearchEntry;
  code: string;
  words: string[];
  text: string;
}

export interface SearchIndex {
  entries: Indexed[];
}

export function createIndex(entries: SearchEntry[]): SearchIndex {
  return {
    entries: entries.map((entry) => {
      const text = normalizeText([entry.title, ...(entry.keywords ?? [])].join(' '));
      return { entry, code: entry.code ? compact(entry.code) : '', words: text.split(' '), text };
    }),
  };
}

function score(item: Indexed, query: string, tokens: string[]): number {
  const q = query.replace(/ /g, '');
  if (item.code) {
    if (item.code === q) return 100;
    if (item.code.startsWith(q)) return 80;
    // رقم الغرفة وحده (215) أو الطابق مع الرقم (f215).
    if (item.code.endsWith(q)) return 70;
    if (item.code.includes(q)) return 50;
  }
  if (tokens.every((t) => item.words.some((w) => w.startsWith(t)))) return 60;
  if (tokens.every((t) => item.text.includes(t))) return 40;
  return 0;
}

/** أفضل النتائج أولاً: الرمز المطابق تماماً، ثم بداية الرمز أو الكلمة، ثم ما يحتوي النص. */
export function search(index: SearchIndex, query: string, limit = 8): SearchEntry[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const tokens = normalized.split(' ');
  return index.entries
    .map((item, order) => ({ item, order, score: score(item, normalized, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.item.entry);
}

/** «المبنى 1 · الطابق الأول». */
function whereOf(dataset: Dataset, floor: Floor): string {
  const building = dataset.buildings.find((b) => b.id === floor.building);
  return [building?.name ?? floor.building, LEVEL_NAMES[floor.level]].join(' · ');
}

/** المكان كما يظهر في نتائج البحث: الرمز أو الاسم، وتحته المبنى والطابق. */
export function placeEntry(dataset: Dataset, place: Place, floor: Floor): SearchEntry {
  const where = whereOf(dataset, floor);
  const doctors = dataset.doctors.filter((d) => d.office === place.id).map((d) => d.name);
  const coded = CODED_KINDS.includes(place.kind);
  return {
    value: place.id,
    title: placeLabel(place),
    detail: doctors.length > 0 ? `${where} · ${doctors.join('، ')}` : where,
    code: coded ? place.id : undefined,
    keywords: [PLACE_KIND_NAMES[place.kind], ...doctors],
  };
}

/** كلمات تُضاف لأسماء الدكاترة حتى يجدها من يكتب «دكتور» أو «الدكتورة» بدل «د.». */
const DOCTOR_WORDS = ['دكتور', 'الدكتور', 'دكتورة', 'الدكتورة'];

export interface EntryOptions {
  /** إضافة الدكاترة إلى النتائج (للوجهة فقط). */
  doctors?: boolean;
}

/** كل ما يمكن البحث عنه في البيانات: الأماكن (بترتيب الطوابق) والدكاترة. */
export function datasetEntries(dataset: Dataset, options: EntryOptions = {}): SearchEntry[] {
  const entries: SearchEntry[] = [];
  if (options.doctors) {
    for (const doctor of dataset.doctors) {
      const floor = dataset.floors.find((f) => f.places.some((p) => p.id === doctor.office));
      entries.push({
        value: `doctor:${doctor.id}`,
        title: doctor.name,
        detail: [`مكتب ${doctor.office}`, floor ? whereOf(dataset, floor) : ''].filter(Boolean).join(' · '),
        keywords: DOCTOR_WORDS,
      });
    }
  }
  for (const floor of dataset.floors) {
    for (const place of floor.places) {
      entries.push(placeEntry(dataset, place, floor));
    }
  }
  return entries;
}
