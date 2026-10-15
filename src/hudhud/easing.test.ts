import { describe, expect, it } from 'vitest';
import { easeInBack, easeInCubic, easeInOutCubic, easeInOutSine, easeOutBack, easeOutCubic, easeOutSine } from './easing';

const curves = { easeInOutSine, easeOutSine, easeInCubic, easeOutCubic, easeInOutCubic, outBack: easeOutBack(), inBack: easeInBack() };

describe('منحنيات التسارع', () => {
  it.each(Object.entries(curves))('%s يبدأ من 0 وينتهي عند 1', (_, ease) => {
    expect(ease(0)).toBeCloseTo(0, 6);
    expect(ease(1)).toBeCloseTo(1, 6);
  });

  it.each(Object.entries(curves))('%s ليس بسرعة ثابتة', (_, ease) => {
    const samples = [0.25, 0.5, 0.75].map((t) => ease(t) - t);
    expect(samples.some((d) => Math.abs(d) > 0.02)).toBe(true);
  });

  it('easeOutBack يتجاوز الهدف ثم يستقر', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(1.7)(i / 100)));
    expect(peak).toBeGreaterThan(1.05);
  });

  it('easeInBack يتحضّر للخلف قبل الانطلاق', () => {
    const dip = Math.min(...Array.from({ length: 101 }, (_, i) => easeInBack(1.7)(i / 100)));
    expect(dip).toBeLessThan(-0.05);
  });
});
