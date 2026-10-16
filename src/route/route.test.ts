import { describe, expect, it } from 'vitest';
import { loadDataset } from '../data/dataset';
import type { Dataset } from '../data/types';
import { distance, stepCount, stepsText, turnBetween } from './directions';
import { buildGraph } from './graph';
import { findRoute, type Route } from './route';

/**
 * شبكة صغيرة معروفة الأطوال:
 *   B2-G:  h(-100,0) ─ممر بين المبنيين─ a(0,0) ── b(100,0) ── d(200,0)=درج
 *          │                                      │
 *          i(-100,100)=B2-G101                    c(100,100)=مصعد، B1-G102
 *   B1-F:  f(100,0)=B1-F201 ── e(200,0)=درج، و f ── g(100,100)=مصعد
 */
function fixture(): Dataset {
  const demo = true;
  return {
    buildings: [
      { id: 'B1', name: 'المبنى 1', demo },
      { id: 'B2', name: 'المبنى 2', demo },
    ],
    floors: [
      {
        id: 'B1-G', building: 'B1', level: 'G', map: 'maps/x.svg', width: 400, height: 200, demo,
        points: [
          { id: 'B1-G:a', x: 0, y: 0 }, { id: 'B1-G:b', x: 100, y: 0 },
          { id: 'B1-G:c', x: 100, y: 100 }, { id: 'B1-G:d', x: 200, y: 0 },
        ],
        corridors: [
          { from: 'B1-G:a', to: 'B1-G:b', length_m: 10 },
          { from: 'B1-G:b', to: 'B1-G:c', length_m: 10 },
          { from: 'B1-G:b', to: 'B1-G:d', length_m: 10 },
        ],
        places: [
          { id: 'B1-G101', kind: 'room', point: 'B1-G:a', demo },
          { id: 'B1-G102', kind: 'room', point: 'B1-G:c', demo },
          { id: 'B1-G-ST1', kind: 'stairs', name: 'الدرج', point: 'B1-G:d', demo },
          { id: 'B1-G-EL1', kind: 'elevator', name: 'المصعد', point: 'B1-G:c', demo },
        ],
      },
      {
        id: 'B1-F', building: 'B1', level: 'F', map: 'maps/x.svg', width: 400, height: 200, demo,
        points: [{ id: 'B1-F:e', x: 200, y: 0 }, { id: 'B1-F:f', x: 100, y: 0 }, { id: 'B1-F:g', x: 100, y: 100 }],
        corridors: [
          { from: 'B1-F:e', to: 'B1-F:f', length_m: 10 },
          { from: 'B1-F:f', to: 'B1-F:g', length_m: 15 },
        ],
        places: [
          { id: 'B1-F201', kind: 'office', point: 'B1-F:f', demo },
          { id: 'B1-F-ST1', kind: 'stairs', name: 'الدرج', point: 'B1-F:e', demo },
          { id: 'B1-F-EL1', kind: 'elevator', name: 'المصعد', point: 'B1-F:g', demo },
        ],
      },
      {
        id: 'B2-G', building: 'B2', level: 'G', map: 'maps/x.svg', width: 400, height: 200, demo,
        points: [{ id: 'B2-G:h', x: -100, y: 0 }, { id: 'B2-G:i', x: -100, y: 100 }],
        corridors: [{ from: 'B2-G:h', to: 'B2-G:i', length_m: 10 }],
        places: [{ id: 'B2-G101', kind: 'room', point: 'B2-G:i', demo }],
      },
    ],
    vertical: [
      { id: 'B1-ST1', kind: 'stairs', stops: ['B1-G-ST1', 'B1-F-ST1'], demo },
      { id: 'B1-EL1', kind: 'elevator', stops: ['B1-F-EL1', 'B1-G-EL1'], demo },
    ],
    passages: [{ id: 'P', name: 'الممر بين المبنيين', from: 'B2-G:h', to: 'B1-G:a', length_m: 10, demo }],
    doctors: [{ id: 'd1', name: 'د. تجربة', office: 'B1-F201', demo }],
  };
}

function route(dataset: Dataset, ...args: Parameters<typeof findRoute> extends [unknown, ...infer R] ? R : never): Route {
  const result = findRoute(buildGraph(dataset), ...args);
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}

describe('الانعطاف', () => {
  it('يمين ويسار حسب اتجاه الماشي على الخريطة (y للأسفل)', () => {
    expect(turnBetween('E', 'S')).toBe('right');
    expect(turnBetween('E', 'N')).toBe('left');
    expect(turnBetween('N', 'E')).toBe('right');
    expect(turnBetween('N', 'W')).toBe('left');
    expect(turnBetween('S', 'W')).toBe('right');
    expect(turnBetween('W', 'N')).toBe('right');
    expect(turnBetween('E', 'E')).toBe('straight');
    expect(turnBetween('E', 'W')).toBe('back');
  });
});

