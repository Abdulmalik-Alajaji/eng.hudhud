export const DEMO_BANNER_TEXT = 'نسخة تجريبية: البيانات ليست حقيقية';

export function createDemoBanner(): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = DEMO_BANNER_TEXT;
  return banner;
}
