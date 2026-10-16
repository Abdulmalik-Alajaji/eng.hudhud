import { describe, expect, it } from 'vitest';
import { CREST_RAISED, type Cycle, type Level, LEVELS, MAX_FLASHES_PER_SECOND, boltIntensity, buildCycle } from './cycle';
import { hold } from './easing';
import { createRandom } from './random';

const LEVEL_NAMES = Object.keys(LEVELS) as Level[];

/** دورات متتالية كما يبنيها المشهد، مع نقل ومضات الدورة السابقة. */
function cycles(level: Level, seed: number, count: number): { start: number; cycle: Cycle }[] {
  const rng = createRandom(seed);
  const list: { start: number; cycle: Cycle }[] = [];
  let start = 0;
  let carry: number[] = [];
  for (let i = 0; i < count; i++) {
    const cycle = buildCycle(rng, level, carry);
    list.push({ start, cycle });
    carry = cycle.bolts.flatMap((b) => b.pulses).map((p) => p - cycle.duration).filter((p) => p > -1000);
    start += cycle.duration;
  }
  return list;
}

describe.each(LEVEL_NAMES)('الدرجة %s', (level) => {
  const config = LEVELS[level];

  it('عدد الصواعق في كل دورة ضمن مدى الدرجة (3 إلى 6 عموماً)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const { cycle } of cycles(level, seed, 5)) {
        expect(cycle.bolts.length).toBeGreaterThanOrEqual(config.bolts[0]);
        expect(cycle.bolts.length).toBeLessThanOrEqual(config.bolts[1]);
        expect(cycle.bolts.length).toBeGreaterThanOrEqual(3);
        expect(cycle.bolts.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('حد السلامة: لا أكثر من 3 ومضات في أي ثانية، حتى عبر الدورات', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const flashes = cycles(level, seed, 8)
        .flatMap(({ start, cycle }) => cycle.bolts.flatMap((b) => b.pulses.map((p) => p + start)))
        .sort((a, b) => a - b);
      for (let i = MAX_FLASHES_PER_SECOND; i < flashes.length; i++) {
        expect(flashes[i]! - flashes[i - MAX_FLASHES_PER_SECOND]!).toBeGreaterThanOrEqual(1000);
      }
    }
  });

  it('كل صاعقة تومض مرة إلى ثلاث، وفيها ما يأتي متتالياً بسرعة', () => {
    let quick = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const { cycle } of cycles(level, seed, 3)) {
        for (const bolt of cycle.bolts) {
          expect(bolt.pulses.length).toBeGreaterThanOrEqual(1);
          expect(bolt.pulses.length).toBeLessThanOrEqual(3);
        }
        for (let i = 1; i < cycle.bolts.length; i++) {
          if (cycle.bolts[i]!.start - cycle.bolts[i - 1]!.pulses.at(-1)! < 400) quick++;
        }
      }
    }
    expect(quick).toBeGreaterThan(0);
  });
});

describe('الحركة', () => {
  it('التوقيت يختلف بين دورة وأخرى', () => {
    const durations = cycles('medium', 3, 6).map(({ cycle }) => Math.round(cycle.duration));
    expect(new Set(durations).size).toBeGreaterThan(3);
  });

  it('لا حركة بسرعة ثابتة: كل انتقال بين قيمتين يستخدم منحنى تسارع', () => {
    for (const { cycle } of cycles('strong', 9, 4)) {
      for (const track of Object.values(cycle.tracks)) {
        for (let i = 1; i < track.keys.length; i++) {
          const key = track.keys[i]!;
          if (key.v === track.keys[i - 1]!.v) continue;
          expect(key.ease).not.toBe(hold);
          const deviation = [0.25, 0.5, 0.75].map((u) => Math.abs(key.ease(u) - u));
          expect(Math.max(...deviation)).toBeGreaterThan(0.02);
        }
      }
    }
  });

  it('النقرة: تحضير للأعلى قبل النزول، ثم ارتداد يتجاوز الوضع الطبيعي', () => {
    const { cycle } = cycles('calm', 4, 1)[0]!;
    const head = cycle.tracks.head;
    const samples = Array.from({ length: 400 }, (_, i) => head.sample(i * 10));
    const lowest = samples.indexOf(Math.min(...samples));
    expect(Math.max(...samples.slice(0, lowest))).toBeGreaterThan(4);
    expect(Math.max(...samples.slice(lowest, lowest + 60))).toBeGreaterThan(1);
  });

  it('التاج يرتفع قليلاً عند الالتفات ثم يعود كما في الصورة', () => {
    const { cycle } = cycles('calm', 4, 1)[0]!;
    const flip = cycle.tracks.flip;
    const crest = cycle.tracks.crest;
    const times = Array.from({ length: 1500 }, (_, i) => i * 10);
    const turned = times.find((t) => flip.sample(t) < 0)!;
    expect(crest.sample(turned)).toBeLessThan(CREST_RAISED / 2);
    expect(crest.sample(cycle.duration)).toBeCloseTo(0, 6);
  });

  it('حركة التاج خفيفة: بضع درجات فقط في كل الدورات', () => {
    for (const { cycle } of cycles('strong', 11, 4)) {
      for (let t = 0; t <= cycle.duration; t += 5) {
        expect(Math.abs(cycle.tracks.crest.sample(t))).toBeLessThanOrEqual(10);
      }
    }
  });

  it('شدة الصاعقة تظهر وتختفي ثم تتلاشى', () => {
    const { cycle } = cycles('strong', 2, 1)[0]!;
    const bolt = cycle.bolts.find((b) => b.pulses.length >= 2)!;
    const [p0, p1] = bolt.pulses as [number, number];
    expect(boltIntensity(bolt, p0 + 40)).toBeGreaterThan(0.9);
    expect(boltIntensity(bolt, (p0 + 65 + p1) / 2)).toBeLessThan(0.1);
    expect(boltIntensity(bolt, p1 + 40)).toBeGreaterThan(0.9);
    expect(boltIntensity(bolt, bolt.end + 1)).toBe(0);
  });
});