describe('عدد الخطوات التقريبي', () => {
  it('خطوة متوسطة 0.75 م: بالضبط حتى 20، ثم لأقرب 5', () => {
    expect(stepCount(0.2)).toBe(1);
    expect(stepCount(10)).toBe(13);
    expect(stepCount(15)).toBe(20);
    expect(stepCount(36)).toBe(50);
    expect(stepCount(104)).toBe(140);
  });

  it('قواعد العدد في العربية', () => {
    expect(stepsText(1)).toBe('خطوة واحدة');
    expect(stepsText(2)).toBe('خطوتان');
    expect(stepsText(5)).toBe('5 خطوات');
    expect(stepsText(10)).toBe('10 خطوات');
    expect(stepsText(13)).toBe('13 خطوة');
    expect(stepsText(105)).toBe('105 خطوات');
    expect(stepsText(140)).toBe('140 خطوة');
  });

  it('المسافة بالأمتار ثم الخطوات بين قوسين', () => {
    expect(distance(36)).toBe('36 م (نحو 50 خطوة)');
    expect(distance(3)).toBe('3 م (نحو 4 خطوات)');
  });
});

describe('findRoute: الطابق نفسه', () => {
  it('أقصر طريق بالأمتار والشرح يمين', () => {
    const r = route(fixture(), { place: 'B1-G101' }, { place: 'B1-G102' });
    expect(r.meters).toBe(20);
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]!.steps).toEqual([
      'ابدأ من القاعة B1-G101، امشِ 10 م (نحو 13 خطوة)',
      'انعطف يميناً وامشِ 10 م (نحو 13 خطوة)',
      'وصلت إلى القاعة B1-G102',
    ]);
  });

  it('العكس: يسار', () => {
    const r = route(fixture(), { place: 'B1-G102' }, { place: 'B1-G101' });
    expect(r.legs[0]!.steps).toEqual([
      'ابدأ من القاعة B1-G102، امشِ 10 م (نحو 13 خطوة)',
      'انعطف يساراً وامشِ 10 م (نحو 13 خطوة)',
      'وصلت إلى القاعة B1-G101',
    ]);
  });

  it('الممر بين المبنيين في الطابق نفسه يبقى في مقطع واحد (الخريطة واحدة)', () => {
    const r = route(fixture(), { place: 'B2-G101' }, { place: 'B1-G102' });
    expect(r.meters).toBe(40);
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]!.steps).toContain('انعطف يميناً واعبر الممر بين المبنيين: 10 م (نحو 13 خطوة)');
  });

  it('البداية هي الوجهة', () => {
    const r = route(fixture(), { place: 'B1-G101' }, { place: 'B1-G101' });
    expect(r.meters).toBe(0);
    expect(r.legs[0]!.steps).toEqual(['أنت عند وجهتك']);
  });
});

describe('findRoute: تغيير الطابق', () => {
  it('إلى مكتب دكتور بالدرج الأقرب، والدرج لا يُحسب في الأمتار', () => {
    const r = route(fixture(), { place: 'B1-G101' }, { doctor: 'd1' });
    expect(r.destination.id).toBe('B1-F201');
    expect(r.meters).toBe(30);
    expect(r.legs.map((l) => l.level)).toEqual(['G', 'F']);
    expect(r.legs[0]!.exit?.kind).toBe('stairs');
    expect(r.legs[0]!.steps.at(-1)).toBe('اصعد بالدرج إلى الطابق الأول');
    expect(r.legs[1]!.steps[0]).toBe('من الدرج، امشِ 10 م (نحو 13 خطوة)');
  });

  it('بدون درج: بالمصعد ولو كان أطول', () => {
    const r = route(fixture(), { place: 'B1-G101' }, { doctor: 'd1' }, { avoidStairs: true });
    expect(r.meters).toBe(35);
    expect(r.legs[0]!.exit?.kind).toBe('elevator');
    expect(r.legs[0]!.steps.at(-1)).toBe('اصعد بالمصعد إلى الطابق الأول');
  });

  it('النزول', () => {
    const r = route(fixture(), { place: 'B1-F201' }, { place: 'B1-G101' });
    expect(r.legs[0]!.steps.at(-1)).toBe('انزل بالدرج إلى الطابق الأرضي');
  });

  it('لا طريق بالمصعد فقط إذا لم يوجد مصعد', () => {
    const data = fixture();
    data.vertical = data.vertical.filter((v) => v.kind === 'stairs');
    const result = findRoute(buildGraph(data), { place: 'B1-G101' }, { doctor: 'd1' }, { avoidStairs: true });
    expect(result).toEqual({ ok: false, reason: 'لا يوجد طريق بالمصعد فقط إلى هذه الوجهة' });
  });

  it('ممر إلى طابق على صورة أخرى يفصل المقطع', () => {
    const data = fixture();
    data.floors[2]!.map = 'maps/y.svg';
    const r = route(data, { place: 'B2-G101' }, { place: 'B1-G102' });
    expect(r.meters).toBe(40);
    expect(r.legs).toHaveLength(2);
    expect(r.legs[0]!.steps.at(-1)).toBe('اعبر الممر بين المبنيين إلى الطابق الأرضي');
  });
});

