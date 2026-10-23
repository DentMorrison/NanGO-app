// MODO VIAJE 
import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { createMap } from '../components/map.js';
import { toggle } from '../components/ui.js';
import { getLinea } from '../data/lineas.js';
import { estado, marcarPasado, retroceder, cambiarDeMicro, terminar } from '../services/trip.service.js';
import { abrirReporte } from './alerts.js';

const redondear = (m) => (m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50);

export default {
  name: 'trip',

  render(_p, api) {
    const e = estado();
    if (!e) { queueMicrotask(() => api.goTab('home')); return ''; }
    if (e.llego) { queueMicrotask(() => api.replace('trip-end')); return ''; }
    const { linea, paraderos, siguiente, faltan, avisoBajada, bajarIndex, t: viaje } = e;
    const bajar = paraderos[bajarIndex];
    const cambio = e.finTramo && e.siguienteTramo;
    const subtitulo = e.totalTramos > 1 ? t('Tramo {n} de {m} · marcas tú los paraderos', { n: e.numTramo, m: e.totalTramos }) : t('Marcas tú los paraderos · sin GPS');

    let tarjeta;
    if (cambio) {
      const s = e.siguienteTramo;
      tarjeta = `<div class="trip-alert"><small>${t('Transbordo')}</small><h2>${t('Toma la {linea}', { linea: esc(s.linea.nombre) })}</h2>
        <p>${ic('walk')}${s.caminata >= 40 ? t('Camina {m} m hacia {lugar}', { m: redondear(s.caminata), lugar: esc(s.sube.nombre) }) : t('Sube en {lugar}', { lugar: esc(s.sube.nombre) })}</p></div>`;
    } else if (avisoBajada) {
      tarjeta = `<div class="trip-alert"><small>${t('¡Prepárate para bajar!')}</small><h2>${esc(bajar.nombre)}</h2><p>${ic('eye')}${esc(bajar.ref)} · ${t('en {n} paraderos', { n: faltan })}</p></div>
        <div class="alarm-row">${ic('bell-ringing')}<div class="grow"><b style="font-size:.9375rem">${t('Te avisaremos con vibración')}</b><div class="item__sub">${t('Cuando falte 1 paradero')}</div></div>${toggle(true, 'data-action="alarma"')}</div>`;
    } else {
      tarjeta = `<div class="trip-next"><small>${t('Próximo paradero')}</small><h2>${esc(siguiente.nombre)}</h2><p>${ic('eye')}${t('Referencia:')} ${esc(siguiente.ref.toLowerCase())}</p>
        <div class="trip-next__chips"><span>${ic('flag')}${t('Faltan {n}', { n: faltan })}</span><span>${ic('bell-ringing')}${t('Aviso a 2')}</span></div></div>`;
    }

    return `
      <header class="appbar"><div class="appbar__row">
        <button class="appbar__lang" data-action="cerrar" aria-label="${t('Terminar viaje')}" style="width:44px;padding:0">${ic('x')}</button>
        <div class="grow" style="padding-left:6px"><div style="font-weight:700;font-size:1.0625rem">${t('Viaje en {linea}', { linea: esc(linea.nombre) })}</div>
        <div style="font-size:.75rem;opacity:.8">${subtitulo}</div></div></div></header><div class="stripe"></div>
      <div class="map map--strip" id="map"></div>
      ${tarjeta}
      <div class="stops">
        ${paraderos.slice(Math.max(0, viaje.index - 3), bajarIndex + 1).map((p) => {
          const i = paraderos.indexOf(p), estadoP = i < viaje.index ? 'is-past' : i === viaje.index ? 'is-now' : '';
          return `<div class="stop ${estadoP}"><span class="stop__dot">${i < viaje.index ? ic('check') : ''}</span><span class="stop__name">${esc(p.nombre)}${i === viaje.index && !cambio ? `<span class="stop__ref">${i === 0 ? t('Aquí subes') : t('Aquí sigues')}</span>` : ''}${i === bajarIndex ? `<span class="stop__ref">${t('Aquí bajas')}</span>` : ''}</span></div>`;
        }).join('')}
      </div>
      <div class="trip-actions">
        ${cambio
          ? `<button class="btn btn--primary btn--lg btn--block" data-action="cambiar">${ic('arrows-exchange')}${t('Ya subí a la {linea}', { linea: esc(e.siguienteTramo.linea.nombre) })}</button>`
          : `<button class="btn btn--primary btn--lg btn--block" data-action="pase">${ic('player-skip-forward')}${t('Ya pasé este paradero')}</button>`}
        <div style="display:flex;gap:8px"><button class="btn btn--outline btn--sm" style="flex:1" data-action="atras">${ic('arrow-back-up')}${t('Retroceder')}</button><button class="btn btn--outline btn--sm" style="flex:1" data-action="avisar">${ic('bell-ringing')}${t('Avisar')}</button></div>
      </div>`;
  },

  mount(root) {
    const e = estado();
    if (!e || !root.querySelector('#map')) return null;
    const mapa = createMap(root.querySelector('#map'));
    // Solo el trozo del recorrido que se va a hacer en cada micro; el tramo actual resaltado
    e.t.legs.forEach((g, k) => {
      const l = getLinea(g.lineaId);
      const [a, b] = g.desde <= g.hasta ? [g.desde, g.hasta] : [g.hasta, g.desde];
      mapa.line(l, { weight: k === e.t.leg ? 6 : 4, opacity: k === e.t.leg ? 1 : 0.4, points: l.ida.slice(a, b + 1) });
    });
    e.paraderos.forEach((p, i) => mapa.pin(p.c, i === e.t.index ? 'now' : 'stop'));
    mapa.fit(e.paraderos.map((p) => p.c), { top: 16, bottom: 16 });
    return () => mapa.destroy();
  },

  actions: {
    pase(_el, _p, api) {
      marcarPasado();
      const e = estado();
      if (e && e.faltan === 1) navigator.vibrate?.([200, 100, 200]);
      api.rerender();
    },
    cambiar(_el, _p, api) { cambiarDeMicro(); api.rerender(); },
    atras(_el, _p, api) { retroceder(); api.rerender(); },
    avisar(_el, _p, api) { abrirReporte(api, { lineaId: estado()?.linea.id, tipo: 'trafico' }); },
    alarma(_el, _p, api) { api.toast(t('Aviso activado')); },
    cerrar(_el, _p, api) {
      api.openModal(`<h3>${t('¿Terminar el viaje?')}</h3><p>${t('Dejarás de ver los paraderos de esta línea.')}</p>
        <div class="dialog__actions"><button class="btn btn--outline" data-close>${t('Seguir viajando')}</button><button class="btn btn--danger" data-action="ok">${t('Terminar')}</button></div>`,
        { type: 'dialog', actions: { ok: (_e, _ev, close) => { close(); terminar(); api.goTab('home'); } } });
    },
  },
};
