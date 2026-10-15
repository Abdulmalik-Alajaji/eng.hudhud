import { describe, expect, it } from 'vitest';
import { generateBolt } from './lightning';
import { createRandom } from './random';

describe('generateBolt', () => {
  const from = [0, -300] as const;
  const to = [300, 40] as const;

  it('الخط الرئيسي من نقطة البداية إلى الهدف، متعرج', () => {
    const bolt = generateBolt(createRandom(1), from, to, 3);
    expect(bolt.main[0]).toEqual(from);
    expect(bolt.main.at(-1)).toEqual(to);
    expect(bolt.main.length).toBe(65);
    const straight = Math.hypot(to[0] - from[0], to[1] - from[1]);
    let length = 0;
    for (let i = 1; i < bolt.main.length; i++) {
      const a = bolt.main[i - 1]!;
      const b = bolt.main[i]!;
      length += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    expect(length).toBeGreaterThan(straight * 1.05);
  });

  it('الفروع تخرج من الخط الرئيسي وعددها كما طُلب', () => {
    const bolt = generateBolt(createRandom(2), from, to, 4);
    expect(bolt.branches).toHaveLength(4);
    for (const branch of bolt.branches) {
      expect(bolt.main).toContainEqual(branch[0]);
    }
  });

  it('نفس البذرة = نفس الشكل، وبذرة أخرى = شكل جديد', () => {
    const a = generateBolt(createRandom(5), from, to, 2);
    expect(generateBolt(createRandom(5), from, to, 2)).toEqual(a);
    expect(generateBolt(createRandom(6), from, to, 2)).not.toEqual(a);
  });
});
