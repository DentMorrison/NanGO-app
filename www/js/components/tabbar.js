// Barra inferior flotante: solo íconos (cada uno con su nombre oculto para lectores de pantalla).
import { store } from '../core/store.js';
import { t } from '../core/i18n.js';

export const TABS = [
  { id: 'home',    icon: 'home-2',      label: 'Inicio' },
  { id: 'search',  icon: 'search',      label: 'Buscar rutas' },
  { id: 'lines',   icon: 'bus',         label: 'Líneas y mapa' },
  { id: 'alerts',  icon: 'bell',        label: 'Avisos' },
  { id: 'profile', icon: 'user-circle', label: 'Mi perfil' },
];

let ultimoContador = null;

export function renderTabbar(active) {
  const bar = document.getElementById('tabbar');
  if (!active) { bar.classList.add('is-hidden'); bar.innerHTML = ''; return; }
  const n = store.get().unreadAlerts;
  const nuevo = ultimoContador !== null && n > ultimoContador;
  ultimoContador = n;
  bar.classList.remove('is-hidden');
  bar.innerHTML = TABS.map((tab) => `
    <button class="tabbar__item ${tab.id === active ? 'is-active' : ''}" data-tab="${tab.id}" role="tab"
            aria-label="${t(tab.label)}" ${tab.id === active ? 'aria-selected="true"' : ''}>
      <i class="ti ti-${tab.icon}" aria-hidden="true"></i>
      ${tab.id === 'alerts' && n > 0 ? `<b class="tabbar__badge ${nuevo ? 'is-new' : ''}" aria-label="${n} avisos nuevos">${n}</b>` : ''}
    </button>`).join('');
}
