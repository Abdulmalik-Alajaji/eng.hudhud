/**
 * صيغة بيانات الكلية. الشرح الكامل للفريق في data/README.md.
 *
 * الكلية «شبكة»: نقاط على خريطة كل طابق تربطها ممرات بأطوال مقاسة بالأمتار.
 * القاعات والمرافق تقع عند نقاط من الشبكة، والدرج والمصاعد تربط الطوابق،
 * والممرات بين المبنيين تربط طابقاً في مبنى بطابق في المبنى الآخر.
 */

/** الطوابق التي تدخل في البيانات: الأرضي والأول والثاني (الطابق الثالث لا يعني الطلاب). */
export const LEVELS = ['G', 'F', 'S'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_NAMES: Record<Level, string> = {
  G: 'الطابق الأرضي',
  F: 'الطابق الأول',
  S: 'الطابق الثاني',
};

export const PLACE_KINDS = ['room', 'lab', 'office', 'facility', 'entrance', 'stairs', 'elevator'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const PLACE_KIND_NAMES: Record<PlaceKind, string> = {
  room: 'قاعة',
  lab: 'معمل',
  office: 'مكتب',
  facility: 'مرفق',
  entrance: 'مدخل',
  stairs: 'درج',
  elevator: 'مصعد',
};

/** الأنواع التي معرّفها رمز الجامعة مثل B1-F215. */
export const CODED_KINDS: readonly PlaceKind[] = ['room', 'lab', 'office'];

export interface Building {
  /** B ثم رقم المبنى: B1 أو B2. */
  id: string;
  name: string;
  demo: boolean;
}

/** نقطة على خريطة الطابق بالبكسل. المعرّف يبدأ بمعرّف الطابق: B1-G:p3. */
export interface Point {
  id: string;
  x: number;
  y: number;
}

/** ممر مستقيم بين نقطتين. الطول بالأمتار من قياس الفريق هو المرجع، والبكسل للرسم فقط. */
export interface Corridor {
  from: string;
  to: string;
  length_m: number;
}

export interface Place {
  /** رمز الجامعة للقاعات والمعامل والمكاتب (B1-F215)، وغيرها مثل B1-G-WC1. */
  id: string;
  kind: PlaceKind;
  /** اختياري للقاعات والمعامل والمكاتب (يُعرض الرمز)، ومطلوب لغيرها. */
  name?: string;
  /** النقطة التي يقع عندها الباب. */
  point: string;
  /** يظهر في قائمة المعالم التي يختار منها الطالب موقعه. */
  landmark?: boolean;
  demo: boolean;
}

export interface Floor {
  /** المبنى ثم حرف الطابق: B1-G. يطابق اسم الملف data/floors/B1-G.json. */
  id: string;
  building: string;
  level: Level;
  /** صورة الخريطة داخل public/ (مثل maps/B1-G.png)، أو null حتى تصل. */
  map: string | null;
  /** أبعاد الخريطة بالبكسل: إحداثيات النقاط داخلها. */
  width: number;
  height: number;
  demo: boolean;
  points: Point[];
  corridors: Corridor[];
  places: Place[];
}

/** درج أو مصعد: يربط أماكنه (من النوع نفسه) في طوابق المبنى. */
export interface VerticalLink {
  id: string;
  kind: 'stairs' | 'elevator';
  /** معرّفات أماكن الدرج أو المصعد في كل طابق يقف عنده، طابق مختلف لكل واحد. */
  stops: string[];
  demo: boolean;
}

/** ممر يربط نقطتين في طابقين مختلفين، مثل الممر بين المبنيين. */
export interface Passage {
  id: string;
  name: string;
  from: string;
  to: string;
  length_m: number;
  demo: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  /** رمز المكتب، ويجب أن يكون مكاناً من النوع office. */
  office: string;
  demo: boolean;
}

export interface Dataset {
  buildings: Building[];
  floors: Floor[];
  vertical: VerticalLink[];
  passages: Passage[];
  doctors: Doctor[];
}
