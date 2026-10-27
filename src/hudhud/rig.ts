import { RIG_JOINTS, RIG_PARTS, type Point } from './rig-data';

/** مصفوفة تحويل ثنائية الأبعاد بنفس ترتيب canvas: [a b c d e f]. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Matrix, [x, y]: Point): Point {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const rotate = (rad: number): Matrix => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
};
const scale = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];

/** تحويل m حول النقطة p: انقل p إلى الأصل، طبّق m، ثم أرجعها. */
function around([x, y]: Point, m: Matrix): Matrix {
  return multiply(translate(x, y), multiply(m, translate(-x, -y)));
}

const DEG = Math.PI / 180;

/**
 * وضعية الهدهد. الزوايا بالدرجات، والموجب مع عقارب الساعة على الشاشة.
 * الهدهد ينظر لليسار، لذلك: الرأس السالب ينزل نحو الأرض، والجسم السالب يميل للأمام، والذيل السالب يرتفع.
 */
export interface Pose {
  body: number;
  head: number;
  /** 1 = الرأس للأمام، -1 = ملتفت للخلف. */
  flip: number;
  /**
   * ميل التاج بالدرجات، قطعة واحدة صلبة لا تنثني: 0 كما في الصورة، الموجب ينضغط للخلف، والسالب يرتفع.
   * الحركة خفيفة (بضع درجات) لأن ريش الهدهد لا ينثني كالمطاط.
   */
  crest: number;
  tail: number;
  /** 0..1: التنفّس. */
  breath: number;
  /** ارتجاف الضربة بوحدات الشكل. */
  joltX: number;
  joltY: number;
}

export const REST_POSE: Pose = {
  body: 0,
  head: 0,
  flip: 1,
  crest: 0,
  tail: 0,
  breath: 0,
  joltX: 0,
  joltY: 0,
};

export type PartName = keyof typeof RIG_PARTS;
export const PART_ORDER: readonly PartName[] = ['legs', 'tail', 'body', 'head', 'crest'];

const BREATH_SCALE = 0.018;

/** مصفوفة كل جزء في هذه الوضعية: الساقان ← الجسم ← (الذيل، الرأس ← التاج). */
export function partMatrices(pose: Pose): Record<PartName, Matrix> {
  const legs = IDENTITY;
  const breath = around(RIG_JOINTS.breath, scale(1 + BREATH_SCALE * pose.breath, 1 + BREATH_SCALE * 0.6 * pose.breath));
  const body = multiply(
    translate(pose.joltX, pose.joltY),
    multiply(around(RIG_JOINTS.hip, rotate(pose.body * DEG)), breath),
  );
  const tail = multiply(body, around(RIG_JOINTS.tail, rotate(pose.tail * DEG)));
  const head = multiply(
    body,
    around(RIG_JOINTS.neck, multiply(rotate(pose.head * DEG), scale(pose.flip, 1))),
  );

  // التاج قطعة صلبة لا يتغير شكله. ينضغط للخلف حول مقدّم قاعدته، ويرتفع حول مؤخرها،
  // فتبقى القاعدة ملتصقة بالرأس في الحالتين ولا تظهر فجوة.
  const [front, back] = RIG_JOINTS.crestBase;
  const crest = multiply(head, around(pose.crest >= 0 ? front : back, rotate(pose.crest * DEG)));

  return { legs, tail, body, head, crest };
}

/** موضع نقطة من جزء معيّن على الشاشة (بوحدات الشكل) في هذه الوضعية. */
export function worldPoint(pose: Pose, part: PartName, point: Point): Point {
  return apply(partMatrices(pose)[part], point);
}

let paths: Record<PartName, Path2D> | null = null;

function partPaths(): Record<PartName, Path2D> {
  if (!paths) {
    paths = {
      legs: new Path2D(RIG_PARTS.legs),
      tail: new Path2D(RIG_PARTS.tail),
      body: new Path2D(RIG_PARTS.body),
      head: new Path2D(RIG_PARTS.head),
      crest: new Path2D(RIG_PARTS.crest),
    };
  }
  return paths;
}

const DEBUG_COLORS: Record<PartName, string> = {
  legs: '#ff9f43',
  tail: '#a29bfe',
  body: '#4fc3f7',
  head: '#55efc4',
  crest: '#fd79a8',
};

/** ألوان اختيارية لكل جزء، وخطوط على الذيل (لوحة المظهر الفاتح، انظر palette.ts). */
export interface RigStyle {
  parts?: Partial<Record<PartName, string>>;
  stripes?: string;
}

/**
 * خطوط عرضية على الذيل، داخل حدوده فقط (لا تغيّر شكله): عمودية على محوره من مفصله إلى طرفه،
 * كخطوط ذيل الهدهد الحقيقي.
 */
function drawTailStripes(ctx: CanvasRenderingContext2D, tail: Path2D, color: string): void {
  const [jx, jy] = RIG_JOINTS.tail;
  const axis = Math.atan2(TAIL_TIP[1] - jy, TAIL_TIP[0] - jx);
  const along: Point = [Math.cos(axis), Math.sin(axis)];
  const across: Point = [-along[1], along[0]];
  ctx.save();
  ctx.clip(tail, 'evenodd');
  ctx.strokeStyle = color;
  ctx.lineWidth = TAIL_STRIPE.width;
  for (let d = TAIL_STRIPE.start; d < TAIL_STRIPE.end; d += TAIL_STRIPE.gap) {
    const cx = jx + along[0] * d;
    const cy = jy + along[1] * d;
    ctx.beginPath();
    ctx.moveTo(cx - across[0] * 200, cy - across[1] * 200);
    ctx.lineTo(cx + across[0] * 200, cy + across[1] * 200);
    ctx.stroke();
  }
  ctx.restore();
}

/** طرف الذيل التقريبي في مساحة الشكل (لاتجاه الخطوط فقط). */
const TAIL_TIP: Point = [690, 600];
const TAIL_STRIPE = { start: 70, end: 240, gap: 46, width: 14 };

/** يرسم الهدهد. view: تحويل مساحة الشكل إلى بكسلات الـ canvas. debug: كل جزء بلون مع مفاصله. */
export function drawRig(
  ctx: CanvasRenderingContext2D,
  view: Matrix,
  pose: Pose,
  color: string,
  debug = false,
  style: RigStyle = {},
): void {
  const matrices = partMatrices(pose);
  const shapes = partPaths();
  for (const name of PART_ORDER) {
    const m = multiply(view, matrices[name]);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.fillStyle = debug ? DEBUG_COLORS[name] : (style.parts?.[name] ?? color);
    if (debug) ctx.globalAlpha = 0.85;
    ctx.fill(shapes[name], 'evenodd');
    ctx.globalAlpha = 1;
    if (name === 'tail' && style.stripes && !debug) drawTailStripes(ctx, shapes.tail, style.stripes);
  }
  if (debug) {
    const joints: [PartName, Point][] = [
      ['legs', RIG_JOINTS.hip],
      ['body', RIG_JOINTS.neck],
      ['body', RIG_JOINTS.tail],
      ['head', RIG_JOINTS.crestBase[0]],
      ['head', RIG_JOINTS.crestBase[1]],
    ];
    ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    for (const [part, joint] of joints) {
      const [x, y] = apply(matrices[part], joint);
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