describe('findRoute: البداية بالنقر على الخريطة', () => {
  it('تُسقط على أقرب ممر، والأمتار بنسبة الموضع على الممر', () => {
    const r = route(fixture(), { floor: 'B1-G', x: 50, y: 4 }, { place: 'B1-G102' });
    expect(r.meters).toBeCloseTo(15, 9);
    expect(r.start.node).toMatchObject({ x: 50, y: 0 });
  });

  it('على الخريطة المشتركة قد تقع النقطة في المبنى الآخر', () => {
    const r = route(fixture(), { floor: 'B1-G', x: -96, y: 50 }, { place: 'B2-G101' });
    expect(r.start.node.floor.id).toBe('B2-G');
    expect(r.meters).toBeCloseTo(5, 9);
  });
});

describe('findRoute: أخطاء', () => {
  it('وجهة أو بداية أو دكتور غير موجود', () => {
    const graph = buildGraph(fixture());
    expect(findRoute(graph, { place: 'B1-G101' }, { place: 'B9-G1' }).ok).toBe(false);
    expect(findRoute(graph, { place: 'X' }, { place: 'B1-G101' }).ok).toBe(false);
    expect(findRoute(graph, { place: 'B1-G101' }, { doctor: 'd9' }).ok).toBe(false);
  });
});

describe('البيانات التجريبية', () => {
  const dataset = loadDataset().dataset!;
  const graph = buildGraph(dataset);
  const places = [...graph.places.keys()];
  const landmarks = dataset.floors.flatMap((f) => f.places).filter((p) => p.landmark);
  const targets = places.filter((_, i) => i % 7 === 0);

  it('من كل معلم إلى عينة من الأماكن: طريق متصل، والأمتار مجموع أجزائه، والشرح كامل', () => {
    for (const start of landmarks) {
      for (const target of targets) {
        for (const avoidStairs of [false, true]) {
          const result = findRoute(graph, { place: start.id }, { place: target }, { avoidStairs });
          expect(result.ok, `${start.id} → ${target}`).toBe(true);
          if (!result.ok) continue;
          let sum = 0;
          for (const leg of result.route.legs) {
            leg.hops.forEach((hop, i) => {
              expect(hop.from).toBe(leg.path[i]);
              expect(hop.to).toBe(leg.path[i + 1]);
              expect(hop.from.floor.level).toBe(leg.level);
            });
            sum += leg.meters;
            expect(leg.steps.length).toBeGreaterThan(0);
            for (const step of leg.steps) expect(step).not.toMatch(/undefined|NaN/);
          }
          expect(result.route.meters).toBeCloseTo(sum, 6);
          expect(result.route.legs.at(-1)!.path.at(-1)!.id).toBe(graph.places.get(target)!.place.point);
        }
      }
    }
  });

  it('المسافة نفسها ذهاباً وإياباً', () => {
    for (const [a, b] of [['B2-G-EN1', 'B1-S-LIB'], ['B1-G-EN1', 'B1-G-CAF'], ['B1-G-SCI', 'B2-F-WC1']] as const) {
      const go = route(dataset, { place: a }, { place: b });
      const back = route(dataset, { place: b }, { place: a });
      expect(go.meters).toBeCloseTo(back.meters, 6);
    }
  });

  it('المسار بين المبنيين في الطابق نفسه لا يغيّر الطابق', () => {
    const r = route(dataset, { place: 'B2-G-EN1' }, { place: 'B1-G-CAF' });
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]!.steps.join(' ')).toContain('اعبر الممر بين المبنيين');
  });

  it('أول خطوة تذكر ما سيصل إليه الطالب، لأننا لا نعرف أين ينظر', () => {
    const r = route(dataset, { place: 'B1-G-EN1' }, { place: 'B1-G-CAF' });
    expect(r.legs[0]!.steps[0]).toMatch(/^ابدأ من المدخل الرئيسي، امشِ \d+ م \(نحو \d+ خطو(ة|ات)\) باتجاه /);
  });

  it('سريع: مسار بين مبنيين وطابقين في أقل من 200 ملّي ثانية', () => {
    const t0 = performance.now();
    route(dataset, { place: 'B2-G-EN1' }, { place: 'B1-S-LIB' });
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
