import { easeInOutSine, easeOutBack } from './easing';
import { APPROACH, type BoltEvent, type Cycle, type Level, LEVELS, PULSE_ON, type StrikeTarget, boltIntensity, buildCycle } from './cycle';
import { type BoltShape, generateBolt } from './lightning';
import { createRandom } from './random';
import { type Matrix, type PartName, type Pose, REST_POSE, drawRig, worldPoint } from './rig';
import type { Point } from './rig-data';

/** المساحة التي يغطيها الـ canvas بوحدات الشكل (الهدهد 725×617)، أوسع من الهدهد لتأتي الصواعق من بعيد. */
export const SCENE = { left: -190, top: -300, right: 915, bottom: 760 } as const;
export const SCENE_WIDTH = SCENE.right - SCENE.left;
export const SCENE_HEIGHT = SCENE.bottom - SCENE.top;

/** نقاط الضربة على كل جزء (بإحداثيات الجزء قبل الحركة). */
const TARGETS: Record<StrikeTarget, [PartName, Point]> = {
  crest: ['crest', [300, 42]],
  head: ['head', [250, 120]],
  back: ['body', [468, 332]],
};

/** مركز الوميض حول الهدهد ونصف قطره: يتلاشى قبل حافة الـ canvas فلا يظهر له حد. */
const AMBIENT_CENTER: Point = [360, 330];
const AMBIENT_RADIUS = 420;

const BREATH_PERIOD = 3600;

/** ارتفاع التاج مع الضربة بالدرجات (سالب = يرتفع). */
const CREST_FLARE = -6;
/** الريش يتأخر قليلاً عن حركة الرأس ثم يلحق به: الميل بالدرجات لكل درجة تحركها الرأس في LAG_WINDOW. */
const LAG_GAIN = 0.15;
const LAG_WINDOW = 60;
const LAG_MAX = 7;

/** تأخر الريش عن الرأس: إذا نزل الرأس بسرعة ينضغط التاج للخلف قليلاً، وإذا ارتفع يرتفع التاج، ثم يستقر. */
function crestLag(head: Cycle['tracks']['head'], t: number): number {
  const lag = -LAG_GAIN * (head.sample(t) - head.sample(Math.max(0, t - LAG_WINDOW)));
  return Math.max(-LAG_MAX, Math.min(LAG_MAX, lag));
}
const SPARK_LIFE: readonly [number, number] = [420, 820];
const GRAVITY = 1500;
const DRAG = 3.2;

/** شكل الصاعقة مع الجزء الذي تضربه، حتى يتبع طرفها الجزء إذا تحرك أثناء الوميض. */
interface AimedBolt {
  shape: BoltShape;
  part: PartName;
  point: Point;
}

interface PlacedCycle {
  start: number;
  cycle: Cycle;
}

