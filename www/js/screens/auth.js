// ================================================================
// REGISTRO / INGRESO (el "registro nuevo")
// Vistas: elegir (Google / correo / invitado) · formulario · legales ·
// términos · nueva contraseña. Conectado a Supabase (ver auth.service.js).
// ================================================================
import { t } from '../core/i18n.js';
import { store } from '../core/store.js';
import { ic } from '../core/dom.js';
import { legalDe } from '../legal/index.js';
import {
  correoValido, registrar, ingresar, ingresarConGoogle, continuarComoInvitado,
  salir, reenviar, olvide, nuevaClave, aceptarTerminos, entrar, sesionActual,
  terminosPendientes, enRecuperacion, limpiarRecuperacion, errorEnUrl, observar, mensajeError,
} from '../services/auth.service.js';

const GOOGLE = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;

/* Frases con enlaces: en español la clave ya trae el HTML; otros idiomas lo
   traducen en js/i18n. Los {terms}/{privacy} se reemplazan al pintar. */
const K_LEGAL = 'Al registrarte o continuar con Google, aceptas nuestros <a href="#" data-legal="terms">{terms}</a> y nuestra <a href="#" data-legal="privacy">{privacy}</a>.';
const K_CONSENT = 'He leído y acepto los <a href="#" data-legal="terms">{terms}</a> y la <a href="#" data-legal="privacy">{privacy}</a>.';

const lineaLegal = () => t(K_LEGAL, { terms: t('Términos de Servicio'), privacy: t('Política de Privacidad') });
const textoConsent = () => t(K_CONSENT, { terms: t('términos de uso'), privacy: t('política de privacidad') });

/* ---------- Estado de la pantalla (persiste entre navegaciones) ---------- */
let R = null;                 // raíz de la pantalla (se asigna en mount)
let modo = 'registro';        // registro | login
let vista = null;             // elegir | formulario | legales | terminos | reset
let legalTipo = 'terms';
let legalOrigen = 'elegir';
let reenvioEmail = '';
let reenvioRestante = 0;
let reenvioTimer = null;

const campo = (nombre, etiqueta, extra = '') => `
  <label class="field" data-campo="${nombre}">
    <span class="field__col"><span class="field__label">${etiqueta}</span>${extra}</span>
  </label>`;

const vistaInicial = () => {
  if (terminosPendientes()) return 'terminos';
  if (enRecuperacion()) return 'reset';
  return vista || 'elegir';
};

/* ---------- Pintar / cambiar de vista ---------- */
function mostrar(v) {
  vista = v;
  const V = { elegir: 'vElegir', formulario: 'vForm', legales: 'vLegal', terminos: 'vTerminos', reset: 'vReset' };
  Object.entries(V).forEach(([k, id]) => { const el = R.querySelector('#' + id); if (el) el.classList.toggle('hidden', k !== v); });
  limpiarMensajes();
  const scroller = R.querySelector('.auth');
  if (scroller) scroller.scrollTop = 0;
}

function limpiarMensajes() {
  ['msgElegir', 'msgForm', 'msgTerminos', 'msgReset'].forEach((m) => {
    const el = R.querySelector('#' + m);
    if (el) { el.textContent = ''; el.classList.remove('is-ok'); }
  });
}

function say(texto, ok = false) {
  const id = { elegir: 'msgElegir', formulario: 'msgForm', legales: 'msgForm', terminos: 'msgTerminos', reset: 'msgReset' }[vista] || 'msgForm';
  limpiarMensajes();
  const el = R.querySelector('#' + id);
  if (el) { el.textContent = texto; el.classList.toggle('is-ok', ok); }
}

function busy(on) {
  R.querySelectorAll('.btn, .auth__google, .auth__switch, .link-btn, .field__icon').forEach((b) => { b.disabled = on; });
  if (!on) reaplicarReenvio();
}

async function run(fn) {
  busy(true);
  try { await fn(); }
  catch (e) { say(t(mensajeError(e))); }
  finally { busy(false); }
}

