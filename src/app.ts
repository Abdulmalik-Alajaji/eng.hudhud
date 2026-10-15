import { createDemoBanner } from './demo-banner';

export const APP_TITLE = 'هدهد الهندسة';

export interface AppOptions {
  /** يوجد عنصر تجريبي واحد على الأقل في البيانات. */
  demo: boolean;
}

/** الصفحة المؤقتة للمرحلة 0: للتأكد من أن النشر يعمل. */
export function renderApp(root: HTMLElement, options: AppOptions): void {
  root.replaceChildren();

  if (options.demo) {
    root.append(createDemoBanner());
  }

  const main = document.createElement('main');
  main.className = 'placeholder';

  const title = document.createElement('h1');
  title.textContent = APP_TITLE;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'قريباً';

  main.append(title, subtitle);
  root.append(main);
}
