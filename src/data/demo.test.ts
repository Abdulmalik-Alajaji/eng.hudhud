import { describe, expect, it } from 'vitest';
import { containsDemo, loadAllData } from './demo';

describe('containsDemo', () => {
  it('لا بيانات: لا شريط', () => {
    expect(containsDemo([])).toBe(false);
    expect(containsDemo({})).toBe(false);
    expect(containsDemo(null)).toBe(false);
  });

  it('عنصر تجريبي واحد في أي عمق: يظهر الشريط', () => {
    const floors = [
      {
        id: 'F1',
        rooms: [
          { code: 'A-101', demo: false },
          { code: 'A-102', demo: true },
        ],
      },
    ];
    expect(containsDemo(floors)).toBe(true);
    expect(containsDemo({ demo: true })).toBe(true);
  });

  it('بيانات حقيقية فقط: لا شريط', () => {
    expect(containsDemo([{ code: 'A-101' }, { code: 'A-102', demo: false }])).toBe(false);
  });

  it('العلامة يجب أن تكون القيمة المنطقية true وليس نصاً', () => {
    expect(containsDemo({ demo: 'true' })).toBe(false);
    expect(containsDemo({ demo: 1 })).toBe(false);
  });
});

describe('loadAllData', () => {
  it('يقرأ ملفات data/ ويعيد قائمة', () => {
    expect(Array.isArray(loadAllData())).toBe(true);
  });
});
