// AVISOS de la comunidad: lista con filtros, votar "Sigue así / Ya no" y reportar uno nuevo.
// Regla: un aviso se publica cuando otra persona reporta lo mismo o parecido, o cuando el equipo lo aprueba.
import { store } from '../core/store.js';
import { t } from '../core/i18n.js';
import { esc, ic, go, pr } from '../core/dom.js';
import { appbar, lineDot } from '../components/ui.js';
import { openModal } from '../components/overlay.js';
import { LINEAS, getLinea } from '../data/lineas.js';
import { TIPOS_AVISO } from '../data/avisos.js';
import { listar, tipoDe, votar, votoDe, reportar, marcarLeidos, puedeAportar, puedeReportar, LIMITE_AVISOS_HORA } from '../services/alerts.service.js';
import { renderTabbar } from '../components/tabbar.js';

let ui = { alcance: 'mias', tipo: null };

export const avisoHtml = (a, { acciones = true } = {}) => {
  const tp = tipoDe(a.tipo), l = getLinea(a.lineaId), voto = votoDe(a.id);
  return `<div class="alert">
    <span class="alert__icon is-${tp.clase}">${ic(tp.icono)}</span>
    <div class="alert__body">
      <button class="alert__title" style="text-align:left;display:block" ${go('alert-detail', { id: a.id })}>${esc(a.titulo)}</button>
      <div class="alert__meta">${lineDot(l)}${esc(l.nombre)} · ${esc(a.hace)}</div>
      ${a.texto ? `<p class="alert__text">${esc(a.texto)}</p>` : ''}
      ${acciones ? `<div class="alert__actions">
        <button class="vote-btn ${voto === 'yes' ? 'is-voted' : ''}" data-action="votar" ${pr({ id: a.id, v: 'yes' })}>${ic('thumb-up')}${t('Sigue así')} · ${a.confirmaciones}</button>
        <button class="vote-btn ${voto === 'no' ? 'is-voted' : ''}" data-action="votar" ${pr({ id: a.id, v: 'no' })}>${ic('thumb-down')}${t('Ya no')}</button></div>` : ''}
    </div></div>`;
};

