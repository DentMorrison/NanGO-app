// ================================================================
// BUSCAR
// ================================================================
import { store } from '../core/store.js';
import { t } from '../core/i18n.js';
import { esc, ic, norm, go, pr, $ } from '../core/dom.js';
import { appbar, lineBadge, lineDot } from '../components/ui.js';
import { createMap } from '../components/map.js';
import { elegirEnMapa } from '../components/mapa-picker.js';
import { LINEAS, soles } from '../data/lineas.js';
import { listar, FILTROS, contar, total, iconoDe, lineasDe, getPunto } from '../services/places.service.js';
import { buscarOpciones, ordenar } from '../services/routing.service.js';
import { estado as estadoPunta, horaTexto } from '../services/rush.service.js';

const POR_PAGINA = 40;
let ui = {};

const campoHtml = (tipo, valor, enfoque) => {
  const placeholder = tipo === 'origin' ? t('¿Desde dónde sales?') : t('¿A dónde vas?');
  const swap = tipo === 'dest' && store.get().origin && store.get().destination ? `<button class="route-field__action" data-action="swap" aria-label="${t('Intercambiar origen y destino')}">${ic('arrows-up-down')}</button>` : '';
  if (enfoque === tipo) {
    return `<label class="route-field route-field--${tipo} is-focus"><i class="route-field__dot"></i><input data-field="${tipo}" value="${esc(ui.q)}" placeholder="${placeholder}" autocomplete="off" data-autofocus><button class="route-field__action" data-action="limpiar" aria-label="${t('Borrar')}">${ic('x')}</button></label>`;
  }
  return `<div class="route-field route-field--${tipo} ${tipo === 'dest' && !valor && store.get().origin ? 'is-focus' : ''}">
    <button class="route-field__main" data-action="enfocar" ${pr({ f: tipo })}><i class="route-field__dot"></i>${valor ? `<span class="route-field__txt"><small>${tipo === 'origin' ? t('Origen') : t('Destino')}</small><span class="ellipsis">${esc(valor)}</span></span>` : `<span class="grow ellipsis" style="color:var(--tx2);font-weight:400">${placeholder}</span>`}</button>${swap}</div>`;
};

/* ---------- Modo lista ---------- */
function filtrosHtml() {
  const chips = [`<button class="chip ${ui.cat ? '' : 'is-active'}" data-action="categoria" data-params='{"c":""}'>${t('Todos')} <b class="chip__count">${total().toLocaleString('es-PE')}</b></button>`]
    .concat(FILTROS.map((c) => `<button class="chip ${ui.cat === c ? 'is-active' : ''}" data-action="categoria" ${pr({ c })}>${t(c)} <b class="chip__count">${contar(c)}</b></button>`));
  return `<div class="chip-row">${chips.join('')}</div>`;
}

