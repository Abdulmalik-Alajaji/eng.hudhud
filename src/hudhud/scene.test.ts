import { describe, expect, it } from 'vitest';
import { REST_POSE } from './rig';
import { HudhudScene } from './scene';

describe('HudhudScene', () => {
  it('يبدأ في الوضع الطبيعي', () => {
    const pose = new HudhudScene('medium', 1).pose(0);
    expect(pose.head).toBe(REST_POSE.head);
    expect(pose.body).toBe(REST_POSE.body);
    expect(pose.flip).toBe(1);
  });

  it('التنفّس مستمر', () => {
    const scene = new HudhudScene('calm', 1);
    expect(scene.pose(1800).breath).toBeGreaterThan(0.9);
    expect(scene.pose(3600).breath).toBeLessThan(0.1);
  });

  it('نفس البذرة = نفس الحركة، حتى بعد الرجوع في الزمن', () => {
    const a = new HudhudScene('strong', 42);
    const b = new HudhudScene('strong', 42);
    const later = a.pose(30000);
    expect(b.pose(30000)).toEqual(later);
    a.pose(1000);
    expect(a.pose(30000)).toEqual(later);
  });
});
