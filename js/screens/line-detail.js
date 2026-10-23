// FICHA DE UNA LÍNEA, en tres pestañas:

import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { appbar, lineBadge, lineVars } from '../components/ui.js';
import { createMap } from '../components/map.js';
import { traficoHtml } from '../components/trafico.js';
import { getLinea, soles } from '../data/lineas.js';
import { paraderosDe, callesDeLinea } from '../services/lines.service.js';
import { esLineaFavorita, alternarLinea } from '../services/favorites.service.js';
import { proximoMin, esNocturno } from '../services/eta.service.js';
import { ahora, tipoDia } from '../services/clock.js';

const PESTANAS = [['recorrido', 'Recorrido', 'route'], ['tarifas', 'Tarifas', 'coin'], ['trafico', 'Tráfico', 'traffic-lights']];
const TIPOS = [['adulto', 'Adulto', 'user'], ['universitario', 'Universitario', 'school'], ['escolar', 'Escolar', 'backpack']];

// Recorrido en el sentido pedido. La vuelta usa lo que haya en linea.vuelta (hoy es la ida invertida).
const trazo = (l, sentido) => (sentido === 'vuelta' ? l.vuelta : l.ida);

function recorrido(l, sentido) {
  const ps = paraderosDe(l);
  const lista = sentido === 'vuelta' ? [...ps].reverse() : ps;
  const calles = callesDeLinea(l, sentido === 'vuelta');
  const prox = proximoMin(l);
  return `
    <div class="ficha-stats">
      <div>${ic('clock')}<b>${t('Cada {f} min', { f: l.frecuenciaMin })}</b><small>${t('frecuencia')}</small></div>
      <div>${ic('sunrise')}<b>${esc(l.horario.inicio.replace(':00', ''))}</b><small>${t('hasta')} ${esc(l.horario.fin.replace(':00', ''))}</small></div>
      <div>${ic('bus')}<b>${prox !== null ? `~${prox} min` : '—'}</b><small>${t('próxima micro')}</small></div>
    </div>
    <div class="segmented seg-sentido">${[['ida', 'Ida'], ['vuelta', 'Vuelta']].map(([id, n]) => `<button class="segmented__opt ${id === sentido ? 'is-active' : ''}" data-action="sentido" data-params='{"sentido":"${id}"}'>${ic(id === 'ida' ? 'arrow-narrow-right' : 'arrow-narrow-left')}${t(n)}</button>`).join('')}</div>
    ${sentido === 'vuelta' ? `<div class="line-fact">${ic('info-circle')}${t('Recorrido de vuelta por confirmar: por ahora se muestra el mismo trazo en sentido contrario.')}</div>` : ''}
    <button class="btn btn--primary btn--block ficha-start" data-go="line-trip" data-params='{"id":"${l.id}","sentido":"${sentido}"}'>${ic('player-play')}${t('Iniciar modo viaje')}</button>
    <h4 class="ficha__h">${t('Paraderos')} <span>${lista.length}</span></h4>
    <ol class="timeline">${lista.map((p, i) => `
      <li class="${i === 0 ? 'is-first' : i === lista.length - 1 ? 'is-last' : ''}">
        <span class="timeline__dot"></span>
        <span class="timeline__name">${esc(p.nombre)}</span>
        ${i === 0 ? `<small>${t('Inicio')}</small>` : i === lista.length - 1 ? `<small>${t('Final')}</small>` : ''}
      </li>`).join('')}</ol>
    ${calles.length ? `<details class="calles-det"><summary>${ic('road')}${t('Calles del recorrido')} <span>${calles.length}</span>${ic('chevron-down', 'calles-det__chev')}</summary>
      <div class="calles">${calles.map((c) => `<span class="calle">${esc(c)}</span>`).join('')}</div></details>` : ''}`;
}

