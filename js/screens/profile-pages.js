// PANTALLAS INTERNAS DEL PERFIL
import { store } from '../core/store.js';
import { t, IDIOMAS } from '../core/i18n.js';
import { esc, ic, go, pr } from '../core/dom.js';
import { appbar, subbar, item, toggle, lineBadge } from '../components/ui.js';
import { LINEAS, getLinea, soles } from '../data/lineas.js';
import { proximoMin } from '../services/eta.service.js';
import { borrarHistorial, alternarLinea } from '../services/favorites.service.js';
import { textSizeLabels } from '../core/theme.js';
import { getLugar, iconoDe } from '../services/places.service.js';
import { openModal } from '../components/overlay.js';
import { toast } from '../components/toast.js';
import { CONTACTO, VERSION } from '../core/config.js';
import { enlaceWhatsApp, enlaceCorreo, mensaje, copiarTexto } from '../services/soporte.service.js';

const TAB = 'profile';

/* ---------- Favoritos ---------- */
export const favorites = {
  name: 'favorites', tab: TAB,
  render() {
    const s = store.get();
    return `${appbar()}${subbar('Favoritos', 'Tus accesos rápidos')}
      <div class="scroll">
        <div class="hint" style="padding-top:14px">${t('Líneas')}</div>
        <div class="group">${s.favoriteLines.map((id) => { const l = getLinea(id); return `
          <div class="sheet__row line-row" style="padding:10px 16px">${lineBadge(l)}
            <button class="sheet__row-body" style="text-align:left" ${go('line-detail', { id })}><div class="sheet__row-title">${esc(l.nombre)}</div><div class="sheet__row-sub">~${proximoMin(l) ?? '—'} min · ${soles(l.tarifa.adulto)}</div></button>
            <img class="line-row__photo" src="${l.foto}" alt="" style="width:80px">
            <button data-action="quitar" ${pr({ id })} aria-label="${t('Quitar de favoritos')}" style="font-size:22px;color:var(--magenta);width:44px;height:44px">${ic('heart-filled')}</button></div>`; }).join('') || `<div class="item"><div class="item__sub">${t('Aún no tienes líneas favoritas.')}</div></div>`}</div>
        <div class="hint" style="padding-top:16px">${t('Lugares guardados')}</div>
        <div class="group">${s.shortcuts.filter((a) => a.place).map((a) => item({ icon: a.icon, title: esc(a.label), sub: esc(a.place), attrs: `data-action="irA" ${pr({ n: a.place })}` })).join('')}</div>
      </div>`;
  },
  actions: {
    quitar(_el, { id }, api) { alternarLinea(id); api.rerender(); },
    irA(_el, { n }, api) { store.set({ origin: n }); api.go('search', { focus: 'dest' }); },
  },
};

/* ---------- Historial ---------- */
export const history = {
  name: 'history', tab: TAB,
  render() {
    const s = store.get();
    const h = s.viajesCompletados || s.history || [];
    return `${appbar()}${subbar('Historial', 'Tus viajes completados')}
      <div class="scroll">
        <div class="group mt-12">${h.map((x) => {
          const lineas = x.lineas || (x.lineaId ? [x.lineaId] : []);
          const linea = getLinea(lineas[0]);
          const fecha = x.fecha ? new Date(x.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : x.when;
          return item({ icon: 'clock', title: `${lineas.length > 1 ? lineas.map(id => getLinea(id)?.numero || id).join(' + ') : (linea?.nombre || '')}`, sub: fecha ? esc(fecha) : '', value: x.duracion ? `${x.duracion} min` : '', chevron: false });
        }).join('') || `<div class="item"><div class="item__sub">${t('Todavía no hay viajes.')}</div></div>`}</div>
      </div>`;
  },
  actions: {},
};

