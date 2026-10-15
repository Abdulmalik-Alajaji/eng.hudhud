/** أرقام عشوائية بذرة ثابتة (mulberry32): نفس البذرة تعطي نفس الحركة، وهذا يسهّل الاختبار. */
export interface Random {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  /** يغيّر القيمة عشوائياً بنسبة ± ratio (مثلاً 0.15 = ±15%). */
  jitter(value: number, ratio?: number): number;
  /** بذرة جديدة مشتقة، لعنصر مستقل (صاعقة أو شرارات). */
  seed(): number;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + (max - min) * next();
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    chance: (p) => next() < p,
    jitter: (value, ratio = 0.15) => value * range(1 - ratio, 1 + ratio),
    seed: () => Math.floor(next() * 4294967296),
  };
}
