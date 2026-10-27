import { describe, expect, it } from 'vitest';
import { loadDataset } from './data/dataset';
import { createIndex, datasetEntries, nameMatches, normalizeText, search } from './search';

describe('normalizeText', () => {
  it('يوحّد الهمزات والتاء المربوطة والألف المقصورة', () => {
    expect(normalizeText('إيمان')).toBe(normalizeText('ايمان'));
    expect(normalizeText('أحمد')).toBe('احمد');
    expect(normalizeText('آمنة')).toBe('امنه');
    expect(normalizeText('نورة')).toBe(normalizeText('نوره'));
    expect(normalizeText('مصطفى')).toBe(normalizeText('مصطفي'));
    expect(normalizeText('مسؤول')).toBe(normalizeText('مسوول'));
    expect(normalizeText('رئيس')).toBe(normalizeText('رييس'));
  });

  it('يحذف التشكيل والتطويل وعلامات الترقيم', () => {
    expect(normalizeText('مُحَمَّد')).toBe('محمد');
    expect(normalizeText('الـمـكـتـبـة')).toBe('المكتبه');
    expect(normalizeText('د. أحمد')).toBe('د احمد');
  });

  it('يحوّل الأرقام العربية والهندية والحروف الكبيرة', () => {
    expect(normalizeText('B1-F٢١٥')).toBe('b1 f215');
    expect(normalizeText('۲۱۵')).toBe('215');
  });
});

describe('search', () => {
  const index = createIndex([
    { value: 'B1-F215', title: 'القاعة B1-F215', detail: '', code: 'B1-F215', keywords: ['قاعة'] },
    { value: 'B1-F216', title: 'القاعة B1-F216', detail: '', code: 'B1-F216', keywords: ['قاعة'] },
    { value: 'B2-F215', title: 'القاعة B2-F215', detail: '', code: 'B2-F215', keywords: ['قاعة'] },
    { value: 'B1-G-PR1', title: 'المصلى', detail: '', keywords: ['مرفق'] },
    { value: 'doctor:d1', title: 'د. إيمان التجريبية', detail: '', keywords: ['دكتورة'] },
  ]);
  const values = (q: string): string[] => search(index, q).map((e) => e.value);

  it('الرمز كاملاً بشرطة أو بدونها، وبحروف صغيرة', () => {
    expect(values('B1-F215')[0]).toBe('B1-F215');
    expect(values('b1f215')[0]).toBe('B1-F215');
    expect(values('b1 f215')[0]).toBe('B1-F215');
  });

  it('رقم الغرفة وحده أو مع الطابق يجد الغرفة في المبنيين', () => {
    expect(values('215')).toEqual(['B1-F215', 'B2-F215']);
    expect(values('F215')).toEqual(['B1-F215', 'B2-F215']);
    expect(values('٢١٥')).toEqual(['B1-F215', 'B2-F215']);
  });

  it('اسم الدكتور بلا همزة أو تاء مربوطة، أو مع كلمة «دكتورة»', () => {
    expect(values('ايمان')).toEqual(['doctor:d1']);
    expect(values('التجريبيه')).toEqual(['doctor:d1']);
    expect(values('دكتورة ايمان')).toEqual(['doctor:d1']);
    expect(values('د. إيمان')).toEqual(['doctor:d1']);
  });

  it('المرافق بالاسم', () => {
    expect(values('مصلي')).toEqual(['B1-G-PR1']);
  });

  it('لا نتائج لنص فارغ أو غير موجود', () => {
    expect(values('   ')).toEqual([]);
    expect(values('مسبح')).toEqual([]);
  });

  it('عدد النتائج محدود', () => {
    expect(search(index, 'قاعه', 2)).toHaveLength(2);
  });
});

describe('datasetEntries على البيانات التجريبية', () => {
  const dataset = loadDataset().dataset;
  if (!dataset) throw new Error('البيانات فيها أخطاء');
  const entries = datasetEntries(dataset, { doctors: true });
  const index = createIndex(entries);

  it('كل مكان وكل دكتور موجود في البحث', () => {
    const places = dataset.floors.reduce((n, f) => n + f.places.length, 0);
    expect(entries).toHaveLength(places + dataset.doctors.length);
  });

  it('رمز كل قاعة يجدها أولاً', () => {
    for (const floor of dataset.floors) {
      for (const place of floor.places.filter((p) => ['room', 'lab', 'office'].includes(p.kind))) {
        expect(search(index, place.id)[0]?.value).toBe(place.id);
      }
    }
  });

  it('اسم كل دكتور يجده، ومكتبه يذكر اسمه', () => {
    for (const doctor of dataset.doctors) {
      const first = doctor.name.replace('د. ', '').split(' ')[0] as string;
      expect(search(index, first).map((e) => e.value)).toContain(`doctor:${doctor.id}`);
      const office = entries.find((e) => e.value === doctor.office);
      expect(office?.detail).toContain(doctor.name);
    }
  });

  it('المكان يذكر مبناه وطابقه', () => {
    expect(entries.find((e) => e.value === 'B1-G-PR1')?.detail).toBe('المبنى 1 · الطابق الأرضي');
  });
});

describe('nameMatches (بحث المعالم)', () => {
  it('أي جزء من الاسم', () => {
    expect(nameMatches('المكتبة المركزية', 'مكتبة')).toBe(true);
    expect(nameMatches('المكتبة المركزية', 'مركز')).toBe(true);
    expect(nameMatches('المكتبة المركزية', 'مسرح')).toBe(false);
  });

  it('يتجاهل الهمزات والتاء المربوطة والألف المقصورة والتشكيل والمسافات الزائدة', () => {
    expect(nameMatches('المدخل الرئيسي', 'الرييسي')).toBe(true);
    expect(nameMatches('الإدارة', 'الاداره')).toBe(true);
    expect(nameMatches('آمنة', 'امنه')).toBe(true);
    expect(nameMatches('المصلى', 'مصلي')).toBe(true);
    expect(nameMatches('المكتبة', 'المَكْتَبَة')).toBe(true);
    expect(nameMatches('المدخل الرئيسي', '   المدخل    الرئيسي  ')).toBe(true);
  });

  it('أكثر من كلمة: كلها يجب أن توجد، بأي ترتيب', () => {
    expect(nameMatches('الممر إلى كلية العلوم', 'العلوم ممر')).toBe(true);
    expect(nameMatches('الممر إلى كلية العلوم', 'ممر الهندسة')).toBe(false);
  });

  it('النص الفارغ يطابق كل شيء', () => {
    expect(nameMatches('المسرح', '')).toBe(true);
    expect(nameMatches('المسرح', '  ')).toBe(true);
  });
});
