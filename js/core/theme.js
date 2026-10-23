// Aplica las preferencias visuales
import { store } from './store.js';

const ESCALAS = [0.9, 1, 1.15, 1.3];
const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function applyPreferences() {
  const s = store.get();
  const app = document.getElementById('app');
  const dark = s.theme === 'dark' || (s.theme === 'auto' && mq.matches);
  app.dataset.theme = dark ? 'dark' : 'light';
  app.classList.toggle('high-contrast', s.highContrast);
  app.classList.toggle('reduce-motion', s.reduceMotion);
  document.documentElement.style.setProperty('--text-scale', ESCALAS[s.textSize] ?? 1);
  document.documentElement.lang = s.lang;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#112A4D' : '#0F2D57');
}

export const isDark = () => document.getElementById('app')?.dataset.theme === 'dark';
export const textSizeLabels = ['Pequeño', 'Normal', 'Grande', 'Muy grande'];

mq.addEventListener?.('change', applyPreferences);
store.subscribe(applyPreferences);