function txtTodos(rol, texto) {
  R.querySelectorAll(`[data-rol="${rol}"]`).forEach((el) => { el.textContent = texto; });
}

function aplicarModo() {
  const reg = modo === 'registro';
  txtTodos('titulo', t(reg ? 'Crea tu cuenta' : 'Bienvenido de nuevo'));
  txtTodos('sub', t(reg ? 'Únete para comenzar' : 'Ingresa para ver tus favoritos'));
  txtTodos('submit', t(reg ? 'Crear cuenta' : 'Iniciar sesión'));
  txtTodos('switchTxt', t(reg ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'));
  txtTodos('switchBtn', t(reg ? 'Inicia sesión' : 'Crear cuenta'));
  const form = R.querySelector('#form');
  form.querySelector('[data-campo="nombre"]').classList.toggle('hidden', !reg);
  form.querySelector('[data-campo="clave2"]').classList.toggle('hidden', !reg);
  R.querySelector('#reqs').classList.toggle('hidden', !reg);
  R.querySelector('#forgot').classList.toggle('hidden', reg);
  R.querySelector('#consent').classList.toggle('hidden', !reg);
  form.querySelector('[name="clave"]').autocomplete = reg ? 'new-password' : 'current-password';
  // Solo pedir consentimiento en registro
  if (R.querySelector('#regConsent')) R.querySelector('#regConsent').checked = !reg;
  actualizarReqs();
}

function actualizarReqs() {
  const p = R.querySelector('[name="clave"]').value;
  const p2 = R.querySelector('[name="clave2"]').value;
  const okLen = p.length >= 8, okIgual = p !== '' && p === p2;
  const len = R.querySelector('#reqLen'), match = R.querySelector('#reqMatch');
  len.textContent = `${okLen ? '✓' : '○'} ${t('Mínimo 8 caracteres')}`;
  len.classList.toggle('is-ok', okLen);
  match.textContent = `${okIgual ? '✓' : '○'} ${t('Las dos contraseñas coinciden')}`;
  match.classList.toggle('is-ok', okIgual);
}

/* ---------- Reenvío de correo de confirmación ---------- */
function reaplicarReenvio() {
  const b = R.querySelector('#resendBox [data-action="reenviar"]');
  if (!b) return;
  b.textContent = reenvioRestante > 0 ? t('Reenviar correo (espera {s}s)', { s: reenvioRestante }) : t('Reenviar correo de confirmación');
  b.disabled = reenvioRestante > 0;
}

function cooldown(seg = 60) {
  reenvioRestante = seg;
  clearInterval(reenvioTimer);
  const tick = () => { reaplicarReenvio(); if (reenvioRestante <= 0) clearInterval(reenvioTimer); };
  tick();
  reenvioTimer = setInterval(() => { reenvioRestante--; tick(); }, 1000);
}

function mostrarReenviar(correo) {
  reenvioEmail = correo;
  R.querySelector('#resendBox').classList.remove('hidden');
  cooldown(60);
}

/* ---------- Términos, legales y recuperación ---------- */
function irATerminos() {
  const c = R.querySelector('#termsCheck');
  if (c) c.checked = false;
  const b = R.querySelector('#btnAceptar');
  if (b) b.disabled = true;
  mostrar('terminos');
}

function abrirLegal(tipo) {
  legalTipo = tipo;
  legalOrigen = vista === 'legales' ? legalOrigen : vista;
  R.querySelector('[data-rol="legalTitulo"]').textContent = t(tipo === 'terms' ? 'Términos de Servicio' : 'Política de Privacidad');
  R.querySelector('#legalBody').innerHTML = legalDe(store.get().lang, tipo);
  mostrar('legales');
}

function validarForm(datos, reg, form) {
  if (reg && datos.nombre.length < 2) return { campo: 'nombre', mensaje: 'Escribe tu nombre.' };
  if (!correoValido(datos.correo)) return { campo: 'correo', mensaje: 'Revisa tu correo, parece incompleto.' };
  if (reg && datos.clave.length < 8) return { campo: 'clave', mensaje: 'La contraseña necesita al menos 8 caracteres.' };
  if (!reg && datos.clave.length < 1) return { campo: 'clave', mensaje: 'Escribe tu contraseña.' };
  if (reg && datos.clave2 !== datos.clave) return { campo: 'clave2', mensaje: 'Las contraseñas no coinciden.' };
  if (reg && form.querySelector('#regConsent') && !form.querySelector('#regConsent').checked) return { campo: 'consent', mensaje: 'Acepta los términos y la política de privacidad para continuar.' };
  return null;
}

export default {
  name: 'auth',
  flow: true,

  render(params = {}) {
    if (params.modo === 'login' || params.modo === 'registro') modo = params.modo;
    const reg = modo === 'registro';

    return `
      <div class="cover" style="height:206px">
        <div class="cover__bar">
          <img class="appbar__logo" src="assets/img/brand/wordmark.png" alt="ÑanGO">
          <span class="appbar__spacer"></span>
          <button class="appbar__lang" type="button" data-go="language" aria-label="${t('Idioma')}">${ic('language')}<span id="authLang">${store.get().lang.toUpperCase()}</span></button>
        </div>
        <div class="cover__title"><h1>${t('Sube a bordo')}</h1><p>${t('Guía de transporte público · Juliaca')}</p></div>
        <img class="cover__logo" src="assets/img/brand/logo.png" alt="">
      </div>
      <div class="stripe"></div>
      <div class="auth">

        <!-- Vista 1: elegir cómo continuar -->
        <section id="vElegir">
          <h2 data-rol="titulo"></h2>
          <div class="auth__sub" data-rol="sub"></div>
          <button class="auth__google" type="button" data-action="google">${GOOGLE}${t('Continuar con Google')}</button>
          <div class="auth__or">${t('o')}</div>
          <button class="btn btn--outline btn--block btn--lg" type="button" data-action="correo">${t('Continuar con correo electrónico')}</button>
          <div class="auth__or">${t('o')}</div>
          <button class="link-btn" type="button" data-action="invitado">${t('Continuar sin registrarme')}</button>
          <div class="auth__msg" id="msgElegir" role="alert"></div>
          <p class="auth__legal">${lineaLegal()}</p>
          <button class="auth__switch" type="button" data-action="cambiar"><span data-rol="switchTxt"></span> <b data-rol="switchBtn"></b></button>
        </section>

        <!-- Vista 2: formulario de correo -->
        <section id="vForm" class="hidden">
          <h2 data-rol="titulo"></h2>
          <div class="auth__sub" data-rol="sub"></div>
          <form id="form" novalidate>
            ${campo('nombre', t('Nombre'), `<input class="field__input" name="nombre" autocomplete="name" placeholder="${t('Tu nombre')}">`)}
            ${campo('correo', t('Correo electrónico'), `<input class="field__input" name="correo" type="email" inputmode="email" autocomplete="email" placeholder="nombre@gmail.com">${ic('mail', 'field__icon')}`)}
            <label class="field" data-campo="clave">
              <span class="field__col"><span class="field__label">${t('Contraseña')}</span><input class="field__input" name="clave" type="password" autocomplete="new-password" placeholder="${t('Mínimo 8 caracteres')}"></span>
              <button class="field__icon" type="button" data-action="ver" aria-label="${t('Mostrar u ocultar contraseña')}">${ic('eye')}</button>
            </label>
            ${campo('clave2', t('Repite la contraseña'), `<input class="field__input" name="clave2" type="password" autocomplete="new-password" placeholder="${t('Repite tu contraseña')}">`)}
            <div class="auth__reqs" id="reqs"><span id="reqLen"></span><span id="reqMatch"></span></div>
            <div class="auth__forgot" id="forgot"><button class="link-btn" type="button" data-action="olvide" style="padding:0">${t('¿Olvidaste tu contraseña?')}</button></div>
            ${reg ? `<label class="consent" id="consent"><input type="checkbox" id="regConsent"><span>${textoConsent()}</span></label>` : ''}
            <div class="auth__msg" id="msgForm" role="alert"></div>
            <div class="hidden" id="resendBox"><button class="btn btn--outline btn--block" type="button" data-action="reenviar"></button></div>
            <button class="btn btn--primary btn--block btn--lg mt-16" type="submit" data-rol="submit"></button>
          </form>
          <button class="auth__switch" type="button" data-action="cambiar"><span data-rol="switchTxt"></span> <b data-rol="switchBtn"></b></button>
          <button class="link-btn" type="button" data-action="volverElegir" style="align-self:center">${t('← Volver')}</button>
        </section>

        <!-- Vista 3: documento legal -->
        <section id="vLegal" class="hidden">
          <button class="link-btn" type="button" data-action="volverLegal" style="align-self:flex-start;padding:0">${t('← Volver')}</button>
          <h2 data-rol="legalTitulo" style="margin-top:10px"></h2>
          <div class="doc" id="legalBody"></div>
        </section>

        <!-- Vista 4: aceptar términos (cuenta nueva) -->
        <section id="vTerminos" class="hidden">
          <h2>${t('Antes de continuar')}</h2>
          <div class="auth__sub">${t('ÑanGO guarda tu nombre, tu correo y tus favoritos para que puedas usar la app.')}</div>
          <label class="consent"><input type="checkbox" id="termsCheck"><span>${textoConsent()}</span></label>
          <div class="auth__msg" id="msgTerminos" role="alert"></div>
          <button class="btn btn--primary btn--block btn--lg" type="button" id="btnAceptar" disabled data-action="aceptar">${t('Acepto y continuar')}</button>
          <button class="link-btn" type="button" data-action="rechazar" style="align-self:center">${t('No acepto, salir')}</button>
        </section>

        <!-- Vista 5: nueva contraseña (enlace de recuperación) -->
        <section id="vReset" class="hidden">
          <h2>${t('Nueva contraseña')}</h2>
          <div class="auth__sub">${t('Escribe una contraseña nueva para tu cuenta.')}</div>
          ${campo('newPass', t('Nueva contraseña'), `<input class="field__input" id="newPass" type="password" autocomplete="new-password" placeholder="${t('Mínimo 8 caracteres')}">`)}
          ${campo('newPass2', t('Repite la contraseña'), `<input class="field__input" id="newPass2" type="password" autocomplete="new-password">`)}
          <div class="auth__msg" id="msgReset" role="alert"></div>
          <button class="btn btn--primary btn--block btn--lg mt-16" type="button" data-action="guardarClave">${t('Guardar contraseña')}</button>
        </section>

      </div>`;
  },

  mount(root, _params, api) {
    R = root;
    const form = root.querySelector('#form');

    aplicarModo();
    mostrar(vistaInicial());

    // Enlaces a los documentos legales (delegado dentro de la pantalla)
    const alClicLegal = (e) => {
      const a = e.target.closest('[data-legal]');
      if (!a) return;
      e.preventDefault();
      abrirLegal(a.dataset.legal);
    };
    root.addEventListener('click', alClicLegal);

    // Requisitos de la contraseña
    form.querySelector('[name="clave"]').addEventListener('input', actualizarReqs);
    form.querySelector('[name="clave2"]').addEventListener('input', actualizarReqs);

    // Casilla de consentimiento en el formulario
    form.querySelector('#regConsent').addEventListener('change', () => root.querySelector('#consent').classList.remove('is-error'));

    // Aceptación de términos
    const check = root.querySelector('#termsCheck');
    if (check) check.addEventListener('change', () => { root.querySelector('#btnAceptar').disabled = !check.checked; });

    // Enviar el formulario
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reg = modo === 'registro';
      form.querySelectorAll('.field, .consent').forEach((f) => f.classList.remove('is-error'));
      const datos = {
        nombre: form.querySelector('[name="nombre"]').value.trim(),
        correo: form.querySelector('[name="correo"]').value.trim(),
        clave: form.querySelector('[name="clave"]').value,
        clave2: form.querySelector('[name="clave2"]').value,
      };
      const falla = validarForm(datos, reg, form);
      if (falla) {
        const sel = falla.campo === 'consent' ? '#consent' : `[data-campo="${falla.campo}"]`;
        form.querySelector(sel)?.classList.add('is-error');
        form.querySelector(sel)?.scrollIntoView({ block: 'center' });
        say(t(falla.mensaje));
        return;
      }
      await run(async () => {
        const r = reg ? await registrar(datos) : await ingresar(datos);
        if (r.estado === 'confirmar') {
          mostrarReenviar(r.correo);
          say(t('Te enviamos un correo. Confírmalo y luego ingresa. Si no llega, revisa spam o reenvíalo abajo.'), true);
          return;
        }
        if (r.estado === 'terminos') { irATerminos(); return; }
        vista = 'elegir';
        api.goTab('home');
      });
    });

    // Si Supabase manda un enlace de recuperación, abrimos "Nueva contraseña"
    observar((ev) => { if (ev === 'PASSWORD_RECOVERY' && R === root) { limpiarMensajes(); mostrar('reset'); } });

    // Errores que lleguen en la dirección (por ejemplo, enlace vencido)
    const err = errorEnUrl();
    if (err) { mostrar('elegir'); say(err); }

    return () => {
      root.removeEventListener('click', alClicLegal);
      clearInterval(reenvioTimer);
      reenvioTimer = null;
      R = null;
    };
  },

  actions: {
    google() { run(async () => { await ingresarConGoogle(); }); },

    correo() { mostrar('formulario'); },

    invitado(_el, _p, api) { continuarComoInvitado(); vista = 'elegir'; api.goTab('home'); },

    cambiar() { modo = modo === 'registro' ? 'login' : 'registro'; aplicarModo(); mostrar('formulario'); },

    volverElegir() { mostrar('elegir'); },

    volverLegal() { mostrar(legalOrigen); },

    ver(el) {
      const i = el.closest('.field').querySelector('input');
      const mostrar = i.type === 'password';
      i.type = mostrar ? 'text' : 'password';
      el.innerHTML = ic(mostrar ? 'eye-off' : 'eye');
    },

    olvide() {
      const correo = R.querySelector('[name="correo"]').value.trim();
      if (!correoValido(correo)) return say(t('Revisa tu correo, parece incompleto.'));
      run(async () => { await olvide(correo); say(t('Si ese correo tiene cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también spam.'), true); });
    },

    reenviar() {
      const correo = reenvioEmail || R.querySelector('[name="correo"]').value.trim();
      run(async () => { await reenviar(correo); say(t('Te reenviamos el correo. Revisa también spam.'), true); cooldown(60); });
    },

    aceptar(_el, _p, api) {
      const c = R.querySelector('#termsCheck');
      if (c && !c.checked) return;
      run(async () => { await aceptarTerminos(); vista = 'elegir'; api.goTab('home'); });
    },

    rechazar(_el, _p, api) {
      run(async () => { await salir(); vista = 'elegir'; api.goTab('auth', { modo: 'registro' }); });
    },

    guardarClave(_el, _p, api) {
      const a = R.querySelector('#newPass').value, b = R.querySelector('#newPass2').value;
      if (a.length < 8) return say(t('La contraseña necesita al menos 8 caracteres.'));
      if (a !== b) return say(t('Las contraseñas no coinciden.'));
      run(async () => {
        await nuevaClave(a);
        limpiarRecuperacion();
        const u = await sesionActual();
        if (u) { const estado = await entrar(u); if (estado === 'terminos') { irATerminos(); return; } vista = 'elegir'; api.goTab('home'); }
        else mostrar('elegir');
      });
    },
  },
};