function tarifas(l) {
  const noche = esNocturno(l, ahora());
  const bloque = (icono, titulo, horas, valor, activa) => `
    <section class="fare ${activa ? 'is-now' : ''}">
      <header class="fare__head">${ic(icono)}<div><b>${titulo}</b><small>${horas}</small></div>${activa ? `<i class="fare__now">${t('Ahora')}</i>` : ''}</header>
      <div class="fare__row">${TIPOS.map(([id, n, ico]) => `<div class="fare__cell">${ic(ico)}<small>${t(n)}</small><b>${soles(valor(id))}</b></div>`).join('')}</div>
    </section>`;
  return `
    <div class="fares">
      ${bloque('sun', t('Diurno'), `${l.horario.inicio} – ${l.horario.nocturnoDesde}`, (id) => l.tarifa[id], !noche)}
      ${bloque('moon', t('Nocturno'), `${t('desde las')} ${l.horario.nocturnoDesde}`, () => l.tarifa.nocturna, noche)}
    </div>
    ${l.tarifa.porConfirmar ? `<div class="line-fact">${ic('info-circle')}${t('Tarifas de referencia: por confirmar con la empresa.')}</div>` : ''}`;
}

export default {
  name: 'line-detail',
  tab: 'lines',

  render(params) {
    const l = getLinea(params.id);
    const pestana = params.pestana || 'recorrido';
    const sentido = params.sentido || 'ida';
    const fav = esLineaFavorita(l.id);
    const cuerpo = pestana === 'tarifas' ? tarifas(l) : pestana === 'trafico' ? traficoHtml({ dia: params.dia || tipoDia(), tabla: params.tabla }) : recorrido(l, sentido);

    return `${appbar()}
      <div style="position:relative;flex:1;min-height:0">
        <div class="map" id="map"></div>
        <button class="map-btn" style="left:12px;top:12px" data-back aria-label="${t('Volver')}">${ic('arrow-left')}</button>
        <button class="map-btn" style="right:12px;top:12px" data-action="favorito" aria-label="${t('Guardar en favoritos')}" aria-pressed="${fav}">${ic(fav ? 'heart-filled' : 'heart')}</button>
        <div class="sheet sheet--route sheet--ficha" id="sheet" data-follow="#pop" style="${lineVars(l)}">
          <div class="sheet__handle"></div>
          <div class="line-head">${lineBadge(l, 'lg')}<div class="grow"><h3 class="sheet__title" style="padding:0">${esc(l.nombre)}</h3><div class="sheet__sub" style="padding:0">${esc(l.empresa)}</div></div></div>
          <div class="ficha-tabs" role="tablist">${PESTANAS.map(([id, n, ico]) => `<button role="tab" aria-selected="${id === pestana}" class="ficha-tab ${id === pestana ? 'is-active' : ''}" data-action="pestana" data-params='{"pestana":"${id}"}'>${ic(ico)}${t(n)}</button>`).join('')}</div>
          <div class="sheet__steps ficha">${cuerpo}</div>
        </div>
        <img class="line-photo-pop" id="pop" src="${l.foto}" alt="">
      </div>`;
  },

  mount(root, params) {
    const l = getLinea(params.id);
    const sentido = params.sentido || 'ida';
    const mapa = createMap(root.querySelector('#map'));
    const puntos = trazo(l, sentido);
    mapa.line(l, { weight: 6, points: puntos });
    const ps = paraderosDe(l);
    (sentido === 'vuelta' ? [...ps].reverse() : ps).forEach((p, i, a) => mapa.pin(p.c, i === 0 ? 'origin' : i === a.length - 1 ? 'dest' : 'stop'));
    const hoja = root.querySelector('#sheet');
    root.querySelector('#pop').style.bottom = `${hoja.offsetHeight - 14}px`;
    mapa.fit(puntos, { top: 70, bottom: hoja.offsetHeight + 40 });
    return () => mapa.destroy();
  },

  actions: {
    pestana(_el, { pestana }, api, _e, pantalla) { pantalla.pestana = pestana; api.rerender(); },
    sentido(_el, { sentido }, api, _e, pantalla) { pantalla.sentido = sentido; api.rerender(); },
    dia(_el, { dia }, api, _e, pantalla) { pantalla.dia = dia; api.rerender(); },
    tabla(_el, _p, api, _e, pantalla) { pantalla.tabla = !pantalla.tabla; api.rerender(); },
    favorito(_el, _p, api, _e, pantalla) { const si = alternarLinea(pantalla.id); api.toast(si ? t('Guardada en favoritos') : t('Quitada de favoritos')); api.rerender(); },
  },
};
