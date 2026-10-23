// ================================================================
// ENRUTADOR
// ================================================================
import { $ } from './dom.js';
import { store } from './store.js';
import { renderTabbar } from '../components/tabbar.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/overlay.js';
import { attachSheetDrag } from '../components/sheet-drag.js';

const routes = {};
let stack = [];
let cleanup = null;

export const register = (screen) => { routes[screen.name] = screen; };
export const current = () => stack[stack.length - 1];

export const api = {
  go: (name, params = {}, opts = {}) => navigate(name, params, opts),
  back: () => goBack(),
  goTab: (name) => { stack = []; navigate(name, {}, {}); },
  replace: (name, params = {}) => navigate(name, params, { replace: true }),
  rerender: () => show(),
  toast,
  openModal,
};

function navigate(name, params, { replace = false } = {}) {
  if (!routes[name]) { console.warn(`Pantalla no registrada: ${name}`); return; }
  const entry = { name, params };
  if (replace && stack.length) stack[stack.length - 1] = entry;
  else { stack.push(entry); history.pushState({ n: stack.length }, ''); }
  show();
}

function goBack() {
  if (stack.length > 1) { stack.pop(); show(); }
}

function show() {
  cleanup?.(); cleanup = null;
  const entry = current();
  const screen = routes[entry.name];
  const root = $('#screen');
  root.className = `screen${screen.flow ? ' screen--flow' : ''}`;
  root.innerHTML = screen.render(entry.params, api);
  cleanup = screen.mount?.(root, entry.params, api) || null;
  root.querySelectorAll('.sheet').forEach((s) => attachSheetDrag(s, root));   // la rayita de las hojas se puede arrastrar
  renderTabbar(screen.tab || null);
  root.querySelector('[data-autofocus]')?.focus();
}

/** Arranque: un solo oyente de clics para toda la app. */
export function startRouter(first) {
  $('#app').addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-go],[data-back],[data-tab],[data-action]');
    if (!el) return;
    if (el.dataset.back !== undefined) return goBack();
    if (el.dataset.tab) { store.set({ origin: null, destination: null }); return api.goTab(el.dataset.tab); }   // al cambiar de pestaña, Buscar empieza limpio
    const params = el.dataset.params ? JSON.parse(el.dataset.params) : {};
    if (el.dataset.go) return navigate(el.dataset.go, params, { replace: el.dataset.replace !== undefined });
    if (el.dataset.action) {
      const fn = routes[current().name]?.actions?.[el.dataset.action];
      fn?.(el, params, api, ev, current().params);   // 5.º argumento: parámetros de la pantalla actual
    }
  });
  window.addEventListener('popstate', () => goBack());
  api.go(first.name, first.params || {});
}
