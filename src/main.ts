import './styles/main.css';
import './styles/map.css';
import './styles/app.css';
import { renderApp } from './app';
import { loadDataset } from './data/dataset';
import { containsDemo, loadAllData } from './data/demo';
import { createInstallHint, listenForInstall } from './pwa/install';
import { registerServiceWorker } from './pwa/register';
import { applyTheme, getTheme } from './theme';

// المظهر المحفوظ (داكن أو فاتح) قبل رسم أي شيء.
applyTheme(getTheme());
// قبل الرسم: المتصفح قد يرسل حدث الإضافة إلى الشاشة الرئيسية مبكراً.
listenForInstall();
const root = document.getElementById('app');
if (root) {
  renderApp(root, {
    demo: containsDemo(loadAllData()),
    dataset: loadDataset().dataset,
    footer: createInstallHint(),
  });
}
registerServiceWorker();
