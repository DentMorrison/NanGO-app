// LLEGASTE
import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { appbar, item } from '../components/ui.js';
import { soles, getLinea } from '../data/lineas.js';
import { estado, terminar } from '../services/trip.service.js';
import { abrirReporte } from './alerts.js';

let calificacion = null;

export default {
  name: 'trip-end',
  render(_p, api) {
    const e = estado();
    if (!e) { queueMicrotask(() => api.goTab('home')); return ''; }
    const minutos = Math.max(1, Math.round((Date.now() - e.t.startedAt) / 60000));
    return `${appbar()}
      <div class="scroll scroll--no-tabbar">
        <div class="finish"><div class="finish__icon">${ic('flag-check')}</div><h3>${t('¡Llegaste!')}</h3><p>${t('Viaje en {linea}', { linea: e.t.legs.map((g) => esc(getLinea(g.lineaId).nombre)).join(' + ') })} · ${esc(e.paraderos[e.bajarIndex].nombre)}</p></div>
        <div class="summary-card"><div><span>${t('Duración')}</span><b>${minutos} min</b></div><div><span>${t('Paraderos')}</span><b>${e.paraderosRecorridos}</b></div><div><span>${t('Tarifa')}</span><b>${soles(e.t.legs.reduce((s, g) => s + getLinea(g.lineaId).tarifa.adulto, 0))}</b></div></div>
        <div style="text-align:center;font-size:.9375rem;font-weight:700;margin-top:18px">${t('¿Cómo estuvo el viaje?')}</div>
        <div class="rating">${[['mood-sad', 1], ['mood-neutral', 2], ['mood-smile', 3]].map(([i, n]) => `<button class="${calificacion === n ? 'is-active' : ''}" data-action="calificar" data-params='{"n":${n}}' aria-label="${n}">${ic(i)}</button>`).join('')}</div>
        <div class="group mt-16">
          ${item({ icon: 'traffic-lights', title: t('Reportar tráfico pesado'), sub: t('Ayuda a otros a decidir'), attrs: 'data-action="trafico"' })}
          ${item({ icon: 'heart', title: t('Guardar como viaje frecuente'), attrs: 'data-action="guardar"' })}
        </div>
        <div style="padding:20px 14px"><button class="btn btn--primary btn--lg btn--block" data-action="listo">${t('Listo')}</button></div>
      </div>`;
  },
  actions: {
    calificar(_el, { n }, api) { calificacion = n; api.rerender(); },
    trafico(_el, _p, api) { abrirReporte(api, { lineaId: estado()?.linea.id, tipo: 'trafico' }); },
    guardar(_el, _p, api) { api.toast(t('Guardado en tus favoritos')); },
    
    // Guarda el viaje con su calificación
    listo(_el, _p, api) { 
        terminar(calificacion); // Llama a la lógica que creamos arriba
        calificacion = null; 
        api.toast(t('¡Viaje registrado con éxito!'));
        api.goTab('home'); 
    },
  },
};
