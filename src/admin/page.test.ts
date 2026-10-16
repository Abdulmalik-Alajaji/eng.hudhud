import { beforeEach, describe, expect, it } from 'vitest';
import { loadDataFiles } from '../data/dataset';
import { DRAFT_KEY } from './draft';
import { startAdmin } from './page';

const published = loadDataFiles();

function click(root: HTMLElement, selector: string, text: string): void {
  const node = [...root.querySelectorAll<HTMLElement>(selector)].find((n) => n.textContent?.includes(text));
  if (!node) throw new Error(`لم أجد ${selector} ${text}`);
  node.click();
}

const go = (tab: string): void => {
  history.replaceState(null, '', `/admin.html#${tab}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

describe('صفحة الإدارة', () => {
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/admin.html');
    document.body.replaceChildren();
    root = document.createElement('div');
    document.body.append(root);
  });

  it('تفتح على الخرائط، والبيانات المنشورة سليمة بلا تعديلات', () => {
    startAdmin(root, published);
    expect(root.querySelector('h1')?.textContent).toBe('إدارة بيانات الكلية');
    expect(root.querySelector('.adm-status')?.textContent).toBe('✓ البيانات سليمة · لا تعديلات');
    expect([...root.querySelectorAll('.adm-tabs__link')].map((l) => l.textContent)).toEqual(['الخرائط', 'الدكاترة', 'الدرج والممرات', 'الحفظ']);
    expect(root.querySelectorAll('circle[data-id]').length).toBeGreaterThan(0);
    expect(root.querySelector('.demo-banner')).not.toBeNull();
  });

  it('دكتور جديد بلا اسم: خطأ، والتنزيل معطّل حتى يُكتب الاسم', () => {
    startAdmin(root, published);
    go('doctors');
    click(root, 'button', 'أضف دكتوراً');
    expect(root.querySelector('.adm-status')?.textContent).toContain('خطأ');
    go('save');
    const get = [...root.querySelectorAll<HTMLButtonElement>('.adm-files button')];
    expect(get.map((b) => b.textContent)).toEqual(['نزّل doctors.json']);
    expect(get[0]?.disabled).toBe(true);

    go('doctors');
    const name = [...root.querySelectorAll<HTMLInputElement>('.adm-item--doctor input[type=text]')].pop() as HTMLInputElement;
    name.value = 'د. اختبار';
    name.dispatchEvent(new Event('change'));
    go('save');
    expect(root.querySelector<HTMLButtonElement>('.adm-files button')?.disabled).toBe(false);
  });

  it('«تراجع» يلغي آخر تعديل، والمسودة تُحفظ في المتصفح وتعود عند الفتح', () => {
    startAdmin(root, published);
    go('doctors');
    click(root, 'button', 'أضف دكتوراً');
    click(root, 'button', 'تراجع');
    expect(root.querySelector('.adm-status')?.textContent).toContain('لا تعديلات');
    click(root, 'button', 'إعادة');
    expect(localStorage.getItem(DRAFT_KEY)).toContain('"d10"');

    // فتح الصفحة من جديد: التعديل ما زال موجوداً (سجل التراجع لا يبقى بعد إغلاق الصفحة).
    const again = document.createElement('div');
    startAdmin(again, published);
    expect(again.querySelector('.adm-status')?.textContent).toContain('1 ملف معدّل');
  });

  it('خطوات الرفع: مجلدان يعني رفع الثاني إلى فرع الأول نفسه', () => {
    startAdmin(root, published);
    go('doctors');
    click(root, 'button', 'أضف دكتوراً');
    go('map');
    // نقل نقطة من لوحة النقطة: حدّد p1 ثم غيّر x.
    const circle = root.querySelector('circle[data-id]') as SVGCircleElement;
    circle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    circle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const x = root.querySelector<HTMLInputElement>('.adm-panel input[type=number]') as HTMLInputElement;
    x.value = String(Number(x.value) + 1);
    x.dispatchEvent(new Event('change'));
    go('save');
    const steps = root.querySelector('.adm-steps')?.textContent ?? '';
    expect(steps).toContain('data/floors');
    expect(steps).toContain('Commit directly to the');
    expect(root.querySelectorAll('.adm-files li')).toHaveLength(2);
  });

  it('مسودة تطابق المنشور الآن (رُفعت ودُمجت): تُحذف بلا تنبيه', () => {
    const data = {
      buildings: (published['/data/buildings.json'] as { buildings: unknown }).buildings,
      floors: Object.entries(published).filter(([p]) => p.startsWith('/data/floors/')).map(([, f]) => f),
      vertical: (published['/data/links.json'] as { vertical: unknown }).vertical,
      passages: (published['/data/links.json'] as { passages: unknown }).passages,
      doctors: (published['/data/doctors.json'] as { doctors: unknown }).doctors,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: 'old', savedAt: '', data }));
    startAdmin(root, published);
    expect(root.querySelector('.adm-notice')).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('البيانات المنشورة تغيّرت منذ بدأت المسودة: تنبيه وخياران', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: 'old', savedAt: '', data: JSON.parse(JSON.stringify({
      buildings: (published['/data/buildings.json'] as { buildings: unknown }).buildings,
      floors: Object.entries(published).filter(([p]) => p.startsWith('/data/floors/')).map(([, f]) => f),
      vertical: (published['/data/links.json'] as { vertical: unknown }).vertical,
      passages: (published['/data/links.json'] as { passages: unknown }).passages,
      doctors: [...(published['/data/doctors.json'] as { doctors: unknown[] }).doctors, { id: 'd99', name: 'د. مسودة', office: 'B1-F202', demo: true }],
    })) }));
    startAdmin(root, published);
    expect(root.querySelector('.adm-notice')?.textContent).toContain('تغيّرت منذ بدأت هذه المسودة');
    click(root, 'button', 'أكمل المسودة');
    expect(root.querySelector('.adm-notice')).toBeNull();
  });
});
