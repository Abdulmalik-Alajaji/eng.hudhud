import { describe, expect, it } from 'vitest';
import { PART_ORDER, REST_POSE, partMatrices, worldPoint } from './rig';
import { RIG_JOINTS, RIG_PARTS } from './rig-data';

describe('أجزاء الهدهد', () => {
  it('خمسة أجزاء: الساقان، الذيل، الجسم، الرأس، التاج', () => {
    expect(Object.keys(RIG_PARTS).sort()).toEqual([...PART_ORDER].sort());
    for (const path of Object.values(RIG_PARTS)) expect(path.startsWith('M')).toBe(true);
  });

  it('في الوضع الطبيعي تبقى الساقان والجسم والذيل والرأس في مكانها', () => {
    const pose = REST_POSE;
    for (const part of ['legs', 'body', 'tail', 'head', 'crest'] as const) {
      const [x, y] = worldPoint(pose, part, [300, 300]);
      expect(x).toBeCloseTo(300, 6);
      expect(y).toBeCloseTo(300, 6);
    }
  });

  it('المفاصل لا تنفصل: الرأس يدور حول الرقبة، والذيل حول قاعدته، والجسم حول الورك', () => {
    const pose = { ...REST_POSE, body: -12, head: -60, flip: -1, tail: -12 };
    const neckOnBody = worldPoint(pose, 'body', RIG_JOINTS.neck);
    const neckOnHead = worldPoint(pose, 'head', RIG_JOINTS.neck);
    expect(neckOnHead[0]).toBeCloseTo(neckOnBody[0], 6);
    expect(neckOnHead[1]).toBeCloseTo(neckOnBody[1], 6);
    const tailOnBody = worldPoint(pose, 'body', RIG_JOINTS.tail);
    const tailOnTail = worldPoint(pose, 'tail', RIG_JOINTS.tail);
    expect(tailOnTail[0]).toBeCloseTo(tailOnBody[0], 6);
    const hip = worldPoint(pose, 'body', RIG_JOINTS.hip);
    expect(hip[0]).toBeCloseTo(RIG_JOINTS.hip[0], 6);
    expect(hip[1]).toBeCloseTo(RIG_JOINTS.hip[1], 6);
  });

  it('قاعدة التاج تبقى على الرأس: المقدّم ثابت حين ينضغط، والمؤخر ثابت حين يرتفع', () => {
    for (const crest of [-7, -0.5, 0, 6, 10]) {
      const [x, y] = RIG_JOINTS.crestBase[crest >= 0 ? 0 : 1];
      const m = partMatrices({ ...REST_POSE, crest }).crest;
      expect(m[0] * x + m[2] * y + m[4]).toBeCloseTo(x, 6);
      expect(m[1] * x + m[3] * y + m[5]).toBeCloseTo(y, 6);
    }
  });

  it('التاج قطعة صلبة لا تنثني ولا تنضغط: دوران فقط بلا تمدد ولا ميل', () => {
    for (const crest of [-7, 6, 10]) {
      const pose = { ...REST_POSE, crest };
      // التاج بالنسبة للرأس: نلغي حركة الرأس لنرى حركة التاج وحده.
      const [a, b, c, d] = partMatrices({ ...pose, head: 0 }).crest;
      expect(a).toBeCloseTo(d, 9);
      expect(b).toBeCloseTo(-c, 9);
      expect(a * d - b * c).toBeCloseTo(1, 9);
    }
  });

  it('النقر ينزل المنقار نحو الأرض', () => {
    const beak = [12, 160] as const;
    const rest = worldPoint(REST_POSE, 'head', beak);
    const peck = worldPoint({ ...REST_POSE, head: -60, body: -12 }, 'head', beak);
    expect(peck[1] - rest[1]).toBeGreaterThan(150);
  });
});
