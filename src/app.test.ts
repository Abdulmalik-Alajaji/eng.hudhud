import { beforeEach, describe, expect, it } from 'vitest';
import { APP_TITLE, renderApp } from './app';
import { DEMO_BANNER_TEXT } from './demo-banner';

describe('renderApp', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('يعرض عنوان الموقع', () => {
    renderApp(root, { demo: false });
    expect(root.querySelector('h1')?.textContent).toBe(APP_TITLE);
  });

  it('يعرض الهدهد المعتمد (الصواعق الهادئة)', () => {
    renderApp(root, { demo: false });
    const hudhud = root.querySelector('.hudhud');
    expect(hudhud?.classList.contains('hudhud--calm')).toBe(true);
    expect(hudhud?.getAttribute('aria-label')).toBe(APP_TITLE);
  });

  it('يعرض شريط النسخة التجريبية في الأعلى عند وجود بيانات تجريبية', () => {
    renderApp(root, { demo: true });
    const banner = root.firstElementChild;
    expect(banner?.classList.contains('demo-banner')).toBe(true);
    expect(banner?.textContent).toBe(DEMO_BANNER_TEXT);
  });

  it('لا يعرض الشريط عند عدم وجود بيانات تجريبية', () => {
    renderApp(root, { demo: false });
    expect(root.querySelector('.demo-banner')).toBeNull();
  });

  it('إعادة الرسم لا تكرر المحتوى', () => {
    renderApp(root, { demo: true });
    renderApp(root, { demo: true });
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelectorAll('.demo-banner')).toHaveLength(1);
  });
});
