import { type Ease, hold } from './easing';

interface Key {
  t: number;
  v: number;
  /** المنحنى المستخدم للوصول إلى هذا المفتاح من المفتاح السابق. */
  ease: Ease;
}

/** مسار قيمة واحدة عبر الزمن (زاوية الرأس مثلاً) بمفاتيح ومنحنيات تسارع. */
export class Track {
  readonly keys: Key[];

  constructor(initial: number) {
    this.keys = [{ t: 0, v: initial, ease: hold }];
  }

  get end(): number {
    return this.last.t;
  }

  get value(): number {
    return this.last.v;
  }

  private get last(): Key {
    return this.keys[this.keys.length - 1] as Key;
  }

  /** يبقي القيمة الحالية حتى الزمن t. */
  wait(t: number): this {
    if (t > this.last.t) this.keys.push({ t, v: this.last.v, ease: hold });
    return this;
  }

  /** يتحرك إلى القيمة v ويصل عند الزمن t بالمنحنى ease. */
  to(t: number, v: number, ease: Ease): this {
    if (t <= this.last.t) {
      throw new Error(`مفتاح خارج الترتيب: ${t} بعد ${this.last.t}`);
    }
    this.keys.push({ t, v, ease });
    return this;
  }

  sample(t: number): number {
    const keys = this.keys;
    const first = keys[0] as Key;
    if (t <= first.t) return first.v;
    let lo = 0;
    let hi = keys.length - 1;
    if (t >= (keys[hi] as Key).t) return (keys[hi] as Key).v;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((keys[mid] as Key).t <= t) lo = mid;
      else hi = mid;
    }
    const a = keys[lo] as Key;
    const b = keys[hi] as Key;
    if (b.ease === hold) return a.v;
    const u = (t - a.t) / (b.t - a.t);
    return a.v + (b.v - a.v) * b.ease(u);
  }
}
