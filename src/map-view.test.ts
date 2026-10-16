import { describe, expect, it } from 'vitest';
import type { Floor } from './data/types';
import type { GraphNode } from './route/graph';
import { createMap, drawLeg, routeView, tapPosition } from './map-view';

const floor = { id: 'B1-G', map: 'maps/demo-campus.svg', width: 1000, height: 800 } as Floor;
const node = (x: number, y: number): GraphNode => ({ id: `${x},${y}`, floor, x, y });

describe('routeView', () => {
  it('يحتوي الطريق كاملاً ومكان الهدهد فوق الوجهة، ولا يخرج عن الصورة', () => {
    const path = [node(300, 500), node(500, 500), node(500, 300)];
    const view = routeView({ path, width: 1000, height: 800 }, true);
    for (const n of path) {
      expect(n.x).toBeGreaterThan(view.x);
      expect(n.x).toBeLessThan(view.x + view.w);
      expect(n.y).toBeGreaterThan(view.y);
      expect(n.y).toBeLessThan(view.y + view.h);
    }
    // الهدهد نحو 40 بكسل فوق الوجهة.
    expect(view.y).toBeLessThan(300 - 40 * (view.w / 340));
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.y).toBeGreaterThanOrEqual(0);
    expect(view.x + view.w).toBeLessThanOrEqual(1000);
    expect(view.y + view.h).toBeLessThanOrEqual(800);
  });

  it('مقطع قصير لا يُكبَّر أكثر من اللازم، والنسبة مناسبة للجوال', () => {
    const view = routeView({ path: [node(10, 10), node(20, 10)], width: 1000, height: 800 }, false);
    expect(view.w).toBeGreaterThanOrEqual(360);
    expect(view.w / view.h).toBeLessThanOrEqual(16 / 9 + 1e-9);
    expect(view.w / view.h).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(view.x).toBe(0);
    expect(view.y).toBe(0);
  });

  it('طريق يملأ الخريطة يعرضها كاملة', () => {
    const view = routeView({ path: [node(0, 0), node(1000, 0), node(1000, 800)], width: 1000, height: 800 }, true);
    expect(view).toEqual({ x: 0, y: 0, w: 1000, h: 800 });
  });
});

describe('createMap وdrawLeg', () => {
  it('الخريطة صورة داخل SVG بإحداثياتها، والطريق والبداية والهدهد عند الوجهة', () => {
    const map = createMap(floor, 'خريطة', { x: 100, y: 50, w: 500, h: 400 });
    drawLeg(map, { path: [node(200, 200), node(400, 200)] }, true);
    expect(map.layer.getAttribute('viewBox')).toBe('100 50 500 400');
    expect(map.layer.querySelector('image')?.getAttribute('href')).toBe('/maps/demo-campus.svg');
    expect(map.layer.querySelectorAll('polyline')).toHaveLength(2);
    expect(map.layer.querySelector('.map-start')).not.toBeNull();
    expect(map.layer.querySelector('.map-destination path')).not.toBeNull();
    expect(map.layer.querySelector('.map-exit')).toBeNull();
  });

  it('نهاية مقطع ليس الأخير مربع (الدرج أو المصعد) لا الهدهد', () => {
    const map = createMap(floor, 'خريطة');
    drawLeg(map, { path: [node(200, 200), node(400, 200)] }, false);
    expect(map.layer.querySelector('.map-exit')).not.toBeNull();
    expect(map.layer.querySelector('.map-destination')).toBeNull();
  });
});

describe('tapPosition', () => {
  it('يحوّل موضع النقر على الشاشة إلى إحداثيات الصورة', () => {
    const map = createMap(floor, 'خريطة', { x: 100, y: 0, w: 500, h: 400 });
    map.layer.getBoundingClientRect = () => ({ left: 10, top: 20, width: 250, height: 200 }) as DOMRect;
    expect(tapPosition(map, { clientX: 10, clientY: 20 })).toEqual({ x: 100, y: 0 });
    expect(tapPosition(map, { clientX: 135, clientY: 120 })).toEqual({ x: 350, y: 200 });
  });
});