/* ---------- Paquetes offline ---------- */
export const offline = {
  name: 'offline', tab: TAB,
  render() {
    const s = store.get();
    const fila = (l) => {
      const estadoD = s.downloads[l.id]; // Puede ser undefined, un número (0-99), o 'ok'
      const ok = estadoD === 'ok';
      const bajando = typeof estadoD === 'number';
      
      return `<div class="download">${lineBadge(l, 'md')}
        <div class="download__body">
          <b>${esc(l.nombre)}</b>
          <span>${ok ? t('Actualizada hace 2 días') : bajando ? t(`Descargando… ${estadoD} %`) : t('No descargada')}</span>
          ${ok ? '' : bajando ? `<div class="download__bar"><i style="width:${estadoD}%"></i></div>` : ''}
        </div>
        ${ok ? `<span class="download__state">${ic('circle-check')}${t('Guardada')}</span>` : bajando ? `<span class="download__state">${ic('loader')}</span>` : `<button class="link-btn" data-action="descargar" ${pr({ id: l.id })}>${t('Descargar')}</button>`}
      </div>`;
    };
    return `${appbar()}${subbar('Paquetes offline', 'Consulta tus líneas sin señal')}
      <div class="scroll">
        <div class="group mt-12">${LINEAS.map(fila).join('')}</div>
        <div class="group">
          ${item({ icon: 'map-2', title: t('Mapa de Juliaca'), sub: t('18 MB · se usa sin internet'), chevron: false, trailing: `<span class="download__state">${t('Guardado')}</span>` })}
          <div class="item"><i class="item__icon ti ti-wifi"></i><div class="item__body"><div class="item__title">${t('Actualizar solo con Wi-Fi')}</div></div>${toggle(s.wifiOnly, 'data-action="wifi"')}</div>
          ${item({ icon: 'refresh', title: t('Actualizar ahora'), sub: t('Última vez: hace 2 días'), chevron: false, attrs: 'data-action="actualizar"' })}
        </div>
        <div class="infobox">${ic('info-circle')}${t('Paquetes offline: ves rutas, tarifas y horarios sin internet. Los avisos y la hora punta se actualizan al volver la señal.')}</div>
      </div>`;
  },
  actions: {
    // Descarga simulada
    descargar(_el, { id }, api) { 
      let progreso = 5;
      // Actualiza el store con el 5% inicial
      store.set({ downloads: { ...store.get().downloads, [id]: progreso } });
      api.rerender();

      // Crea un intervalo que sube el progreso cada 300ms
      const intervalo = setInterval(() => {
        progreso += Math.floor(Math.random() * 20) + 10; // Sube entre 10% y 30%
        
        if (progreso >= 100) {
          clearInterval(intervalo);
          store.set({ downloads: { ...store.get().downloads, [id]: 'ok' } });
          api.toast(t('Línea descargada con éxito'));
        } else {
          store.set({ downloads: { ...store.get().downloads, [id]: progreso } });
        }
        api.rerender(); // Refresca la pantalla para mover la barrita
      }, 300);
    },     
    wifi(_el, _p, api) { store.set({ wifiOnly: !store.get().wifiOnly }); api.rerender(); },
    actualizar(_el, _p, api) { api.toast(t('Todo está actualizado')); },
  },
};

/* ---------- Idioma ---------- */
export const language = {
  name: 'language', tab: TAB,
  render() {
    const actual = store.get().lang;
    return `${appbar()}${subbar('Idioma', 'Elige cómo ver ÑanGO')}
      <div class="scroll"><div class="group mt-12">${IDIOMAS.map((l) => `
        <button class="lang-option ${l.id === actual ? 'is-active' : ''}" data-action="elegir" ${pr({ id: l.id })}><div><b>${l.nombre}</b><span class="sub">${l.sub}${l.pendiente ? `<i class="lang-tag" style="font-style:normal">${t('Revisión pendiente')}</i>` : ''}</span></div><span class="radio"></span></button>`).join('')}</div>
        <div class="infobox">${ic('users')}${t('El quechua y el aymara los revisan hablantes de la comunidad. Si ves una palabra mejorable, avísanos desde Ayuda.')}</div></div>`;
  },
  actions: { elegir(_el, { id }, api) { store.set({ lang: id }); api.rerender(); } },
};

