import { describe, expect, it } from 'vitest';
import { easeInOutSine } from './easing';
import { Track } from './timeline';

describe('Track', () => {
  it('يثبت القيمة ثم يتحرك بالمنحنى', () => {
    const track = new Track(0).wait(100).to(300, 10, easeInOutSine);
    expect(track.sample(50)).toBe(0);
    expect(track.sample(100)).toBe(0);
    expect(track.sample(200)).toBeCloseTo(5, 6);
    expect(track.sample(250)).toBeCloseTo(10 * easeInOutSine(0.75), 6);
    expect(track.sample(999)).toBe(10);
  });

  it('يرفض مفتاحاً قبل المفتاح السابق', () => {
    const track = new Track(0).to(100, 1, easeInOutSine);
    expect(() => track.to(50, 2, easeInOutSine)).toThrow();
  });
});
