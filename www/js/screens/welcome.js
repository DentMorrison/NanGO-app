// BIENVENIDA
import { store } from '../core/store.js';
import { IDIOMAS, t } from '../core/i18n.js';
import { ic } from '../core/dom.js';

export default {
  name: 'welcome',
  flow: true,

  render() {
    const lang = store.get().lang;
    return `
      <div class="cover" style="height:250px;background-position:center 30%">
        <div class="cover__bar"><img class="appbar__logo" src="assets/img/brand/wordmark.png" alt="ÑanGO"></div>
      </div>
      <div class="stripe"></div>
      <div class="welcome">
        <h2>${t('Tu ubicación es solo tuya')}</h2>
        <p class="welcome__lead">${t('ÑanGO no usa GPS. Tú eliges dónde estás con lugares que ya conoces.')}</p>
        <div class="welcome__point">${ic('shield-lock')}<div><b>${t('No te rastreamos')}</b><span>${t('Sin permisos de ubicación ni seguimiento.')}</span></div></div>
        <div class="welcome__point">${ic('wifi-off')}<div><b>${t('Funciona sin internet')}</b><span>${t('Guarda tus líneas y consúltalas sin señal.')}</span></div></div>
        <h4>${t('Idioma')}</h4>
        <div class="lang-grid">
          ${IDIOMAS.map((l) => `<button data-action="lang" data-params='{"id":"${l.id}"}' class="${l.id === lang ? 'is-active' : ''}" aria-pressed="${l.id === lang}">${l.nombre}<small>${l.sub}</small></button>`).join('')}
        </div>
        <button class="btn btn--primary btn--block btn--lg" data-action="start">${t('Empezar')}</button>
      </div>`;
  },

  actions: {
    lang(_el, { id }, api) { store.set({ lang: id }); api.rerender(); },
    start(_el, _p, api) { store.set({ seenWelcome: true }); api.replace('auth', { modo: 'registro' }); },
  },
};
