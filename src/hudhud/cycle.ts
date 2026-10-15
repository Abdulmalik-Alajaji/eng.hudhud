import {
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  easeOutSine,
} from './easing';
import type { Random } from './random';
import { REST_POSE } from './rig';
import { Track } from './timeline';

export type Level = 'calm' | 'medium' | 'strong';

export interface LevelConfig {
  /** عدد الصواعق في الدورة [أقل، أكثر]. */
  bolts: readonly [number, number];
  /** عدد الدفعات المتتالية بسرعة (صاعقتان خلال ثلث ثانية). */
  bursts: readonly [number, number];
  /** عدد الفروع لكل صاعقة. */
  branches: readonly [number, number];
  /** عدد الشرارات عند الضربة. */
  sparks: readonly [number, number];
  /** قوة التوهج عند نقطة الضربة (0..1). */
  glow: number;
  /** قوة الوميض حول الهدهد (0..1). */
  ambient: number;
  /** عرض الصاعقة بالبكسل. */
  width: number;
}

export const LEVELS: Record<Level, LevelConfig> = {
  calm: { bolts: [3, 3], bursts: [0, 1], branches: [1, 2], sparks: [5, 8], glow: 0.45, ambient: 0.1, width: 1.6 },
  medium: { bolts: [4, 5], bursts: [1, 1], branches: [2, 3], sparks: [9, 14], glow: 0.65, ambient: 0.17, width: 2.1 },
  strong: { bolts: [5, 6], bursts: [1, 2], branches: [3, 5], sparks: [14, 22], glow: 0.85, ambient: 0.26, width: 2.7 },
};

/** حد السلامة: لا أكثر من 3 ومضات في أي ثانية. */
export const MAX_FLASHES_PER_SECOND = 3;
/** مدة الومضة الواحدة، والفاصل بين ومضات الصاعقة نفسها، والتلاشي بعد آخر ومضة (ملّي ثانية). */
export const PULSE_ON = 65;
export const PULSE_GAP: readonly [number, number] = [55, 95];
export const PULSE_FADE = 240;

export type StrikeTarget = 'crest' | 'head' | 'back';

export interface BoltEvent {
  /** بداية الصاعقة من بداية الدورة (ملّي ثانية). */
  start: number;
  /** بدايات الومضات (ملّي ثانية من بداية الدورة)، أولها = start. */
  pulses: number[];
  end: number;
  target: StrikeTarget;
  /** اتجاه قدوم الصاعقة: الزاوية عن الأعلى بالراديان (سالب = من اليسار، موجب = من اليمين). */
  angle: number;
  branches: number;
  sparks: number;
  seed: number;
}

export type Channel = 'body' | 'head' | 'flip' | 'crest' | 'tail';

export interface Cycle {
  duration: number;
  tracks: Record<Channel, Track>;
  bolts: BoltEvent[];
}

function newTracks(): Record<Channel, Track> {
  return {
    body: new Track(REST_POSE.body),
    head: new Track(REST_POSE.head),
    flip: new Track(REST_POSE.flip),
    crest: new Track(REST_POSE.crest),
    tail: new Track(REST_POSE.tail),
  };
}

/**
 * نقرة: تحضير (الرأس يرتفع قليلاً) ← نزول سريع ← لحظة ملامسة ← ارتداد بتجاوز بسيط ← استقرار.
 * الجسم يميل قليلاً متأخراً عن الرأس، والذيل يرتفع للتوازن متأخراً أكثر.
 */
function peck(tracks: Record<Channel, Track>, t0: number, rng: Random): number {
  const { head, body, tail, crest } = tracks;
  const anticipation = rng.jitter(150);
  const down = rng.jitter(115);
  const contact = rng.jitter(55);
  const recover = rng.jitter(330);
  const depth = -rng.range(52, 66);
  const lean = -rng.range(10, 14);

  const tDown = t0 + anticipation;
  const tHit = tDown + down;
  const tUp = tHit + contact;

  head.wait(t0).to(tDown, rng.range(6, 10), easeInOutSine).to(tHit, depth, easeInCubic).wait(tUp);
  head.to(tUp + recover, 0, easeOutBack(1.9));

  body.wait(t0).to(tDown, 1.5, easeInOutSine).to(tHit + 40, lean, easeInOutCubic).wait(tUp + 20);
  body.to(tUp + recover + 80, 0, easeOutBack(1.5));

  tail.wait(t0 + 40).to(tDown + 30, 2, easeInOutSine).to(tHit + 90, -rng.range(9, 14), easeOutCubic);
  tail.to(tUp + recover + 160, 0, easeOutBack(2.2));

  // التاج ينضغط على الرأس أثناء النقر، ثم يعود.
  crest.wait(t0).to(tHit, 0, easeInOutSine).wait(tUp).to(tUp + recover + 120, REST_POSE.crest, easeOutBack(1.6));

  return tUp + recover;
}