/* ---------- Tamaño del texto y accesibilidad ---------- */
export const textSize = {
  name: 'text-size', tab: TAB,
  render() {
    const s = store.get();
    return `${appbar()}${subbar('Tamaño del texto', 'Para leer mejor')}
      <div class="scroll">
        <div class="size-card"><div class="size-card__ends"><span style="font-size:.8125rem">A</span><span>${t(textSizeLabels[s.textSize])}</span><span style="font-size:1.375rem">A</span></div>
          <input class="size-slider" type="range" min="0" max="3" step="1" value="${s.textSize}" id="tam" aria-label="${t('Tamaño del texto')}">
          <div class="size-card__preview"><div style="font-size:1.1875rem;font-weight:700">Línea 60 · UNAJ</div><div style="font-size:1.0625rem;color:var(--tx2);margin-top:3px">${t('Pasa en')} ~3 min · S/ 1.00</div></div></div>
        <div class="group mt-12">
          <div class="item"><i class="item__icon ti ti-contrast-2"></i><div class="item__body"><div class="item__title">${t('Alto contraste')}</div><div class="item__sub">${t('Más diferencia entre texto y fondo')}</div></div>${toggle(s.highContrast, 'data-action="contraste"')}</div>
          <div class="item"><i class="item__icon ti ti-moon"></i><div class="item__body"><div class="item__title">${t('Modo oscuro')}</div><div class="item__sub">${t('Automático al anochecer')}</div></div>${toggle(s.theme === 'auto', 'data-action="auto"')}</div>
          <div class="item"><i class="item__icon ti ti-player-pause"></i><div class="item__body"><div class="item__title">${t('Reducir animaciones')}</div></div>${toggle(s.reduceMotion, 'data-action="mov"')}</div>
        </div></div>`;
  },
  mount(root) { root.querySelector('#tam').addEventListener('input', (e) => { store.set({ textSize: +e.target.value }); root.querySelector('.size-card__ends span:nth-child(2)').textContent = t(textSizeLabels[+e.target.value]); }); },
  actions: {
    contraste(_el, _p, api) { store.set({ highContrast: !store.get().highContrast }); api.rerender(); },
    auto(_el, _p, api) { store.set({ theme: store.get().theme === 'auto' ? 'light' : 'auto' }); api.rerender(); },
    mov(_el, _p, api) { store.set({ reduceMotion: !store.get().reduceMotion }); api.rerender(); },
  },
};

/* ---------- Ayuda y contacto ---------- */
const PREGUNTAS = [
  ['¿Por qué ÑanGO no usa GPS?', 'Para cuidar tu privacidad: no pedimos permiso de ubicación ni te seguimos. Tú eliges dónde estás entre lugares conocidos de Juliaca.'],
  ['¿Cómo se calculan los minutos?', 'Con la frecuencia de cada línea. Sin GPS no podemos saber dónde está cada micro, por eso siempre decimos “estimado”.'],
  ['¿Cómo se revisan los avisos?', 'Un aviso se publica cuando otra persona lo confirma o cuando el equipo de ÑanGO lo aprueba. Si varias personas marcan que ya no pasa, se retira.'],
  ['¿Cuánto dura un aviso?', 'Depende del tipo: un tráfico dura unas horas, un paro un día y un cambio de tarifa una semana. Si nadie lo confirma, desaparece en pocas horas. Cada confirmación nueva lo mantiene un poco más.'],
  ['¿Funciona sin internet?', 'Sí. Las líneas, los paraderos, las tarifas y el mapa de Juliaca funcionan sin conexión. Los avisos, tu cuenta y los enlaces de Google Maps necesitan internet.'],
];

