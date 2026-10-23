// INICIO: saludo, buscador, atajos, lugares conocidos de Juliaca 
import { store } from '../core/store.js';
import { t, langCode } from '../core/i18n.js';
import { esc, ic, go, pr } from '../core/dom.js';
import { lineBadge, lineVars } from '../components/ui.js';
import { openModal } from '../components/overlay.js';
import { elegirEnMapa } from '../components/mapa-picker.js';
import { LINEAS, soles } from '../data/lineas.js';
import { REFERENCIAS } from '../data/referencias.js';
import { saludoDelDia } from '../services/clock.js';
import { animarSaludo } from '../components/saludo-anim.js';
import { proximoMin } from '../services/eta.service.js';
import { estado as estadoPunta } from '../services/rush.service.js';
import { getLugar, getPunto, iconoDe, listar as buscarCatalogo } from '../services/places.service.js';
import { ICONOS_LUGAR, agregarLugar, actualizarLugar, eliminarLugar, getLugarGuardado } from '../services/lugares.service.js';
import { clasificarLineas } from '../services/lines.service.js';
import { listar as listarAvisos, tipoDe } from '../services/alerts.service.js';
import { buscarOpciones } from '../services/routing.service.js';
import { estado as estadoViaje } from '../services/trip.service.js';

const referencias = () => REFERENCIAS.map((r) => ({ ...r, lugar: getLugar(r.n) })).filter((r) => r.lugar);
const textoLineas = (n) => (n === 1 ? t('1 línea') : t('{n} líneas', { n }));
const aPie = (km) => Math.max(1, Math.round(((km * 1.25) / 4.8) * 60));       // minutos caminando (con rodeo de calles)
const metros = (km) => `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;

// Texto corto bajo el nombre de cada tarjeta: cuántas líneas pasan a ≤ 250 m (o, si no hay, la más cercana)
function resumenLineas(c) {
  if (c.pasan.length) return textoLineas(c.pasan.length);
  if (c.cercanas.length) return t('Línea a {m}', { m: metros(c.cercanas[0].d) });
  return c.masCercana ? t('Línea a {m}', { m: metros(c.masCercana.d) }) : t('Sin líneas cerca');
}

/** Foto del lugar; si el archivo no existe se queda el fondo con el ícono de su categoría. */
const foto = (r) => `<span class="place-photo__icon">${ic(iconoDe(r.lugar))}</span><img class="place-photo__img" src="${r.foto}" alt="" loading="lazy" onerror="this.remove()">`;

export default {
  name: 'home',
  tab: 'home',

  render() {
    const s = store.get();
    const punta = estadoPunta();
    const viaje = estadoViaje();
    const offline = !navigator.onLine;
    // Most recent alerts (show up to 3)
    const avisos = listarAvisos({ soloMisLineas: true }).sort((a,b) => (b.ts||Date.parse(b.hace||0)||0)-(a.ts||Date.parse(a.hace||0)||0));
    const rutina = rutinaDe(s);
    const conCuenta = !!s.user;
    const lugares = s.shortcuts;                     // lugares guardados por la persona

    // Tres estados de "Mis lugares": sin cuenta (no aparece) · cuenta sin lugares (solo "+") · con lugares.
    const misLugares = !conCuenta
      ? `<button class="signin-nudge" data-go="auth">${ic('login')}${t('Inicia sesión para guardar lugares')}</button>`
      : `<div class="section-title"><h3>${t('Mis lugares')}</h3>
          ${lugares.length ? `<span class="tag-pill">${ic('heart')}${lugares.length}</span>` : ''}</div>
        <p class="home-hint">${lugares.length ? t('Toca un lugar para ir allí. Con el lápiz lo editas o eliminas.') : t('Guarda tu casa, el gym o cualquier lugar para ir de un toque.')}</p>
        <div class="saved-rail">
          ${lugares.map((a) => `<div class="saved">
              <button class="saved__go" data-action="irLugar" ${pr({ n: a.place })}>
                <span class="saved__icon">${ic(a.icon || 'map-pin')}</span>
                <span class="saved__txt"><span class="saved__label">${esc(a.label)}</span><span class="saved__place">${esc(a.place)}</span></span>
              </button>
              <button class="saved__edit" data-action="editarLugar" ${pr({ id: a.id })} aria-label="${t('Editar')}">${ic('pencil')}</button>
            </div>`).join('')}
          <button class="saved saved--add" data-action="agregarLugar">${ic('plus')}<span>${t('Agregar lugar')}</span></button>
        </div>`;

    const tarjetas = referencias().map((r) => {
      const resumen = resumenLineas(clasificarLineas(r.lugar.c));
      return `<button class="place-card" data-action="lugar" ${pr({ n: r.n })} aria-label="${esc(r.corto)}, ${resumen}">
        <span class="place-photo">${foto(r)}</span>
        <span class="place-card__text"><b>${esc(r.corto)}</b><small>${resumen}</small></span>
      </button>`;
    }).join('');

    const cuerpo = `
      ${offline ? `<div class="strip">${ic('wifi-off')}${t('Sin internet · usando tus rutas guardadas')}</div>` : ''}
      ${misLugares}
      <div class="section-title" style="padding-top:12px"><h3>${t('Lugares conocidos')}</h3>
        ${punta.activa && !offline ? `<button class="tag-pill" data-go="rush-hour" data-params='{"id":"${LINEAS[0].id}"}'>${ic('traffic-lights')}${t('Hora punta')}</button>` : ''}
      </div>
      <p class="home-hint">${t('Toca un lugar para ver qué micros pasan por ahí.')}</p>
      <div class="place-rail">${tarjetas}</div>
      ${offline ? `<div class="est" style="padding:10px 20px 0">${ic('circle-check')}${t('Los tiempos se calculan en tu teléfono, sin internet.')}</div>`
        : avisos[0] ? `<div style="padding:0 16px;margin-top:12px"><div class="hint" style="padding:0 4px 6px">${t('Avisos más recientes')}</div>${avisos.slice(0,3).map(a => `<button class="notice" style="width:100%;text-align:left;margin-bottom:8px" ${go('alert-detail', { id: a.id })}>${ic(tipoDe(a.tipo).icono)}<div><b>${esc(a.titulo)}</b>${esc(a.texto || '')}</div></button>`).join('')}</div>` : ''}
      ${rutina ? `
        <div class="section-title" style="padding-top:12px"><h3>${t('Tu viaje de siempre')}</h3></div>
        <button class="routine" data-action="rutina" ${pr({ o: rutina.o, d: rutina.d })}>
          ${lineBadge(rutina.linea, 'md')}
          <div class="grow"><b style="font-size:1rem">${esc(rutina.o)} → ${esc(rutina.d)}</b><div class="item__sub">${esc(rutina.linea.nombre)} · ~${rutina.min} min · ${soles(rutina.linea.tarifa.adulto)}</div></div>
          <span class="routine__go">${ic('arrow-right')}</span>
        </button>` : ''}`;

    return `
      <header class="hero">
        <div class="appbar__row">
          <img class="appbar__logo" src="assets/img/brand/wordmark.png" alt="ÑanGO"><span class="appbar__spacer"></span>
          <button class="appbar__lang" data-go="language" aria-label="${t('Idioma')}">${ic('language')}${langCode()}</button>
        </div>
        <div class="hero__stage" id="stage">
          <h1 class="hero__saludo">${t(saludoDelDia())}</h1>
          <div class="vanrig" aria-hidden="true">
            <img class="vanrig__body" src="assets/img/carga/combi/combi-4.png" alt="">
            <span class="vanrig__wheel vanrig__wheel--r"></span><span class="vanrig__wheel vanrig__wheel--f"></span>
          </div>
        </div>
        <button class="search-box" data-go="search" data-params='{"focus":"dest"}'><span>${t('¿A dónde vas hoy?')}</span><i class="search-box__btn ti ti-search" aria-hidden="true"></i></button>
      </header>
      <div class="stripe"></div>
      <div class="scroll">${cuerpo}</div>
      ${viaje ? `<button class="resume-bar" data-go="trip"><span class="line-badge line-badge--md" style="${lineVars(viaje.linea)}">${viaje.linea.numero}</span><div class="grow"><b>${t('Viaje en {linea}', { linea: esc(viaje.linea.nombre) })}</b><span class="sub">${esc(viaje.siguiente.nombre)} · ${t('faltan')} ${viaje.faltan}</span></div><span class="resume-bar__go">${t('Seguir')}</span></button>` : ''}`;
  },

  mount(root) {
    animarSaludo(root.querySelector('#stage'));   // la combi entra y trae el saludo (una vez por sesión)
    return null;
  },

  actions: {
    rutina(_el, { o, d }, api) { store.set({ origin: o, destination: d }); api.go('search', { focus: null }); },

    /** Tocar un lugar guardado: lo pone como destino y abre la ruta. */
    irLugar(_el, { n }, api) { store.set({ destination: n }); api.go('search', { focus: store.get().origin ? null : 'origin' }); },

    /** "+" o lápiz: hoja para agregar/editar un lugar (nombre libre, ícono y ubicación). */
    agregarLugar(_el, _p, api) { abrirHojaLugar(api, null); },
    editarLugar(_el, { id }, api) { abrirHojaLugar(api, id); },

    /** Ventana con las líneas que pasan por el lugar tocado. */
    lugar(_el, { n }, api) {
      const r = referencias().find((x) => x.n === n);
      if (!r) return;
      const c = clasificarLineas(r.lugar.c);
      const fila = ({ linea: l, d }, { mejor = false, lejos = false } = {}) => {
        const min = proximoMin(l);
        const dato = lejos
          ? `${t('A {m}', { m: metros(d) })} · ${t('unos {n} min a pie', { n: aPie(d) })}`
          : `${t('A {m}', { m: metros(d) })}${min !== null ? ` · ${t('próximo en')} ~${min} min` : ''}`;
        return `<button class="place-line ${lejos ? 'is-far' : ''}" data-action="linea" ${pr({ id: l.id })}>${lineBadge(l)}
          <span class="place-line__body"><b>${esc(l.nombre)}${mejor ? `<i class="place-line__best">${t('La más cercana')}</i>` : ''}</b><small>${dato}</small></span>
          ${ic('chevron-right', 'item__chevron')}</button>`;
      };
      let cuerpo = '';
      if (c.pasan.length) {
        cuerpo += `<h4 class="place-sheet__h">${t('Pasan por aquí')}</h4><div class="place-lines">${c.pasan.map((x, i) => fila(x, { mejor: i === 0 })).join('')}</div>`;
      }
      if (c.cercanas.length) {
        cuerpo += `<h4 class="place-sheet__h">${t('Un poco más lejos')}</h4>
          <p class="place-sheet__note">${ic('walk')}${c.pasan.length ? t('Pasan a más de 250 m: caminas más o te conviene combinar con otra micro.') : t('Ninguna pasa a menos de 250 m. Estas pasan cerca: tendrás que caminar un poco.')}</p>
          <div class="place-lines">${c.cercanas.map((x) => fila(x, { lejos: true })).join('')}</div>`;
      }
      if (!c.pasan.length && !c.cercanas.length) {
        cuerpo += `<p class="place-sheet__note place-sheet__note--warn">${ic('info-circle')}${c.masCercana ? t('Ninguna línea pasa a menos de 400 m. La más cercana es la {l}, a {m}: hay que caminar bastante o hacer otro recorrido.', { l: esc(c.masCercana.linea.nombre), m: metros(c.masCercana.d) }) : t('Ninguna línea registrada pasa cerca de este lugar.')}</p>
          ${c.masCercana ? `<div class="place-lines">${fila(c.masCercana, { lejos: true })}</div>` : ''}`;
      }
      api.openModal(`
        <div class="place-sheet">
          <div class="place-sheet__head" data-grab>
            <span class="place-sheet__photo place-photo">${foto(r)}</span>
            <div class="place-sheet__info">
              <span class="place-sheet__cat">${ic(iconoDe(r.lugar))}${t(r.lugar.t)}</span>
              <h3>${esc(r.corto)}</h3>
              <p class="place-sheet__desc">${esc(r.descripcion || '')}</p>
            </div>
          </div>
          <div class="place-sheet__body">${cuerpo}</div>
          <div class="place-sheet__cta">
            <button class="btn btn--outline btn--lg" data-action="desde">${ic('map-pin')}${t('Salir de aquí')}</button>
            <button class="btn btn--primary btn--lg" data-action="hasta">${ic('flag')}${t('Ir aquí')}</button>
          </div>
        </div>`, {
        actions: {
          linea(el, _ev, cerrar) { cerrar(); api.go('line-detail', { id: JSON.parse(el.dataset.params).id }); },
          desde(_el, _ev, cerrar) { store.set({ origin: r.n }); cerrar(); api.go('search', { focus: store.get().destination ? null : 'dest' }); },
          hasta(_el, _ev, cerrar) { store.set({ destination: r.n }); cerrar(); api.go('search', { focus: store.get().origin ? null : 'origin' }); },
        },
      });
    },
  },
};

/** Último viaje realizado de verdad (con fecha). Sin viajes, no hay "viaje de siempre". */
function rutinaDe(s) {
  const h = s.history.find((x) => x.ts);
  if (!h) return null;
  const op = buscarOpciones(h.o, h.d)[0];
  return op ? { o: h.o, d: h.d, linea: op.lineas[0], min: op.esperaMin } : null;
}

/** Hoja inferior para agregar o editar un lugar guardado: nombre libre + ícono + ubicación (catálogo o mapa). */
function abrirHojaLugar(api, id) {
  const existente = id ? getLugarGuardado(id) : null;
  const d = { nombre: existente?.label || '', icon: existente?.icon || 'home-2', place: existente?.place || null };

  const leer = () => {
    const n = document.getElementById('lugarNombre');
    const dir = document.getElementById('lugarDir');
    if (n) d.nombre = n.value;
    if (dir) d.place = dir.value.trim() || d.place;
  };
  const hoja = () => document.querySelector('.modal-sheet');
  const repintar = () => { const h = hoja(); if (h) h.innerHTML = `<div class="sheet__handle"></div>${pintar()}`; };

  const pintar = () => `
    <h3>${existente ? t('Editar lugar') : t('Agregar lugar')}</h3>
    <p class="muted" style="font-size:.8125rem;padding-bottom:6px">${t('Ponle un nombre y elige dónde está.')}</p>
    <div class="field-label">${t('Nombre')}</div>
    <input class="field__input" id="lugarNombre" placeholder="${t('Ej.: Casa de mi abuela, Gym, Mi lugar secreto')}" value="${esc(d.nombre)}">
    <div class="field-label">${t('Ícono (opcional)')}</div>
    <div class="option-chips">${ICONOS_LUGAR.map((x) => `<button class="chip ${d.icon === x.icon ? 'is-active' : ''}" data-action="icono" ${pr({ icon: x.icon })}>${ic(x.icon)}${t(x.label)}</button>`).join('')}</div>
    <div class="field-label">${t('Ubicación')}</div>
    <input class="field__input" id="lugarDir" placeholder="${t('Busca un lugar o márcalo en el mapa')}" value="${esc(d.place || '')}" autocomplete="off">
    <div id="lugarSug"></div>
    <button class="btn btn--outline btn--block mt-8" data-action="toggleMapa">${ic('map-pin')}${t('Marcar en el mapa')}</button>
    <button class="btn btn--primary btn--block btn--lg mt-16" data-action="guardar">${ic('check')}${t('Guardar lugar')}</button>
    ${existente ? `<button class="btn btn--outline btn--block mt-8" data-action="eliminar" style="color:#C0392B;margin-bottom:8px">${ic('trash')}${t('Eliminar lugar')}</button>` : ''}`;

  const pintarSug = (q) => {
    const box = document.getElementById('lugarSug');
    if (!box) return;
    if (!q || q.trim().length < 2) { box.innerHTML = ''; return; }
    const res = buscarCatalogo({ q }).slice(0, 5);
    box.innerHTML = res.length
      ? `<div class="group" style="margin-top:8px">${res.map((l) => `<button class="item" data-action="elegirSug" ${pr({ n: l.n })}>${ic(iconoDe(l), 'item__icon')}<div class="item__body"><div class="item__title">${esc(l.n)}</div><div class="item__sub">${t(l.t)}</div></div></button>`).join('')}</div>`
      : '';
  };

  const cerrar = openModal(pintar(), {
    onMount(root) {
      const dir = root.querySelector('#lugarDir');
      dir?.addEventListener('input', () => pintarSug(dir.value));
    },
    actions: {
      icono(el) { leer(); d.icon = JSON.parse(el.dataset.params).icon; repintar(); },
      elegirSug(el) {
        const n = JSON.parse(el.dataset.params).n;
        d.place = n;
        const dir = document.getElementById('lugarDir'); if (dir) dir.value = n;
        const box = document.getElementById('lugarSug'); if (box) box.innerHTML = '';
      },
      /** Pantalla completa con el pin fijo en el centro: al confirmar queda la dirección en el campo. */
      async toggleMapa() {
        leer();
        const p = getPunto(d.place);
        const r = await elegirEnMapa({ tipo: 'destination', centro: Array.isArray(p?.c) ? p.c : null });
        if (!r) return;                     // canceló
        const xy = `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;
        const viendo = t('Buscando dirección…');
        d.place = r.nombre && r.nombre !== viendo ? `${r.nombre} (${xy})` : xy;
        const dir = document.getElementById('lugarDir'); if (dir) dir.value = d.place;
        const box = document.getElementById('lugarSug'); if (box) box.innerHTML = '';
      },
      guardar() {
        leer();
        if (!d.nombre.trim()) { api.toast(t('Ponle un nombre al lugar.')); return; }
        if (!d.place) { api.toast(t('Elige la ubicación: búscala o márcala en el mapa.')); return; }
        if (existente) { actualizarLugar(existente.id, { nombre: d.nombre, icon: d.icon, place: d.place }); api.toast(t('Lugar actualizado')); }
        else { agregarLugar({ nombre: d.nombre, icon: d.icon, place: d.place }); api.toast(t('Lugar guardado')); }
        cerrar();
        api.rerender();
      },
      eliminar() {
        eliminarLugar(existente.id);
        api.toast(t('Lugar eliminado'));
        cerrar();
        api.rerender();
      },
    },
  });
  return cerrar;
}
