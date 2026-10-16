import { describe, expect, it } from 'vitest';
import { loadDataFiles } from '../data/dataset';
import {
  Editor,
  addCorridor,
  addDoctor,
  addPassage,
  addPlace,
  addPoint,
  addVertical,
  changedFiles,
  deletePlace,
  deletePoint,
  findPlace,
  fingerprint,
  fromFiles,
  getFloor,
  movePoint,
  nextPointId,
  pointUsage,
  setCorridorLength,
  straighten,
  toFiles,
  updatePlace,
  validate,
} from './model';

const published = loadDataFiles();
const fresh = () => fromFiles(published);

describe('fromFiles وtoFiles', () => {
  it('البيانات المنشورة تعود كما هي، ولا ملف متغيّر قبل أي تعديل', () => {
    const data = fresh();
    expect(validate(data).errors).toEqual([]);
    expect(changedFiles(published, data)).toEqual([]);
  });

  it('التعديل لا يمس البيانات المنشورة الأصلية', () => {
    const data = fresh();
    getFloor(data, 'B2-G').points[0]!.x += 5;
    expect(fromFiles(published).floors.find((f) => f.id === 'B2-G')?.points[0]?.x).not.toBe(getFloor(data, 'B2-G').points[0]!.x);
  });

  it('الملف المتغيّر وحده يظهر، باسمه ومساره في المستودع', () => {
    const data = fresh();
    movePoint(data, 'B2-G:p1', 170, 233);
    const changed = changedFiles(published, data);
    expect(changed.map((c) => c.path)).toEqual(['data/floors/B2-G.json']);
    expect(changed[0]?.name).toBe('B2-G.json');
    expect(changed[0]?.text).toContain('{ "id": "B2-G:p1", "x": 170, "y": 233 }');
  });

  it('البصمة تتغير مع البيانات', () => {
    const data = fresh();
    expect(fingerprint(toFiles(data))).toBe(fingerprint(published));
    movePoint(data, 'B2-G:p1', 1, 1);
    expect(fingerprint(toFiles(data))).not.toBe(fingerprint(published));
  });
});

describe('النقاط والممرات', () => {
  it('نقطة جديدة بمعرّف تالٍ، وممر جديد بلا طول حتى يُكتب طوله المقاس', () => {
    const data = fresh();
    const floor = getFloor(data, 'B2-G');
    expect(nextPointId(floor)).toBe('B2-G:p11');
    const point = addPoint(data, 'B2-G', 165.4, 700.6);
    expect(point).toEqual({ id: 'B2-G:p11', x: 165, y: 701 });
    expect(addCorridor(data, 'B2-G:p10', point.id)).toBeNull();
    // لا طول مخترع: فحص البيانات يرفض الممر حتى يُكتب طوله.
    expect(validate(data).errors.join()).toContain('الطول بالأمتار يجب أن يكون أكبر من صفر');
    setCorridorLength(data, point.id, 'B2-G:p10', 23.5);
    expect(validate(data).errors).toEqual([]);
  });

  it('يرفض ممراً مكرراً أو بين طابقين أو من النقطة إلى نفسها', () => {
    const data = fresh();
    expect(addCorridor(data, 'B2-G:p1', 'B2-G:p2')).toContain('من قبل');
    expect(addCorridor(data, 'B2-G:p1', 'B2-F:p1')).toContain('الطابق نفسه');
    expect(addCorridor(data, 'B2-G:p1', 'B2-G:p1')).toContain('مختلفتين');
  });

  it('النقطة المتصلة بأخرى تُحاذى معها أفقياً أو رأسياً (الممرات متعامدة)', () => {
    expect(straighten({ x: 100, y: 100 }, { x: 180, y: 112 })).toEqual({ x: 180, y: 100 });
    expect(straighten({ x: 100, y: 100 }, { x: 92, y: 30 })).toEqual({ x: 100, y: 30 });
  });

  it('حذف نقطة يحذف ممراتها وأماكنها والممر بين المبنيين عندها، ويزيل الأماكن من وقفات الدرج', () => {
    const data = fresh();
    const usage = pointUsage(data, 'B2-G:p8');
    expect(usage.passages.map((p) => p.id)).toEqual(['B2-B1-G']);
    deletePoint(data, 'B2-G:p8');
    expect(getFloor(data, 'B2-G').points.some((p) => p.id === 'B2-G:p8')).toBe(false);
    expect(getFloor(data, 'B2-G').corridors.some((c) => c.from === 'B2-G:p8' || c.to === 'B2-G:p8')).toBe(false);
    expect(data.passages.some((p) => p.id === 'B2-B1-G')).toBe(false);

    const stairs = findPlace(data, 'B2-G-ST1')?.place.point as string;
    deletePoint(data, stairs);
    expect(data.vertical.find((v) => v.id === 'B2-ST1')?.stops).toEqual(['B2-F-ST1', 'B2-S-ST1']);
  });
});

