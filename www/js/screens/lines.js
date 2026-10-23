// LÍNEAS DE JULIACA
import { t } from '../core/i18n.js';
import { esc, ic, go, norm } from '../core/dom.js';
import { appbar, lineBadge } from '../components/ui.js';
import { LINEAS, soles } from '../data/lineas.js';
import { proximoMin } from '../services/eta.service.js';
import { esLineaFavorita } from '../services/favorites.service.js';

let ui = { q: '', soloFav: false };

const visibles = () => LINEAS.filter((l) => (!ui.soloFav || esLineaFavorita(l.id)) && (!ui.q || norm(`${l.nombre} ${l.empresa} ${l.numero}`).includes(norm(ui.q))));

const filas = () => visibles().map((l) => `
  <button class="sheet__row line-row" ${go('line-detail', { id: l.id })}>
    ${lineBadge(l)}
    <div class="sheet__row-body"><div class="sheet__row-title">${esc(l.nombre)}</div><div class="sheet__row-sub">${esc(l.empresa)}<br>~${proximoMin(l) ?? '—'} min · ${soles(l.tarifa.adulto)}</div></div>
    <img class="line-row__photo" src="${l.foto}" alt="">
  </button>`).join('') || `<p class="sheet__sub" style="padding:14px 18px">${t(ui.soloFav ? 'Aún no tienes líneas favoritas.' : 'No encontramos esa línea.')}</p>`;

export default {
  name: 'lines',
  tab: 'lines',

  render() {
    return `${appbar()}
      <div class="scroll">
        <div class="section-title" style="padding-bottom:4px"><h3>${t('Líneas de Juliaca')}</h3></div>
        <p class="home-hint">${t('Toca una línea para ver su recorrido, tarifas y tráfico.')}</p>
        <div class="line-search">
          <div class="float-card" style="position:static"><label class="route-summary" style="cursor:text">${ic('search')}<input id="q" class="field__input" placeholder="${t('Buscar línea o empresa')}" value="${esc(ui.q)}" style="font-weight:400"></label></div>
          <div class="chip-row"><button class="chip ${ui.soloFav ? 'is-active' : ''}" data-action="favoritas" aria-pressed="${ui.soloFav}">${ic('heart')}${t('Favoritas')}</button></div>
        </div>
        <div id="filas" class="line-list">${filas()}</div>
      </div>`;
  },

  mount(root) {
    root.querySelector('#q').addEventListener('input', (e) => { ui.q = e.target.value; root.querySelector('#filas').innerHTML = filas(); });
    return null;
  },

  actions: {
    favoritas(_el, _p, api) { ui.soloFav = !ui.soloFav; api.rerender(); },
  },
};