export interface Colors {
  bird: string;
  bolt: string;
  halo: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function tint(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb || amount <= 0) return hex;
  const [r, g, b] = rgb.map((c) => Math.round(c + (255 - c) * Math.min(1, amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

/** مشهد الهدهد: يبني الدورات بالتتابع ويرسم أي لحظة زمنية. نفس البذرة = نفس المشهد. */
export class HudhudScene {
  private cycles: PlacedCycle[] = [];
  private rng;
  private shapes = new WeakMap<BoltEvent, AimedBolt>();

  constructor(
    readonly level: Level,
    private readonly seed: number,
  ) {
    this.rng = createRandom(seed);
  }

  /** الدورة التي تحتوي الزمن t، والدورة التي قبلها (لصواعق وشرارات ما زالت تتلاشى). */
  private locate(t: number): { current: PlacedCycle; previous: PlacedCycle | undefined } {
    const first = this.cycles[0];
    if (!first || t < first.start) {
      this.cycles = [];
      this.rng = createRandom(this.seed);
      this.shapes = new WeakMap();
    }
    if (this.cycles.length === 0) {
      this.cycles.push({ start: 0, cycle: buildCycle(this.rng, this.level) });
    }
    let last = this.cycles[this.cycles.length - 1] as PlacedCycle;
    while (t >= last.start + last.cycle.duration) {
      const duration = last.cycle.duration;
      const carry = last.cycle.bolts.flatMap((b) => b.pulses).map((p) => p - duration).filter((p) => p > -1000);
      last = { start: last.start + duration, cycle: buildCycle(this.rng, this.level, carry) };
      this.cycles.push(last);
      if (this.cycles.length > 4) this.cycles.shift();
    }
    const index = this.cycles.findIndex((c) => t >= c.start && t < c.start + c.cycle.duration);
    return { current: this.cycles[index] as PlacedCycle, previous: this.cycles[index - 1] };
  }

  /** الصواعق التي قد تؤثر في الزمن t، بتوقيت محلي لكل منها. */
  private activeBolts(t: number): { bolt: BoltEvent; local: number; origin: number }[] {
    const { current, previous } = this.locate(t);
    const list: { bolt: BoltEvent; local: number; origin: number }[] = [];
    for (const placed of previous ? [previous, current] : [current]) {
      for (const bolt of placed.cycle.bolts) {
        const local = t - placed.start;
        if (local >= bolt.start && local <= bolt.end + SPARK_LIFE[1] + 400) {
          list.push({ bolt, local, origin: placed.start });
        }
      }
    }
    return list;
  }

  /** وضعية الهدهد في الزمن t: الحركة المجدولة + التنفّس + ردّ الفعل على الضربات. */
  pose(t: number): Pose {
    const { current } = this.locate(t);
    const local = t - current.start;
    const tracks = current.cycle.tracks;
    const pose: Pose = {
      body: tracks.body.sample(local),
      head: tracks.head.sample(local),
      flip: tracks.flip.sample(local),
      crest: tracks.crest.sample(local) + crestLag(tracks.head, local),
      tail: tracks.tail.sample(local),
      breath: 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_PERIOD),
      joltX: 0,
      joltY: 0,
    };
    for (const { bolt, local: l } of this.activeBolts(t)) {
      const dt = l - bolt.start;
      if (dt < 0 || dt > 1400) continue;
      // التاج يرتفع قليلاً بسرعة مع الضربة ثم يعود ببطء.
      const flare =
        dt < 110
          ? CREST_FLARE * easeOutBack(2.6)(dt / 110)
          : dt < 380
            ? CREST_FLARE
            : CREST_FLARE * (1 - easeInOutSine(Math.min(1, (dt - 380) / 900)));
      pose.crest = Math.min(pose.crest, REST_POSE.crest + flare);
      // ارتجافة قصيرة تخمد بسرعة.
      const decay = Math.exp(-dt / 120);
      pose.joltX += 6 * decay * Math.sin(dt / 17);
      pose.joltY += -3 * decay * Math.abs(Math.cos(dt / 23));
    }
    return pose;
  }

  private aimedBolt(bolt: BoltEvent, origin: number): AimedBolt {
    let aimed = this.shapes.get(bolt);
    if (!aimed) {
      const pose = this.pose(origin + bolt.start);
      // إذا كان الهدهد ملتفتاً، المنقار يشير للجهة الأخرى: نضرب التاج حتى لا تعبر الصاعقة المنقار.
      const aim: StrikeTarget = pose.flip < 0.5 ? 'crest' : bolt.target;
      const [min, max] = APPROACH[aim];
      const angle = Math.min(max, Math.max(min, bolt.angle));
      const [part, point] = TARGETS[aim];
      const target = worldPoint(pose, part, point);
      // من الهدف نحو الأعلى بزاوية القدوم حتى حافة المشهد.
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);
      const tx = dx > 0 ? (SCENE.right - target[0]) / dx : dx < 0 ? (SCENE.left - target[0]) / dx : Infinity;
      const ty = (SCENE.top - target[1]) / dy;
      const reach = Math.min(tx, ty);
      const from: Point = [target[0] + dx * reach, target[1] + dy * reach];
      aimed = { shape: generateBolt(createRandom(bolt.seed), from, target, bolt.branches), part, point };
      this.shapes.set(bolt, aimed);
    }
    return aimed;
  }

  /**
   * الصاعقة في اللحظة الحالية: طرفها يتبع نقطة الضربة إذا تحرك الهدهد، وبدايتها في السماء ثابتة.
   * كل نقطة تُزاح بنسبة موقعها على الطريق (0 عند البداية، 1 عند الطرف).
   */
  private boltShape(bolt: BoltEvent, origin: number, pose: Pose): BoltShape {
    const { shape, part, point } = this.aimedBolt(bolt, origin);
    const now = worldPoint(pose, part, point);
    const end = shape.main.at(-1) as Point;
    const dx = now[0] - end[0];
    const dy = now[1] - end[1];
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return shape;
    const last = shape.main.length - 1;
    const shift = (p: Point, w: number): Point => [p[0] + dx * w, p[1] + dy * w];
    const main = shape.main.map((p, i) => shift(p, i / last));
    const branches = shape.branches.map((branch) => {
      const index = shape.main.findIndex((p) => p === branch[0]);
      const w = index < 0 ? 0 : index / last;
      return branch.map((p) => shift(p, w));
    });
    return { main, branches };
  }

  /**
   * يرسم اللحظة t. view: تحويل مساحة الشكل إلى بكسلات الـ canvas. pxToUnits: كم وحدة شكل في البكسل الواحد.
   */
  render(ctx: CanvasRenderingContext2D, t: number, view: Matrix, pxToUnits: number, colors: Colors, debug = false): void {
    const config = LEVELS[this.level];
    const bolts = this.activeBolts(t);
    const pose = this.pose(t);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);

    let intensity = 0;
    for (const { bolt, local } of bolts) intensity = Math.max(intensity, boltIntensity(bolt, local));

    // الوميض حول الهدهد فقط (يتلاشى قبل حافة الـ canvas).
    if (intensity > 0.01) {
      const ambient = ctx.createRadialGradient(...AMBIENT_CENTER, 0, ...AMBIENT_CENTER, AMBIENT_RADIUS);
      ambient.addColorStop(0, `rgba(200, 225, 255, ${config.ambient * intensity})`);
      ambient.addColorStop(1, 'rgba(200, 225, 255, 0)');
      ctx.fillStyle = ambient;
      ctx.fillRect(AMBIENT_CENTER[0] - AMBIENT_RADIUS, AMBIENT_CENTER[1] - AMBIENT_RADIUS, AMBIENT_RADIUS * 2, AMBIENT_RADIUS * 2);
    }

    // توهج عند نقطة كل ضربة.
    for (const { bolt, local, origin } of bolts) {
      const level = boltIntensity(bolt, local);
      if (level < 0.01) continue;
      const target = this.boltShape(bolt, origin, pose).main.at(-1) as Point;
      const radius = 190;
      const glow = ctx.createRadialGradient(...target, 0, ...target, radius);
      glow.addColorStop(0, `rgba(255, 255, 255, ${config.glow * level})`);
      glow.addColorStop(0.35, `rgba(170, 210, 255, ${config.glow * 0.45 * level})`);
      glow.addColorStop(1, 'rgba(170, 210, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(target[0] - radius, target[1] - radius, radius * 2, radius * 2);
    }

    drawRig(ctx, view, pose, tint(colors.bird, intensity * 0.3), debug);
    ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);

    for (const { bolt, local, origin } of bolts) {
      const level = boltIntensity(bolt, local);
      if (level > 0.01) this.drawBolt(ctx, this.boltShape(bolt, origin, pose), level, config.width * pxToUnits, colors);
    }
    for (const { bolt, local, origin } of bolts) {
      this.drawSparks(ctx, bolt, local, origin, pxToUnits, colors);
    }
  }

  private drawBolt(ctx: CanvasRenderingContext2D, shape: BoltShape, level: number, width: number, colors: Colors): void {
    const strokePath = (points: readonly Point[]) => {
      ctx.beginPath();
      ctx.moveTo(...(points[0] as Point));
      for (let i = 1; i < points.length; i++) ctx.lineTo(...(points[i] as Point));
      ctx.stroke();
    };
    const from = shape.main[0] as Point;
    const to = shape.main.at(-1) as Point;
    // تظهر الصاعقة من الظلام تدريجياً عند بدايتها، فلا يظهر لها طرف مقطوع.
    const fade = (alpha: number, color: string) => {
      const g = ctx.createLinearGradient(...from, from[0] + (to[0] - from[0]) * 0.4, from[1] + (to[1] - from[1]) * 0.4);
      g.addColorStop(0, color.replace('ALPHA', '0'));
      g.addColorStop(1, color.replace('ALPHA', String(alpha)));
      return g;
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const layers: [number, string, number][] = [
      [7, 'rgba(255, 255, 255, ALPHA)', 0.1],
      [3.2, 'rgba(160, 205, 255, ALPHA)', 0.35],
    ];
    const rgb = hexToRgb(colors.bolt) ?? [77, 157, 255];
    layers.push([1, `rgba(${rgb.join(', ')}, ALPHA)`, 1]);
    layers.push([0.42, 'rgba(255, 255, 255, ALPHA)', 0.95]);
    for (const [factor, color, alpha] of layers) {
      ctx.strokeStyle = fade(alpha * level, color);
      ctx.lineWidth = width * factor;
      strokePath(shape.main);
      ctx.lineWidth = width * factor * 0.55;
      ctx.globalAlpha = 0.75;
      for (const branch of shape.branches) strokePath(branch);
      ctx.globalAlpha = 1;
    }
  }

  private drawSparks(
    ctx: CanvasRenderingContext2D,
    bolt: BoltEvent,
    local: number,
    origin: number,
    pxToUnits: number,
    colors: Colors,
  ): void {
    const dt = local - bolt.start - PULSE_ON * 0.3;
    if (dt <= 0 || dt > SPARK_LIFE[1]) return;
    const rng = createRandom(bolt.seed ^ 0x5bd1e995);
    // الشرارات تنطلق من نقطة الضربة لحظة الضربة، ثم تطير مستقلة عن الهدهد.
    const target = this.aimedBolt(bolt, origin).shape.main.at(-1) as Point;
    ctx.lineCap = 'round';
    const rgb = hexToRgb(colors.bolt) ?? [77, 157, 255];
    const position = (vx: number, vy: number, s: number): Point => {
      const k = (1 - Math.exp(-DRAG * s)) / DRAG;
      return [target[0] + vx * k, target[1] + vy * k + GRAVITY * (s / DRAG - k / DRAG)];
    };
    for (let i = 0; i < bolt.sparks; i++) {
      // اتجاهات للأعلى والجانبين غالباً، بسرعات مختلفة.
      const angle = -Math.PI / 2 + rng.range(-1.6, 1.6);
      const speed = rng.range(380, 1100);
      const life = rng.range(SPARK_LIFE[0], SPARK_LIFE[1]);
      const white = rng.chance(0.6);
      if (dt > life) continue;
      const s = dt / 1000;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const head = position(vx, vy, s);
      const tail = position(vx, vy, Math.max(0, s - 0.028));
      const alpha = (1 - dt / life) ** 1.4;
      ctx.strokeStyle = white ? `rgba(255, 255, 255, ${alpha})` : `rgba(${rgb.join(', ')}, ${alpha})`;
      ctx.lineWidth = 1.4 * pxToUnits;
      ctx.beginPath();
      ctx.moveTo(...tail);
      ctx.lineTo(...head);
      ctx.stroke();
    }
  }
}
