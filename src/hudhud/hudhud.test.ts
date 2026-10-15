import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHudhud, createHudhudShape, hudhudController } from './hudhud';
import { HUDHUD_HEIGHT, HUDHUD_WIDTH } from './shape';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('createHudhudShape', () => {
  it('يرسم الشكل بلون النص الحالي', () => {
    const svg = createHudhudShape();
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${HUDHUD_WIDTH} ${HUDHUD_HEIGHT}`);
    expect(svg.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
  });
});

describe('createHudhud', () => {
  beforeEach(() => {
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => ++id));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    mockReducedMotion(false);
    setVisibility('visible');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('صورة لها وصف عربي لقارئات الشاشة', () => {
    const hudhud = createHudhud('medium');
    expect(hudhud.getAttribute('role')).toBe('img');
    expect(hudhud.getAttribute('aria-label')).toBe('هدهد الهندسة');
    expect(hudhud.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('الثابت (علامة الوجهة): SVG بلا canvas ولا حركة', () => {
    const hudhud = createHudhud('still', 'الوجهة');
    expect(hudhud.querySelector('svg')).not.toBeNull();
    expect(hudhud.querySelector('canvas')).toBeNull();
    expect(hudhudController(hudhud)).toBeUndefined();
  });

  it('يتحرك، ويتوقف حين تكون الصفحة في الخلفية، ويعود حين ترجع', async () => {
    const controller = hudhudController(createHudhud('calm'))!;
    await Promise.resolve();
    expect(controller.running).toBe(true);
    setVisibility('hidden');
    expect(controller.running).toBe(false);
    setVisibility('visible');
    expect(controller.running).toBe(true);
  });

  it('مع «تقليل الحركة» لا يتحرك', async () => {
    mockReducedMotion(true);
    const controller = hudhudController(createHudhud('strong'))!;
    await Promise.resolve();
    expect(controller.running).toBe(false);
  });

  it('seek يوقف الحركة عند لحظة محددة، وplay يعيدها', async () => {
    const controller = hudhudController(createHudhud('medium', undefined, { seed: 1 }))!;
    await Promise.resolve();
    controller.seek(2500);
    expect(controller.running).toBe(false);
    controller.play();
    expect(controller.running).toBe(true);
  });
});