/** التفات: يرفع رأسه ← يُفرد تاجه ← يلتفت للخلف ← يتلفّت قليلاً ← يعود ← ينطوي التاج ببطء. */
function look(tracks: Record<Channel, Track>, t0: number, rng: Random): number {
  const { head, flip, crest, body } = tracks;
  const lift = rng.jitter(260);
  const turn = rng.jitter(230);
  const stay = rng.range(650, 1250);
  const tilt = rng.range(9, 15);

  head.wait(t0).to(t0 + 90, -3, easeInOutSine).to(t0 + 90 + lift, tilt, easeOutBack(1.6));
  body.wait(t0).to(t0 + lift, 1.5, easeInOutSine);

  const tOpen = t0 + 120;
  crest.wait(tOpen).to(tOpen + rng.jitter(190), 1, easeOutBack(2.4));

  const tTurn = t0 + 90 + lift * 0.7;
  flip.wait(tTurn).to(tTurn + turn, -1, easeInOutCubic);
  const tMid = tTurn + turn + stay / 2;
  head.wait(tTurn + turn + 60).to(tMid, tilt + rng.range(-6, 4), easeInOutSine);
  const tBack = tTurn + turn + stay;
  head.wait(tBack);
  flip.wait(tBack).to(tBack + turn, 1, easeInOutCubic);
  head.to(tBack + turn + rng.jitter(320), 0, easeOutBack(1.4));
  body.wait(tBack).to(tBack + 300, 0, easeOutSine);
  crest.wait(tBack + turn).to(tBack + turn + rng.jitter(650), REST_POSE.crest, easeInOutSine);

  return tBack + turn + 320;
}

/** عدد الومضات في أي نافذة مدتها ثانية تنتهي عند t (مع t نفسها). */
function flashesBefore(pulses: readonly number[], t: number): number {
  let count = 0;
  for (const p of pulses) if (p > t - 1000 && p <= t) count++;
  return count;
}

function pulseTrain(start: number, count: number, rng: Random): number[] {
  const pulses = [start];
  for (let i = 1; i < count; i++) {
    pulses.push((pulses[i - 1] as number) + PULSE_ON + rng.range(PULSE_GAP[0], PULSE_GAP[1]));
  }
  return pulses;
}

/** يؤخر الصاعقة حتى لا تتجاوز أي نافذة مدتها ثانية 3 ومضات. */
function placeBolt(start: number, count: number, taken: number[], rng: Random): number[] {
  let pulses = pulseTrain(start, count, rng);
  for (let guard = 0; guard < 200; guard++) {
    const all = [...taken, ...pulses].sort((a, b) => a - b);
    const ok = pulses.every((p) => flashesBefore(all, p) <= MAX_FLASHES_PER_SECOND) &&
      taken.every((p) => flashesBefore(all, p) <= MAX_FLASHES_PER_SECOND);
    if (ok) return pulses;
    pulses = pulses.map((p) => p + 50);
  }
  return pulses;
}

const TARGETS: readonly StrikeTarget[] = ['crest', 'crest', 'crest', 'head', 'back', 'back'];

/**
 * زوايا القدوم المسموحة لكل هدف (راديان عن الأعلى، السالب من اليسار) حتى لا تعبر الصاعقة جسم الهدهد:
 * الظهر يُضرب من الأعلى أو اليمين فقط، والرأس من الأعلى أو اليسار (أمام المنقار).
 */
export const APPROACH: Record<StrikeTarget, readonly [number, number]> = {
  crest: [-1.15, 1.15],
  head: [-1.2, 0.15],
  back: [0.1, 1.15],
};

