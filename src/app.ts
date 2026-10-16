import { createDemoBanner } from './demo-banner';
import { createHudhud } from './hudhud/hudhud';

export const APP_TITLE = 'هدهد الهندسة';

export interface AppOptions {
  /** يوجد عنصر تجريبي واحد على الأقل في البيانات. */
  demo: boolean;
}

/** الصفحة المؤقتة حتى تُبنى الواجهة في المرحلة 4: الهدهد واسم الموقع. */
export function renderApp(root: HTMLElement, options: AppOptions): void {
  root.replaceChildren();

  if (options.demo) {
    root.append(createDemoBanner());
  }

  const main = document.createElement('main');
  main.className = 'placeholder';

  const hudhud = createHudhud('strong', APP_TITLE);
  hudhud.classList.add('placeholder__hudhud');

  const title = document.createElement('h1');
  title.textContent = APP_TITLE;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'قريباً';

  main.append(hudhud, title, subtitle);
  root.append(main);
}
