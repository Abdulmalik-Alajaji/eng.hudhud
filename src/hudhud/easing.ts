/**
 * منحنيات التسارع. القاعدة في المشروع: لا حركة بسرعة ثابتة.
 * كل منحنى يبدأ من 0 وينتهي عند 1. «Back» يتجاوز الهدف قليلاً ثم يستقر (out)، أو يرجع للخلف قبل الانطلاق (in).
 */
export type Ease = (t: number) => number;

/** للثبات فقط (إبقاء القيمة دون تغيير)، لا للحركة. */
export const hold: Ease = () => 0;

export const easeInOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutSine: Ease = (t) => Math.sin((t * Math.PI) / 2);
export const easeInCubic: Ease = (t) => t * t * t;
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** تجاوز بسيط ثم استقرار. overshoot أكبر = تجاوز أكبر. */
export function easeOutBack(overshoot = 1.70158): Ease {
  const c3 = overshoot + 1;
  return (t) => 1 + c3 * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/** تحضير: يرجع قليلاً للخلف ثم ينطلق. */
export function easeInBack(overshoot = 1.70158): Ease {
  const c3 = overshoot + 1;
  return (t) => c3 * t * t * t - overshoot * t * t;
}
