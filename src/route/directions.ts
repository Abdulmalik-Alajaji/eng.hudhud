/**
 * الشرح الكتابي لمقطع من الطريق: يمين/يسار/استمر بالأمتار. الممرات متعامدة، فاتجاه كل جزء
 * يُعرف من إحداثياته على الخريطة، والانعطاف من تغيّر الاتجاه بين جزأين متتاليين.
 */
import { LEVELS, LEVEL_NAMES, type Place } from '../data/types';
import type { Graph, GraphNode } from './graph';
import type { Hop, Leg } from './route';

type Dir = 'E' | 'W' | 'N' | 'S';
const VECTOR: Record<Dir, [number, number]> = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };

export type Turn = 'right' | 'left' | 'straight' | 'back';

/** الاتجاه الغالب لجزء من الطريق على الخريطة، أو null إذا كانت نقطتاه في الموضع نفسه. */
function direction(hop: Hop): Dir | null {
  const dx = hop.to.x - hop.from.x;
  const dy = hop.to.y - hop.from.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

/**
 * الانعطاف من اتجاه إلى آخر. إحداثيات الصورة: x لليمين وy للأسفل، فإذا كان حاصل الضرب الاتجاهي
 * موجباً فالاتجاه الجديد مع عقارب الساعة، أي على يمين الماشي.
 */
export function turnBetween(from: Dir, to: Dir): Turn {
  const [ax, ay] = VECTOR[from];
  const [bx, by] = VECTOR[to];
  const cross = ax * by - ay * bx;
  if (cross > 0) return 'right';
  if (cross < 0) return 'left';
  return ax * bx + ay * by > 0 ? 'straight' : 'back';
}

const TURN_TEXT: Record<Turn, string> = {
  right: 'انعطف يميناً',
  left: 'انعطف يساراً',
  straight: 'استمر',
  back: 'ارجع للخلف',
};

/** جزء مستقيم من الطريق: ممرات متتالية بالاتجاه نفسه، أو ممر بين المبنيين. */
interface Run {
  dir: Dir | null;
  passage?: string;
  meters: number;
  start: GraphNode;
  nodes: GraphNode[];
}

function runs(hops: Hop[]): Run[] {
  const result: Run[] = [];
  for (const hop of hops) {
    const dir = direction(hop);
    const passage = hop.kind === 'passage' ? (hop.via ?? '') : undefined;
    const last = result[result.length - 1];
    const joins = last && passage === undefined && last.passage === undefined && (dir === null || dir === last.dir);
    if (last && joins) {
      last.meters += hop.meters;
      last.nodes.push(hop.to);
    } else {
      result.push({ dir, passage, meters: hop.meters, start: hop.from, nodes: [hop.to] });
    }
  }
  return result;
}

/** وصف المكان في الشرح: الرمز للقاعات، والاسم لغيرها. */
export function placeLabel(place: Place): string {
  const kindName = { room: 'القاعة', lab: 'المعمل', office: 'المكتب' }[place.kind as 'room' | 'lab' | 'office'];
  if (kindName) return place.name ? `${place.name} (${place.id})` : `${kindName} ${place.id}`;
  return place.name ?? place.id;
}

export const meters = (m: number): string => `${Math.max(1, Math.round(m))} م`;

/**
 * طول الخطوة المتوسط لشخص بالغ بالأمتار (تقدير عام، غير مقيس على طلاب الكلية).
 * عدد الخطوات تقريبي لمساعدة الطالب، والمرجع هو الأمتار.
 */
export const STEP_LENGTH_M = 0.75;

/** عدد الخطوات التقريبي: بالضبط حتى 20، ثم مقرّباً لأقرب 5 لأنه تقدير. */
export function stepCount(m: number): number {
  const steps = Math.max(1, Math.round(m / STEP_LENGTH_M));
  return steps > 20 ? Math.round(steps / 5) * 5 : steps;
}

/** «خطوة واحدة»، «خطوتان»، «5 خطوات»، «13 خطوة»، «105 خطوات» حسب قواعد العدد في العربية. */
export function stepsText(n: number): string {
  if (n === 1) return 'خطوة واحدة';
  if (n === 2) return 'خطوتان';
  const rest = n % 100;
  return rest >= 3 && rest <= 10 ? `${n} خطوات` : `${n} خطوة`;
}

/** المسافة كما تُكتب للطالب: «36 م (نحو 50 خطوة)». */
export const distance = (m: number): string => `${meters(m)} (نحو ${stepsText(stepCount(m))})`;

/** أوضح مكان عند النقطة لذكره في الشرح: المرافق والدرج والمداخل أولاً، ثم القاعات (أرقامها على الأبواب). */
function landmarkAt(graph: Graph, node: GraphNode, exclude?: Place): string | null {
  const here = (graph.placesAt.get(node.id) ?? []).filter((p) => p !== exclude);
  const named = here.find((p) => !['room', 'lab', 'office'].includes(p.kind)) ?? here[0];
  return named ? placeLabel(named) : null;
}

export interface LegContext {
  first: boolean;
  last: boolean;
  startLabel: string;
  destination: Place;
}

export function describeLeg(graph: Graph, leg: Omit<Leg, 'steps'>, context: LegContext): string[] {
  const steps: string[] = [];
  const list = runs(leg.hops);
  const goal = context.last ? context.destination : undefined;

  list.forEach((run, index) => {
    const end = run.nodes[run.nodes.length - 1] as GraphNode;
    const walk = run.passage !== undefined
      ? `اعبر ${graph.passageNames.get(run.passage) ?? 'الممر'}: ${distance(run.meters)}`
      : `امشِ ${distance(run.meters)}`;

    if (index === 0) {
      // في البداية لا نعرف أين ينظر الطالب، فنذكر ما سيصل إليه بدل يمين أو يسار.
      const atEnd = goal && end.id === goal.point ? null : landmarkAt(graph, end, goal);
      const ahead = atEnd ?? run.nodes.map((n) => landmarkAt(graph, n, goal)).find((l) => l !== null) ?? null;
      const toward = ahead && run.passage === undefined ? ` باتجاه ${ahead}` : '';
      steps.push(`${context.first ? 'ابدأ من' : 'من'} ${context.startLabel}، ${walk}${toward}`);
      return;
    }

    const previous = list[index - 1] as Run;
    const turn = previous.dir && run.dir ? turnBetween(previous.dir, run.dir) : 'straight';
    const at = landmarkAt(graph, run.start, goal);
    const prefix = at ? `عند ${at}، ` : '';
    if (turn === 'straight') {
      steps.push(run.passage !== undefined ? `${prefix}${walk}` : `${prefix}استمر مستقيماً ${distance(run.meters)}`);
    } else {
      steps.push(`${prefix}${TURN_TEXT[turn]} و${walk}`);
    }
  });

  if (context.last) {
    steps.push(list.length === 0 && context.first ? 'أنت عند وجهتك' : `وصلت إلى ${placeLabel(context.destination)}`);
  } else if (leg.exit?.kind === 'passage') {
    steps.push(`اعبر ${leg.exit.name} إلى ${LEVEL_NAMES[leg.exit.toLevel]}`);
  } else if (leg.exit) {
    const up = LEVELS.indexOf(leg.exit.toLevel) > LEVELS.indexOf(leg.level);
    steps.push(`${up ? 'اصعد' : 'انزل'} ب${leg.exit.place.name ?? 'الدرج'} إلى ${LEVEL_NAMES[leg.exit.toLevel]}`);
  }
  return steps;
}
