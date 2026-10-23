// RUTA ELEGIDA
import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { appbar, lineBadge, lineVars } from '../components/ui.js';
import { createMap } from '../components/map.js';
import { LINEAS, soles } from '../data/lineas.js';
import { getPunto } from '../services/places.service.js';
import { agregarHistorial } from '../services/favorites.service.js';
import { iniciarOpcion } from '../services/trip.service.js';
import { buscarOpciones, pasosDe } from '../services/routing.service.js';
import { rutaCaminata } from '../services/geo.js';

const buscar = ({ o, d, id }) => { const todas = buscarOpciones(o, d); return todas.find((x) => x.id === id) || todas[0]; };

export default {
  name: 'route',
  tab: 'search',

  render(params) {
    const op = buscar(params);
    if (!op) return `${appbar()}<div class="empty"><h3>${t('Sin micros directos')}</h3></div>`;
    const pasos = pasosDe(op, params.o, params.d);
    return `${appbar()}
      <div style="position:relative;flex:1;min-height:0">
        <div class="map" id="map"></div>
        <div class="float-card"><button class="route-summary" data-back>${ic('arrow-left')}${esc(params.o)}${ic('arrow-right')}<span class="grow ellipsis">${esc(params.d)}</span></button></div>
        <div class="sheet sheet--route">
          <div class="sheet__handle"></div>
          <div class="summary"><b>${op.minutos} min</b><span>${soles(op.precio)} · ${op.lineas.map((l) => `<span style="display:flex;align-items:center;gap:4px">${lineBadge(l, 'sm')}${esc(l.nombre)}</span>`).join(' + ')}</span></div>
          <div class="sheet__steps">${pasos.map((p, i) => `
            <div class="step"><div class="step__rail">
              ${p.linea ? `<span class="step__icon" style="${lineVars(p.linea)};background:var(--line);color:#fff">${ic(p.icono)}</span>` : `<span class="step__icon">${ic(p.icono)}</span>`}
              ${i < pasos.length - 1 ? `<span class="step__line" ${p.linea ? `style="background:${p.linea.color}"` : ''}></span>` : ''}
            </div><div class="step__text"><b>${esc(p.titulo)}</b>${p.detalle ? `<span>${esc(p.detalle)}</span>` : ''}</div></div>`).join('')}</div>
          <div class="sheet__cta"><button class="btn btn--primary btn--lg btn--block" data-action="iniciar">${ic('player-play')}${t('Iniciar modo viaje')}</button></div>
        </div>
      </div>`;
  },

  mount(root, params) {
    const op = buscar(params);
    if (!op) return null;
    const mapa = createMap(root.querySelector('#map'));
    const o = getPunto(params.o), d = getPunto(params.d);
    if (!o || !d) return null;

    LINEAS.forEach((l) => mapa.line(l, { weight: 3, opacity: 0.3, withCasing: false }));
    let pts = [o.c, d.c];
    op.tramos.forEach((tr) => {
      const l = LINEAS.find((x) => x.id === tr.lineaId);
      pts = pts.concat(mapa.segment(l, tr.desde, tr.hasta));
    });

    mapa.pin(o.c, 'origin', t('Origen'));
    mapa.pin(d.c, 'dest', t('Destino'));

    const primero = op.tramos[0], ultimo = op.tramos[op.tramos.length - 1];
    // A pie: del origen al punto donde se sube, y del punto donde se baja al destino (por calles reales si hay internet)
    rutaCaminata(o.c, primero.sube.c).then((camino) => { for (let i = 0; i < camino.length - 1; i++) mapa.dashed(camino[i], camino[i + 1]); });
    rutaCaminata(ultimo.baja.c, d.c).then((camino) => { for (let i = 0; i < camino.length - 1; i++) mapa.dashed(camino[i], camino[i + 1]); });
    // Transbordo: se baja de una micro y se camina hasta la otra
    for (let i = 0; i < op.tramos.length - 1; i++) mapa.dashed(op.tramos[i].baja.c, op.tramos[i + 1].sube.c);
    // Puntos donde se sube y se baja
    op.tramos.forEach((tr) => { mapa.pin(tr.sube.c, 'stop'); mapa.pin(tr.baja.c, 'stop'); });

    mapa.fit(pts, { top: 90, bottom: root.querySelector('.sheet').offsetHeight + 20 });
    return () => mapa.destroy();
  },

  actions: {
    iniciar(_el, _p, api, _ev, pantalla) {
      const op = buscar(pantalla);
      if (!op) return;
      agregarHistorial({ o: pantalla.o, d: pantalla.d, lineaId: op.lineas[0].id });
      iniciarOpcion(op);
      api.go('trip');
    },
  },
};
