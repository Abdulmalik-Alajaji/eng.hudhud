import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataset } from './dataset';
import { LEVELS } from './types';
import { ROOM_CODE, validateData } from './validate';

/** بيانات صغيرة سليمة: مبنى واحد بطابقين يربطهما درج. كل اختبار يُفسدها بطريقة واحدة. */
function fixture() {
  const floor = (level: 'G' | 'F') => ({
    id: `B1-${level}`,
    building: 'B1',
    level,
    map: null,
    width: 400,
    height: 300,
    demo: true,
    points: [
      { id: `B1-${level}:p1`, x: 100, y: 100 },
      { id: `B1-${level}:p2`, x: 200, y: 100 },
      { id: `B1-${level}:p3`, x: 300, y: 100 },
      { id: `B1-${level}:p4`, x: 300, y: 200 },
    ],
    corridors: [
      { from: `B1-${level}:p1`, to: `B1-${level}:p2`, length_m: 5 },
      { from: `B1-${level}:p2`, to: `B1-${level}:p3`, length_m: 5.1 },
      { from: `B1-${level}:p3`, to: `B1-${level}:p4`, length_m: 4.9 },
    ] as { from: string; to: string; length_m: unknown }[],
    places: [
      { id: `B1-${level}-ST1`, kind: 'stairs', name: 'الدرج', point: `B1-${level}:p1`, demo: true },
      { id: `B1-${level}101`, kind: 'room', point: `B1-${level}:p3`, demo: true },
    ] as Record<string, unknown>[],
  });
  const G = floor('G');
  G.places.push({ id: 'B1-G-EN1', kind: 'entrance', name: 'المدخل', point: 'B1-G:p2', landmark: true, demo: true });
  const F = floor('F');
  F.places.push({ id: 'B1-F210', kind: 'office', point: 'B1-F:p4', demo: true });
  return {
    '/data/buildings.json': { buildings: [{ id: 'B1', name: 'المبنى 1', demo: true }] as Record<string, unknown>[] },
    '/data/floors/B1-G.json': G,
    '/data/floors/B1-F.json': F,
    '/data/links.json': {
      vertical: [{ id: 'B1-ST1', kind: 'stairs', stops: ['B1-G-ST1', 'B1-F-ST1'], demo: true }],
      passages: [] as Record<string, unknown>[],
    },
    '/data/doctors.json': { doctors: [{ id: 'd1', name: 'د. تجربة', office: 'B1-F210', demo: true }] },
  } as Record<string, unknown> & {
    '/data/buildings.json': { buildings: Record<string, unknown>[] };
    '/data/floors/B1-G.json': typeof G;
    '/data/floors/B1-F.json': typeof F;
    '/data/links.json': { vertical: Record<string, unknown>[]; passages: Record<string, unknown>[] };
    '/data/doctors.json': { doctors: Record<string, unknown>[] };
  };
}

function errorsOf(files: Record<string, unknown>): string {
  return validateData(files).errors.join('\n');
}

describe('validateData: بيانات سليمة', () => {
  it('لا أخطاء ولا تنبيهات، وتُعاد البيانات', () => {
    const result = validateData(fixture());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.dataset?.floors.map((f) => f.id)).toEqual(['B1-F', 'B1-G']);
  });

  it('أي خطأ يمنع إعادة البيانات', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].places[1]!.id = 'A-215';
    expect(validateData(files).dataset).toBeNull();
  });
});

describe('validateData: رموز القاعات والطوابق', () => {
  it('الرمز بغير نمط الجامعة B1-F215', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].places[1]!.id = 'A-215';
    expect(errorsOf(files)).toContain('بنمط الجامعة');
  });

  it('رمز يدل على طابق آخر غير ملفه', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].places[1]!.id = 'B1-F150';
    expect(errorsOf(files)).toContain('يدل على الطابق B1-F');
  });

  it('الطابق الثالث وغيره غير مسموح', () => {
    const files = fixture();
    (files['/data/floors/B1-G.json'] as { level: string }).level = 'T';
    expect(errorsOf(files)).toContain('غير مسموح');
  });

  it('اسم الملف يطابق معرّف الطابق', () => {
    const files = fixture();
    files['/data/floors/B1-S.json'] = files['/data/floors/B1-G.json'];
    delete (files as Record<string, unknown>)['/data/floors/B1-G.json'];
    expect(errorsOf(files)).toContain('اسم الملف');
  });

  it('المرافق تحتاج اسماً ومعرّفاً مثل B1-G-WC1', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].places.push({ id: 'WC', kind: 'facility', point: 'B1-G:p2', demo: true });
    const errors = errorsOf(files);
    expect(errors).toContain('B1-G-WC1');
    expect(errors).toContain('الاسم ناقص');
  });

  it('معرّف المكان فريد في الكلية كلها', () => {
    const files = fixture();
    files['/data/floors/B1-F.json'].places.push({ id: 'B1-G101', kind: 'room', point: 'B1-F:p3', demo: true });
    expect(errorsOf(files)).toContain('«B1-G101» مكرر');
  });
});

describe('validateData: الصيغة', () => {
  it('demo يجب أن تكون true أو false لا نصاً', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].places[1]!.demo = 'true';
    expect(errorsOf(files)).toContain('true أو false');
  });

  it('حقل بخطأ إملائي يُكتشف', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].corridors[0] = { from: 'B1-G:p1', to: 'B1-G:p2', lenght_m: 5 } as never;
    const errors = errorsOf(files);
    expect(errors).toContain('حقل غير معروف «lenght_m»');
    expect(errors).toContain('«length_m» ناقص');
  });

  it('ملف غير معروف أو ناقص', () => {
    const files = fixture();
    files['/data/rooms.json'] = {};
    delete (files as Record<string, unknown>)['/data/links.json'];
    const errors = errorsOf(files);
    expect(errors).toContain('data/rooms.json: ملف غير معروف');
    expect(errors).toContain('data/links.json: الملف غير موجود');
  });
});