describe('الأماكن', () => {
  it('مكان جديد يرث «تجريبي» من الطابق، بترتيب الحقول المعتاد', () => {
    const data = fresh();
    const place = addPlace(data, 'B2-G', { id: 'B2-G120', kind: 'room', point: 'B2-G:p10' });
    expect(place).toEqual({ id: 'B2-G120', kind: 'room', point: 'B2-G:p10', demo: true });
    expect(Object.keys(addPlace(data, 'B2-G', { id: 'B2-G-PR1', kind: 'facility', name: 'مصلى', point: 'B2-G:p9', landmark: true }))).toEqual([
      'id', 'kind', 'name', 'point', 'landmark', 'demo',
    ]);
    expect(validate(data).errors).toEqual([]);
  });

  it('تغيير رمز مكتب يُطبَّق على الدكاترة فيه، ورمز درج على وقفاته', () => {
    const data = fresh();
    updatePlace(data, 'B1-F202', { id: 'B1-F299' });
    expect(data.doctors.find((d) => d.id === 'd1')?.office).toBe('B1-F299');
    updatePlace(data, 'B2-F-ST1', { id: 'B2-F-ST9' });
    expect(data.vertical.find((v) => v.id === 'B2-ST1')?.stops).toContain('B2-F-ST9');
    expect(validate(data).errors).toEqual([]);
  });

  it('إلغاء الاسم أو «معلم» يحذف الحقل من الملف', () => {
    const data = fresh();
    updatePlace(data, 'B1-G-EN1', { landmark: false });
    expect('landmark' in (findPlace(data, 'B1-G-EN1')?.place ?? {})).toBe(false);
  });

  it('حذف مكتب فيه دكتور: يبقى الدكتور وينبّه الفحص', () => {
    const data = fresh();
    deletePlace(data, 'B1-F202');
    expect(validate(data).errors.join()).toContain('المكتب «B1-F202» غير موجود');
  });
});

describe('الدكاترة والدرج والممرات بين الطوابق', () => {
  it('دكتور جديد بمعرّف تالٍ، ويرث «تجريبي» من مكتبه، واسمه ناقص حتى يُكتب', () => {
    const data = fresh();
    const doctor = addDoctor(data, 'B1-F205');
    expect(doctor).toEqual({ id: 'd10', name: '', office: 'B1-F205', demo: true });
    expect(validate(data).errors.join()).toContain('«name»');
  });

  it('درج جديد بلا وقفات حتى تُختار، ولا يقبل معرّفاً مكرراً', () => {
    const data = fresh();
    expect(addVertical(data, 'B1-ST1', 'stairs')).toContain('مستخدم');
    expect(addVertical(data, 'B1-ST4', 'stairs')).toMatchObject({ id: 'B1-ST4', stops: [], demo: true });
    expect(validate(data).errors.join()).toContain('طابقين على الأقل');
  });

  it('ممر جديد بين طابقين بلا طول حتى يُكتب', () => {
    const data = fresh();
    expect(addPassage(data, 'X', 'B2-G:p1', 'B1-G:p1')).toMatchObject({ length_m: 0, demo: true });
    expect(addPassage(data, 'X', 'B2-G:p1', 'B1-G:p1')).toContain('مستخدم');
  });
});

describe('Editor', () => {
  it('تراجع وإعادة، والسحب نقطة تراجع واحدة', () => {
    const editor = new Editor(fresh());
    let changes = 0;
    editor.onChange(() => changes++);
    editor.change((d) => movePoint(d, 'B2-G:p1', 10, 10));
    editor.checkpoint();
    editor.live((d) => movePoint(d, 'B2-G:p1', 20, 20));
    editor.live((d) => movePoint(d, 'B2-G:p1', 30, 30));
    expect(changes).toBe(3);
    editor.undo();
    expect(getFloor(editor.data, 'B2-G').points[0]).toMatchObject({ x: 10, y: 10 });
    editor.undo();
    expect(getFloor(editor.data, 'B2-G').points[0]).toMatchObject({ x: 165, y: 233 });
    expect(editor.canUndo).toBe(false);
    editor.redo();
    expect(getFloor(editor.data, 'B2-G').points[0]).toMatchObject({ x: 10, y: 10 });
  });
});