/** Hoja con dos botones (WhatsApp y correo) que abren el mensaje ya escrito. */
function abrirContacto(tipo, titulo, ayuda) {
  const m = mensaje(tipo, store.get().lang);
  openModal(`<h3>${t(titulo)}</h3>
    <div class="muted" style="font-size:.8125rem;padding-bottom:12px">${t(ayuda)}</div>
    <a class="btn btn--primary btn--block btn--lg" href="${esc(enlaceWhatsApp(m.texto))}" target="_blank" rel="noopener" data-close>${ic('brand-whatsapp')} ${t('Enviar por WhatsApp')}</a>
    <a class="btn btn--dark btn--block btn--lg mt-8" href="${esc(enlaceCorreo(m.asunto, m.texto))}" data-close>${ic('mail')} ${t('Enviar por correo')}</a>
    <button class="btn btn--block mt-8" data-action="copiar">${t('Copiar correo')}</button>`,
  { actions: { copiar: async (_el, _ev, close) => { toast((await copiarTexto(CONTACTO.correo)) ? t('Correo copiado') : t('No se pudo copiar')); close(); } } });
}

export const help = {
  name: 'help', tab: TAB,
  render(p) {
    const abierta = p.abierta ?? -1;
    const ayuda = mensaje('ayuda');
    return `${appbar()}${subbar('Ayuda y contacto')}
      <div class="scroll">
        <div class="contact-grid"><a href="${esc(enlaceWhatsApp(ayuda.texto))}" target="_blank" rel="noopener">${ic('brand-whatsapp')}WhatsApp</a><a href="${esc(enlaceCorreo(ayuda.asunto, ayuda.texto))}">${ic('mail')}${t('Correo')}</a></div>
        <p class="hint" style="text-align:center;padding-top:8px">${esc(CONTACTO.correo)} · <button data-action="copiarCorreo" style="background:none;border:0;padding:0;font:inherit;font-weight:700;color:var(--link);text-decoration:underline;cursor:pointer">${t('Copiar')}</button></p>
        <div class="hint" style="padding-top:16px">${t('Preguntas frecuentes')}</div>
        <div class="group">${PREGUNTAS.map(([q, r], i) => `<button class="faq" data-action="abrir" ${pr({ i })} aria-expanded="${abierta === i}">${t(q)}${ic('chevron-down')}</button>${abierta === i ? `<div class="faq-answer">${t(r)}</div>` : ''}`).join('')}</div>
        <div class="group mt-12">
          ${item({ icon: 'message-report', title: t('Reportar un problema de la app'), attrs: 'data-action="problema"' })}
          ${item({ icon: 'map-pin-plus', title: t('Sugerir un lugar o corregir una ruta'), attrs: 'data-action="sugerir"' })}
          ${item({ icon: 'file-text', title: t('Privacidad y términos'), attrs: 'data-action="legales"' })}
        </div>
        <p class="hint" style="text-align:center;padding-top:14px">ÑanGO v${VERSION} · Juliaca</p>
      </div>`;
  },
  actions: {
    abrir(_el, { i }, api, _e, pantalla) { pantalla.abierta = pantalla.abierta === i ? -1 : i; api.rerender(); },
    async copiarCorreo(_el, _p, api) { api.toast((await copiarTexto(CONTACTO.correo)) ? t('Correo copiado') : t('No se pudo copiar')); },
    problema() { abrirContacto('problema', 'Reportar un problema de la app', 'Cuéntanos qué pasó. El mensaje ya viene escrito: solo completa los datos y envíalo.'); },
    sugerir() { abrirContacto('sugerencia', 'Sugerir un lugar o corregir una ruta', 'Dinos qué lugar falta o qué ruta está mal. El mensaje ya viene escrito: solo completa los datos y envíalo.'); },
    legales(_el, _p, api) { api.go('legal', { tipo: 'both' }); },
  },
};
void getLugar; void iconoDe;