function listaHtml() {
  const lugares = listar({ q: ui.q, categoria: ui.cat });
  const visibles = lugares.slice(0, ui.shown);
  let letra = '', h = '';
  for (const l of visibles) {
    const L = norm(l.n)[0].toUpperCase();
    if (!ui.q && /[A-Z]/.test(L) && L !== letra) { letra = L; h += `<div class="alpha-header" id="letra-${L}">${L}</div>`; }
    const nombre = ui.q ? esc(l.n).replace(new RegExp(`(${esc(ui.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'), '<mark>$1</mark>') : esc(l.n);
    h += `<button class="item item--tall" data-action="elegir" ${pr({ n: l.n })}>${ic(iconoDe(l), 'item__icon')}<div class="item__body"><div class="item__title">${nombre}</div><div class="place-meta">${lineasDe(l).slice(0, 3).map((x) => lineDot(x.linea)).join('')}<span class="cat">${t(l.t)}</span></div></div>${ic('chevron-right', 'item__chevron')}</button>`;
  }
  const mas = lugares.length > visibles.length ? `<button class="item" data-action="mas" style="justify-content:center;color:var(--link);font-weight:600">${t('Mostrar más')} (${lugares.length - visibles.length})</button>` : '';
  const letras = [...new Set(visibles.map((l) => norm(l.n)[0].toUpperCase()).filter((x) => /[A-Z]/.test(x)))];
  return {
    html: `<div class="hint">${ui.q ? t('{n} resultados para “{q}”', { n: lugares.length, q: esc(ui.q) }) : t('{n} lugares de Juliaca · desliza o filtra por tipo', { n: total().toLocaleString('es-PE') })}</div>
      <div class="group">${h || `<div class="item"><div class="item__body"><div class="item__sub">${t('No encontramos ese lugar.')}</div></div></div>`}${mas}</div>
      <div class="hint" style="padding-top:14px">${t('¿No aparece tu lugar?')}</div>
      <div class="group"><button class="item" data-action="mapaLibre">${ic('map-pin-check', 'item__icon')}<div class="item__body"><div class="item__title">${t('Elegir en el mapa')}</div></div>${ic('chevron-right', 'item__chevron')}</button>
      <button class="item" data-action="mapaEnlace">${ic('link', 'item__icon')}<div class="item__body"><div class="item__title">${t('Pegar enlace de Google Maps')}</div><div class="item__sub">${t('Compártelo desde Google Maps y pégalo aquí')}</div></div>${ic('chevron-right', 'item__chevron')}</button></div>`,
    letras,
  };
}

/* ---------- Modo mapa ---------- */
// Solo con origen o solo con destino: el mapa muestra el punto con su rótulo y nada más.
// Con los dos: las líneas disponibles (con transbordo cuando hace falta), de la más corta a la más larga.
function hojaResultados(opciones) {
  const punta = estadoPunta();
  const mejor = opciones[0];
  return `<div class="sheet__handle"></div>
    <h3 class="sheet__title">${opciones.length ? t('Líneas disponibles') : ''}</h3>
    ${punta.activa && mejor ? `<div class="tip">${ic('bulb')}<div><b>${t('Hora punta hasta las {h}', { h: horaTexto(punta.hasta) })}</b>${t('Si sales unos minutos después, el viaje puede ser más corto.')}</div></div>` : ''}
    ${opciones.map((o, i) => {
      const separador = o.nivel !== 'cerca' && (i === 0 || opciones[i - 1].nivel === 'cerca')
        ? `<div class="sheet__sep">${ic('walk')}${i === 0 ? t('Las líneas pasan algo lejos: caminas más') : t('Más lejos: caminas más hasta la micro o hasta tu destino')}</div>` : '';
      const camina = [o.caminata.inicio, o.caminata.final].filter((m) => m >= 40).map((m) => `${Math.round(m / 10) * 10} m`);
      return `${separador}
      <button class="sheet__row ${i === 0 && o.nivel === 'cerca' ? 'is-best' : ''} ${o.nivel !== 'cerca' ? 'is-far' : ''}" ${go('route', { o: store.get().origin, d: store.get().destination, id: o.id })}>
        <div style="display:flex;gap:4px">${o.lineas.map((l) => lineBadge(l)).join('')}</div>
        <div class="sheet__row-body">
          <div class="sheet__row-title">${o.lineas.length === 1 ? esc(o.lineas[0].nombre) : o.lineas.map((l) => l.numero).join(' + ')} <em>${o.tipo === 'directo' ? t('Directo') : t('1 transbordo')}</em>${i === 0 && o.nivel === 'cerca' && opciones.length > 1 ? `<em class="pill-best">${t('Mejor')}</em>` : ''}</div>
          <div class="sheet__row-sub">${t('Pasa en')} ~${o.esperaMin} min${camina.length ? ` · ${t('camina {m}', { m: camina.join(' + ') })}` : ''}${o.extraPunta ? `<i class="mini-pill">${ic('traffic-lights')}+${o.extraPunta}</i>` : ''}</div>
        </div>
        <div class="sheet__row-time">${o.minutos}<small>min · ${soles(o.precio)}</small></div>
      </button>`;
    }).join('') ||`<div class="empty"><h3>${t('Sin micros directos')}</h3><p>${t('Ninguna de las líneas registradas conecta estos dos puntos. Prueba con un lugar más cercano a una línea.')}</p></div>`}`;
}

export default {
  name: 'search',
  tab: 'search',

  render(params) {
    const s = store.get();
    if (!params._init) {
      params._init = true;
      const foco = params.focus !== undefined ? params.focus : (!s.origin ? 'origin' : null);
      ui = { focus: foco, q: '', cat: null, shown: POR_PAGINA };
    }
    const enLista = !!ui.focus;
    const campos = campoHtml('origin', s.origin, ui.focus) + campoHtml('dest', s.destination, ui.focus);

    if (enLista) {
      const { html, letras } = listaHtml();
      return `${appbar()}
        <div class="float-card" style="position:static;margin:10px 12px 0">${campos}</div>
        ${filtrosHtml()}
        <div class="scroll" id="places-scroll" style="position:relative"><div id="places-list">${html}</div></div>
        ${letras.length > 5 && !ui.q ? `<div class="alpha-index" id="alpha">${letras.map((x) => `<button data-action="saltar" ${pr({ x })}>${x}</button>`).join('')}</div>` : ''}`;
    }
    const opciones = s.origin && s.destination ? ordenar(buscarOpciones(s.origin, s.destination)) : null;
    ui.opciones = opciones;
    return `${appbar()}
      <div style="position:relative;flex:1;min-height:0">
        <div class="map" id="map"></div>
        <div class="float-card">${campos}</div>
        ${opciones ? `<div class="sheet" id="sheet">${hojaResultados(opciones)}</div>` : ''}
      </div>`;
  },

  mount(root) {
    const s = store.get();
    const input = root.querySelector('input[data-field]');
    if (input) {
      input.addEventListener('input', () => {
        ui.q = input.value; ui.shown = POR_PAGINA;
        root.querySelector('#places-list').innerHTML = listaHtml().html;
        root.querySelector('#alpha')?.classList.toggle('hidden', !!ui.q);
      });
      return null;
    }
    const mapa = createMap(root.querySelector('#map'));
    const o = getPunto(s.origin), d = getPunto(s.destination);
    const opciones = ui.opciones;
    const alto = () => (root.querySelector('.sheet')?.offsetHeight || 0);
    const conRuta = !!(o && d && opciones?.length);

    if (o) mapa.pin(o.c, 'origin', t('Origen'));
    if (d) mapa.pin(d.c, 'dest', t('Destino'));

    if (conRuta) {
      LINEAS.forEach((l) => mapa.line(l, { weight: 3.5, opacity: 0.4, withCasing: false }));
      const mejor = opciones[0];
      let puntos = [o.c, d.c];
      mejor.tramos.forEach((tr) => {
        const l = LINEAS.find((x) => x.id === tr.lineaId);
        puntos = puntos.concat(mapa.segment(l, tr.desde, tr.hasta));
      });
      const primero = mejor.tramos[0], ultimo = mejor.tramos[mejor.tramos.length - 1];
      mapa.dashed(o.c, primero.sube.c);
      mapa.dashed(ultimo.baja.c, d.c);
      for (let i = 0; i < mejor.tramos.length - 1; i++) mapa.dashed(mejor.tramos[i].baja.c, mejor.tramos[i + 1].sube.c);
      mapa.fit(puntos, { top: 130, bottom: alto() + 20 });
    } else if (o && d) {
      mapa.dashed(o.c, d.c);
      mapa.fit([o.c, d.c], { top: 130, bottom: alto() + 20 });
    } else if (o || d) {
      mapa.map.setView((o || d).c, 15);
    } else mapa.fit(LINEAS.flatMap((l) => l.ida), { top: 100, bottom: 40 });
    return () => mapa.destroy();
  },
  actions: {
    enfocar(_el, { f }, api) { ui.focus = f; ui.q = ''; ui.shown = POR_PAGINA; api.rerender(); },
    limpiar(_el, _p, api) { ui.q = ''; api.rerender(); },
    categoria(_el, { c }, api) { ui.cat = c || null; ui.shown = POR_PAGINA; api.rerender(); },
    mas(_el, _p, api) { ui.shown += POR_PAGINA; const lista = $('#places-list'); lista.innerHTML = listaHtml().html; },
    saltar(_el, { x }) { document.getElementById(`letra-${x}`)?.scrollIntoView({ block: 'start' }); },
    swap(_el, _p, api) { const s = store.get(); store.set({ origin: s.destination, destination: s.origin }); api.rerender(); },
    /** "Elegir en el mapa": pantalla completa con pin fijo en el centro y dirección al mover. */
    mapaLibre(_el, _p, api) { return elegirPunto(api); },
    /** "Pegar enlace de Google Maps": abre el mismo selector con el campo del enlace ya visible. */
    mapaEnlace(_el, _p, api) { return elegirPunto(api, { enlace: true }); },
    elegir(_el, { n }, api) {
      const campo = ui.focus === 'origin' ? 'origin' : 'destination';
      store.set({ [campo]: n });
      ui.q = '';
      const s = store.get();
      ui.focus = !s.origin ? 'origin' : (!s.destination && campo === 'destination') ? 'dest' : null;
      api.rerender();
    },
  },
};

/** Abre el selector en el campo activo (origen o destino) y guarda el punto elegido. */
async function elegirPunto(api, { enlace = false } = {}) {
  const campo = ui.focus === 'origin' ? 'origin' : 'destination';
  const s = store.get();
  const previo = getPunto(campo === 'origin' ? s.origin : s.destination);
  const r = await elegirEnMapa({ tipo: campo, centro: Array.isArray(previo?.c) ? previo.c : null, enlace });
  if (!r) return;                      // canceló (← o Escape)
  // Se guarda "dirección (lat, lng)" para que el campo muestre el nombre pero las rutas usen las coordenadas.
  const xy = `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;
  const valor = r.nombre ? `${r.nombre} (${xy})` : xy;
  store.set({ [campo]: valor });
  ui.q = '';
  const st = store.get();
  ui.focus = !st.origin ? 'origin' : (!st.destination && campo === 'destination') ? 'dest' : null;
  api.rerender();
}
