import type { Random } from './random';
import type { Point } from './rig-data';

export interface BoltShape {
  main: Point[];
  branches: Point[][];
}

/** خط متعرج بين نقطتين بطريقة «إزاحة المنتصف»: كل مستوى يقسم المقاطع ويزيح منتصفها عمودياً. */
export function jagged(rng: Random, from: Point, to: Point, depth: number, roughness: number): Point[] {
  let points: Point[] = [from, to];
  let offset = Math.hypot(to[0] - from[0], to[1] - from[1]) * roughness;
  for (let level = 0; level < depth; level++) {
    const next: Point[] = [points[0] as Point];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as Point;
      const b = points[i] as Point;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const shift = (rng.next() * 2 - 1) * offset;
      next.push([(a[0] + b[0]) / 2 + (-dy / len) * shift, (a[1] + b[1]) / 2 + (dx / len) * shift], b);
    }
    points = next;
    offset *= 0.5;
  }
  return points;
}

/** صاعقة جديدة الشكل في كل مرة: خط رئيسي من from إلى to، وفروع أرفع تخرج منه وتتلاشى في الهواء. */
export function generateBolt(rng: Random, from: Point, to: Point, branchCount: number): BoltShape {
  const main = jagged(rng, from, to, 6, 0.2);
  const branches: Point[][] = [];
  const total = Math.hypot(to[0] - from[0], to[1] - from[1]);
  for (let i = 0; i < branchCount; i++) {
    const index = Math.floor(main.length * rng.range(0.12, 0.7));
    const start = main[index] as Point;
    const ahead = main[Math.min(index + 4, main.length - 1)] as Point;
    const direction = Math.atan2(ahead[1] - start[1], ahead[0] - start[0]);
    const turn = (rng.chance(0.5) ? 1 : -1) * rng.range(0.35, 0.85);
    const length = total * rng.range(0.15, 0.35);
    const end: Point = [
      start[0] + Math.cos(direction + turn) * length,
      start[1] + Math.sin(direction + turn) * length,
    ];
    branches.push(jagged(rng, start, end, 4, 0.25));
  }
  return { main, branches };
}