/**
 * دورة كاملة: سكون ← نقرات (1 إلى 3) ← التفات، مع صواعق موزعة. كل التوقيتات تتغير قليلاً بين دورة وأخرى.
 * carry: بدايات ومضات الدورة السابقة (بتوقيت هذه الدورة، أي سالبة) حتى يبقى حد السلامة صحيحاً عبر الدورتين.
 */
export function buildCycle(rng: Random, level: Level, carry: readonly number[] = []): Cycle {
  const config = LEVELS[level];
  const tracks = newTracks();

  let t = rng.range(250, 700);
  const pecks = rng.int(1, 3);
  for (let i = 0; i < pecks; i++) {
    t = peck(tracks, t, rng) + rng.range(120, 380);
  }
  t += rng.range(200, 500);
  const lookStart = t;
  t = look(tracks, t, rng);
  const motionEnd = t + rng.range(250, 650);

  // أوقات الصواعق: دفعات (صاعقتان متتاليتان) وصواعق منفردة، موزعة على الدورة.
  const total = rng.int(config.bolts[0], config.bolts[1]);
  const bursts = Math.min(rng.int(config.bursts[0], config.bursts[1]), Math.floor(total / 2));
  const groups: number[][] = [];
  for (let i = 0; i < bursts; i++) groups.push([2, 1]);
  for (let i = 0; i < total - bursts * 2; i++) groups.push([rng.int(2, 3)]);
  // ترتيب عشوائي، مع وضع مجموعة عند الالتفات (الهدهد يتفاجأ).
  groups.sort(() => rng.next() - 0.5);
  const anchors = groups.map((_, i) => 200 + ((i + rng.range(0.1, 0.8)) * (motionEnd - 400)) / groups.length);
  if (anchors.length > 1) anchors[Math.floor(groups.length / 2)] = lookStart + rng.range(60, 200);
  anchors.sort((a, b) => a - b);

  const taken = [...carry];
  const bolts: BoltEvent[] = [];
  let side = rng.chance(0.5) ? 1 : -1;
  groups.forEach((group, g) => {
    let start = Math.max(anchors[g] as number, (bolts[bolts.length - 1]?.start ?? -Infinity) + 120);
    group.forEach((count, i) => {
      if (i > 0) start = (bolts[bolts.length - 1] as BoltEvent).pulses.at(-1)! + rng.range(90, 160);
      const pulses = placeBolt(start, count, taken, rng);
      taken.push(...pulses);
      side = rng.chance(0.75) ? -side : side;
      const target = TARGETS[rng.int(0, TARGETS.length - 1)] as StrikeTarget;
      const [min, max] = APPROACH[target];
      // يتناوب الجانب قدر الإمكان ضمن الزوايا المسموحة للهدف.
      const wanted = side * rng.range(0.15, 1.15);
      const angle = Math.min(max, Math.max(min, wanted));
      bolts.push({
        start: pulses[0] as number,
        pulses,
        end: (pulses.at(-1) as number) + PULSE_ON + PULSE_FADE,
        target,
        angle,
        branches: rng.int(config.branches[0], config.branches[1]),
        sparks: rng.int(config.sparks[0], config.sparks[1]),
        seed: rng.seed(),
      });
      start = pulses.at(-1) as number;
    });
  });

  const lastBolt = bolts.reduce((m, b) => Math.max(m, b.end), 0);
  const duration = Math.max(motionEnd, lastBolt + 500);
  return { duration, tracks, bolts };
}

/** شدة إضاءة الصاعقة في الزمن t (0..1): ومضات تظهر وتختفي ثم تتلاشى. */
export function boltIntensity(bolt: BoltEvent, t: number): number {
  if (t < bolt.start || t > bolt.end) return 0;
  const pulses = bolt.pulses;
  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i] as number;
    const last = i === pulses.length - 1;
    if (t >= p && t < p + PULSE_ON) {
      const attack = Math.min(1, (t - p) / 12);
      return attack;
    }
    if (last && t >= p + PULSE_ON) {
      return Math.exp(-(t - p - PULSE_ON) / (PULSE_FADE / 3.5));
    }
    const next = pulses[i + 1];
    if (next !== undefined && t >= p + PULSE_ON && t < next) return 0.06;
  }
  return 0;
}