/** Hoja para reportar un aviso (también se abre desde el modo viaje). */
export function abrirReporte(api, { lineaId = null, tipo = null } = {}) {
  if (!puedeAportar()) { api.toast(t('Crea una cuenta para reportar y votar avisos.')); return; }
  let sel = { tipo, lineaId: lineaId || store.get().favoriteLines[0] || LINEAS[0].id, donde: '', nota: '' };
  const pintar = () => `
    <h3>${t('Reportar un aviso')}</h3><div class="muted" style="font-size:.8125rem;padding-bottom:6px">${t('Ayudas a otros pasajeros a decidir mejor')}</div>
    <div class="field-label">${t('¿Qué pasa?')}</div>
    <div class="option-chips">${TIPOS_AVISO.map((x) => `<button class="chip ${sel.tipo === x.id ? 'is-active' : ''}" data-action="tipo" ${pr({ id: x.id })}>${ic(x.icono)}${t(x.nombre)}</button>`).join('')}</div>
    <div class="field-label">${t('¿En qué línea?')}</div>
    <div class="option-chips">${LINEAS.map((l) => `<button class="chip ${sel.lineaId === l.id ? 'is-active' : ''}" data-action="linea" ${pr({ id: l.id })}>${lineDot(l)}${esc(l.nombre)}</button>`).join('')}</div>
    <div class="field-label">${t('Lugar/Paradero')} <small>(${t('opcional')})</small></div>
    <input class="field__input select-like" id="donde" placeholder="${t('Ej.: Av. Circunvalación Este / Paradero X')}" value="${esc(sel.donde)}">
    <textarea class="textarea" id="nota" placeholder="${t('Nota (opcional): detalles adicionales...')}">${esc(sel.nota)}</textarea>
    <button class="btn btn--primary btn--block btn--lg mt-16" data-action="enviar">${t('Enviar aviso')}</button>`;
  const cerrar = openModal(pintar(), {
    actions: {
      tipo: (el) => { leer(); sel.tipo = JSON.parse(el.dataset.params).id; repintar(); },
      linea: (el) => { leer(); sel.lineaId = JSON.parse(el.dataset.params).id; repintar(); },
      enviar: (_el, _ev, close) => {
        leer();
        if (!sel.tipo) { api.toast(t('Elige qué pasa.')); return; }
        const lim = puedeReportar();
        if (!lim.ok) { api.toast(t('Llegaste al límite de {n} avisos por hora. Intenta en {min} min.', { n: LIMITE_AVISOS_HORA, min: lim.esperaMin })); return; }
        reportar(sel);
        const hoja = document.querySelector('.modal-sheet');
        hoja.innerHTML = `<div class="sent"><div class="sent__icon">${ic('check')}</div><h3>${t('¡Gracias por avisar!')}</h3>
          <p>${t('Tu aviso de {tipo} se publicará cuando otra persona reporte lo mismo, o cuando lo revisemos nosotros.', { tipo: `<b>${esc(t(tipoDe(sel.tipo).nombre).toLowerCase())}</b>` })}</p>
          <button class="btn btn--primary btn--block btn--lg mt-16" data-close>${t('Listo')}</button></div>`;
      },
    },
  });
  const leer = () => { const d = document.getElementById('donde'), n = document.getElementById('nota'); if (d) sel.donde = d.value; if (n) sel.nota = n.value; };
  const repintar = () => { const hoja = document.querySelector('.modal-sheet'); hoja.innerHTML = `<div class="sheet__handle"></div>${pintar()}`; };
  return cerrar;
}

export default {
  name: 'alerts',
  tab: 'alerts',

  render() {
    marcarLeidos();
    const avisos = listar({ soloMisLineas: ui.alcance === 'mias', tipo: ui.tipo });
    const chip = (texto, activo, params) => `<button class="chip ${activo ? 'is-active' : ''}" data-action="filtro" ${pr(params)}>${t(texto)}</button>`;
    return `${appbar()}
      <div class="scroll">
        <div class="page-title"><h2>${t('Avisos')}</h2><p>${t('Reportados por pasajeros')}</p></div>
        <div class="chip-row">
          ${chip('Mis líneas', ui.alcance === 'mias' && !ui.tipo, { alcance: 'mias', tipo: null })}${chip('Todos', ui.alcance === 'todos' && !ui.tipo, { alcance: 'todos', tipo: null })}
          ${chip('Tráfico', ui.tipo === 'trafico', { alcance: 'todos', tipo: 'trafico' })}${chip('Desvíos', ui.tipo === 'desvio', { alcance: 'todos', tipo: 'desvio' })}
        </div>
        ${avisos.length ? `<div class="group">${avisos.map((a) => avisoHtml(a)).join('')}</div>`
          : `<div class="empty"><div class="empty__icon">${ic('circle-check')}</div><h3>${t('Todo tranquilo')}</h3><p>${t('No hay avisos para tus líneas en este momento.')}</p><button class="link-btn" data-action="filtro" data-params='{"alcance":"todos","tipo":null}'>${t('Ver avisos de toda la ciudad')}</button></div>`}
      </div>
      <button class="fab" data-action="reportar">${ic('plus')}${t('Reportar')}</button>`;
  },

  mount() { setTimeout(() => renderTabbar('alerts'), 0); },

  actions: {
    filtro(_el, p, api) { ui = { ...ui, ...p }; api.rerender(); },
    votar(_el, { id, v }, api) {
      if (!puedeAportar()) { api.toast(t('Crea una cuenta para reportar y votar avisos.')); return; }
      votar(id, v); api.rerender();
    },
    reportar(_el, _p, api) { abrirReporte(api); },
  },
};