describe('validateData: الممرات والشبكة', () => {
  it('ممر إلى نقطة غير موجودة', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].corridors[0]!.to = 'B1-G:p9';
    expect(errorsOf(files)).toContain('نقطة غير موجودة');
  });

  it('طول الممر بالأمتار أكبر من صفر', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].corridors[0]!.length_m = 0;
    expect(errorsOf(files)).toContain('أكبر من صفر');
  });

  it('الممر المائل خطأ لأن الممرات متعامدة', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].points[3]!.x = 380;
    expect(errorsOf(files)).toContain('مائل');
  });

  it('طول لا يتسق مع الخريطة: تنبيه لا خطأ', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].corridors[1]!.length_m = 50;
    const result = validateData(files);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('المتوقع من الخريطة نحو 5 م');
  });

  it('نقطة منفصلة عن بقية الكلية', () => {
    const files = fixture();
    files['/data/floors/B1-F.json'].points.push({ id: 'B1-F:p9', x: 10, y: 10 });
    expect(errorsOf(files)).toContain('لا يمكن الوصول إليها من بقية الكلية: B1-F:p9');
  });

  it('طابق بلا درج ولا مصعد ينفصل عن الكلية', () => {
    const files = fixture();
    files['/data/links.json'].vertical = [];
    const errors = errorsOf(files);
    expect(errors).toContain('لا يربطه شيء');
    expect(errors).toContain('لا يمكن الوصول');
  });

  it('درج يشير إلى مكان من نوع آخر', () => {
    const files = fixture();
    files['/data/links.json'].vertical[0]!.stops = ['B1-G-ST1', 'B1-F101'];
    expect(errorsOf(files)).toContain('نوعه room لا stairs');
  });

  it('ممر بين طابقين يجب أن يربط طابقين مختلفين', () => {
    const files = fixture();
    files['/data/links.json'].passages.push({
      id: 'X', name: 'ممر', from: 'B1-G:p1', to: 'B1-G:p4', length_m: 10, demo: true,
    });
    expect(errorsOf(files)).toContain('في الطابق نفسه');
  });
});

describe('validateData: الدكاترة والبيانات الحقيقية', () => {
  it('مكتب الدكتور موجود ومن نوع office', () => {
    const files = fixture();
    files['/data/doctors.json'].doctors.push({ id: 'd2', name: 'د. أ', office: 'B1-F999', demo: true });
    files['/data/doctors.json'].doctors.push({ id: 'd3', name: 'د. ب', office: 'B1-F101', demo: true });
    const errors = errorsOf(files);
    expect(errors).toContain('«B1-F999» غير موجود');
    expect(errors).toContain('نوعه room لا office');
  });

  it('عنصر حقيقي لا يشير إلى عنصر تجريبي', () => {
    const files = fixture();
    files['/data/floors/B1-G.json'].places[1]!.demo = false;
    files['/data/doctors.json'].doctors[0]!.demo = false;
    const errors = errorsOf(files);
    expect(errors).toContain('مكان حقيقي في طابق تجريبي');
    expect(errors).toContain('دكتور حقيقي في مكتب تجريبي');
  });

  it('تنبيه إذا لم يوجد أي معلم', () => {
    const files = fixture();
    delete files['/data/floors/B1-G.json'].places[2]!.landmark;
    expect(validateData(files).warnings.join('\n')).toContain('لا يوجد أي معلم');
  });
});

describe('بيانات data/ الفعلية', () => {
  const result = loadDataset();
  const dataset = result.dataset!;

  it('سليمة: لا أخطاء (التنبيهات تُطبع ولا توقف النشر)', () => {
    for (const warning of result.warnings) console.warn(`تنبيه في البيانات: ${warning}`);
    expect(result.errors).toEqual([]);
    expect(dataset).not.toBeNull();
  });

  it('ما دامت البيانات كلها تجريبية فهي بلا تنبيهات', () => {
    if (dataset.floors.every((f) => f.demo)) expect(result.warnings).toEqual([]);
  });

  it('كل البيانات الحالية تجريبية', () => {
    const items = [
      ...dataset.buildings,
      ...dataset.floors,
      ...dataset.floors.flatMap((f) => f.places),
      ...dataset.vertical,
      ...dataset.passages,
      ...dataset.doctors,
    ];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.demo)).toBe(true);
  });

  it('الطوابق G وF وS فقط، والرموز بنمط الجامعة', () => {
    for (const floor of dataset.floors) {
      expect(LEVELS).toContain(floor.level);
      for (const place of floor.places) {
        if (['room', 'lab', 'office'].includes(place.kind)) expect(place.id).toMatch(ROOM_CODE);
      }
    }
  });

  it('المبنيان متصلان بممر واحد على الأقل', () => {
    const buildingOf = (point: string) => point.slice(0, point.indexOf('-'));
    expect(dataset.passages.some((p) => buildingOf(p.from) !== buildingOf(p.to))).toBe(true);
  });

  it('صورة كل خريطة موجودة في public/', () => {
    for (const floor of dataset.floors) {
      if (floor.map !== null) expect(existsSync(resolve('public', floor.map)), floor.map).toBe(true);
    }
  });
});
