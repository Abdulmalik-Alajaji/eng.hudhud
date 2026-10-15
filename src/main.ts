import './styles/main.css';
import { renderApp } from './app';
import { containsDemo, loadAllData } from './data/demo';

const root = document.getElementById('app');
if (root) {
  renderApp(root, { demo: containsDemo(loadAllData()) });
}
