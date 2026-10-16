import './styles/main.css';
import './styles/map.css';
import './styles/app.css';
import { renderApp } from './app';
import { loadDataset } from './data/dataset';
import { containsDemo, loadAllData } from './data/demo';
import { registerServiceWorker } from './pwa/register';

const root = document.getElementById('app');
if (root) {
  renderApp(root, { demo: containsDemo(loadAllData()), dataset: loadDataset().dataset });
}
registerServiceWorker();
