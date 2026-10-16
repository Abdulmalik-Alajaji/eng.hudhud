import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_KEY, INSTALL_STEPS, createInstallHint, isIos, resetInstallState, simulateInstallPrompt } from './install';

describe('isIos', () => {
  it('الآيفون والآيباد، لا أندرويد ولا الحاسوب', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 5)).toBe(false);
  });
});

describe('createInstallHint', () => {
  beforeEach(() => {
    resetInstallState();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  const texts = (card: HTMLElement): string[] => [...card.querySelectorAll('li')].map((li) => li.textContent ?? '');

  it('في الآيفون: خطوات زر المشاركة، بلا زر إضافة', () => {
    const card = createInstallHint(() => 'ios') as HTMLElement;
    expect(card.querySelector('h2')?.textContent).toContain('شاشتك الرئيسية');
    expect(texts(card)).toEqual(INSTALL_STEPS.ios);
    expect(card.textContent).not.toContain('أضفه الآن');
  });

  it('حين يرسل المتصفح حدث الإضافة: زر «أضفه الآن» يفتح نافذة المتصفح', async () => {
    const card = createInstallHint() as HTMLElement;
    expect(texts(card).length).toBeGreaterThan(0);
    const prompt = vi.fn(async () => undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    simulateInstallPrompt(event);
    const add = [...card.querySelectorAll('button')].find((b) => b.textContent === 'أضفه الآن');
    expect(add).toBeDefined();
    add?.click();
    await vi.waitFor(() => expect(card.hidden).toBe(true));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('«إخفاء» يزيلها ولا تعود في الفتح التالي', () => {
    const card = createInstallHint(() => 'other') as HTMLElement;
    document.body.append(card);
    [...card.querySelectorAll('button')].find((b) => b.textContent === 'إخفاء')?.click();
    expect(card.isConnected).toBe(false);
    expect(localStorage.getItem(HIDDEN_KEY)).toBe('1');
    expect(createInstallHint(() => 'other')).toBeNull();
  });

  it('لا تظهر إذا فُتح الموقع من الشاشة الرئيسية', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(display-mode: standalone)' }));
    expect(createInstallHint(() => 'ios')).toBeNull();
  });
});
