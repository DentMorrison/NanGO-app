// ================================================================
// SERVICIO DE CUENTA (registro, ingreso, Google, invitado)
// Conectado a Supabase (correo + contraseña, Google, recuperación).
// Si no hay internet o falta configuración, cae en MODO DEMO y guarda
// la sesión en este teléfono, para que la app siga funcionando.
// ================================================================
import { store, datosPersonalesVacios } from '../core/store.js';
import { cliente, SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { sincronizarUsuario, empujarPerfil } from './sync.service.js';
import { cargarAvisos } from './alerts.service.js';

/* ---------- 1. CONFIGURACIÓN ----------
   La URL y la clave publicable viven en js/services/supabase.js.
   Si se dejan vacías, la cuenta funciona en MODO DEMO. */
export { SUPABASE_URL, SUPABASE_KEY };

export const TERMS_VERSION = '1.0';   // súbela (1.1, 2.0…) cuando cambien los términos

export const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());

/** Baja o actualiza los datos de la cuenta (favoritos, historial, avisos). */
async function sincronizar() {
  try { await sincronizarUsuario(); } catch { /* sin conexión */ }
  try { await cargarAvisos(); } catch { /* se queda el ejemplo local */ }
}

/* ---------- 3. MODO DEMO (sin servidor) ---------- */
const demo = {
  get: () => { try { return JSON.parse(localStorage.getItem('nango_user') || 'null'); } catch { return null; } },
  set: (u) => { try { localStorage.setItem('nango_user', JSON.stringify(u)); } catch { /* sin almacenamiento */ } },
  clear: () => { try { localStorage.removeItem('nango_user'); } catch { /* sin almacenamiento */ } },
};

/* ---------- 4. ESTADO DE LA CUENTA ---------- */
let pendiente = null;       // usuario autenticado que todavía no acepta los términos
let recuperando = false;    // venimos de un enlace "recuperar contraseña"

export const terminosPendientes = () => pendiente;
export const enRecuperacion = () => recuperando
  || /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);

/** Traduce el usuario de Supabase al perfil que usa la app. */
function perfilDe(u) {
  const nombre = u?.user_metadata?.nombre || u?.nombre || (u?.email ? u.email.split('@')[0] : '');
  const google = u?.app_metadata?.provider === 'google' || u?.proveedor === 'google';
  return { nombre, correo: u?.email || u?.correo || '', proveedor: google ? 'google' : 'correo' };
}
function guardarSesion(u) { store.set({ user: perfilDe(u), guest: false }); }

/* ---------- 5. SESIÓN Y TÉRMINOS ---------- */
async function aceptoTerminos(u) {
  const c = await cliente();
  if (!c) return demo.get()?.termsVersion === TERMS_VERSION;
  const { data, error } = await c.from('profiles').select('terms_version').eq('id', u.id).maybeSingle();
  if (error) throw error;
  return data?.terms_version === TERMS_VERSION;
}

/** Deja entrar al usuario. Devuelve 'ok' si entra o 'terminos' si debe aceptarlos. */
export async function entrar(u) {
  if (await aceptoTerminos(u)) {
    pendiente = null;
    guardarSesion(u);
    await sincronizar();
    return 'ok';
  }
  pendiente = u;
  return 'terminos';
}

/** Al abrir la app: restaura la sesión guardada (Supabase o demo). */
export async function iniciar() {
  const c = await cliente();
  if (!c) { const u = demo.get(); if (u) guardarSesion(u); return; }
  if (enRecuperacion()) { recuperando = true; return; }   // el enlace manda a "Nueva contraseña"
  try {
    const { data } = await c.auth.getSession();
    if (data.session?.user) await entrar(data.session.user);
    else await cargarAvisos();      // invitados: solo mirar los avisos de la comunidad
  } catch { /* sin conexión: seguimos sin sesión */ }
}

export async function sesionActual() {
  const c = await cliente();
  if (!c) return demo.get();
  const { data } = await c.auth.getSession();
  return data.session?.user ?? null;
}

export function limpiarRecuperacion() {
  recuperando = false;
  if (/access_token|type=recovery|error_description/.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

export function errorEnUrl() {
  const p = new URLSearchParams(location.hash.slice(1) || location.search);
  return p.get('error_description') || '';
}

/** Escucha cambios de sesión (por ejemplo, el enlace de recuperación). */
export async function observar(cb) {
  const c = await cliente();
  if (!c) return;
  c.auth.onAuthStateChange((ev, s) => cb(ev, s));
}

/* ---------- 6. REGISTRO E INGRESO ---------- */
export async function registrar({ nombre, correo, clave }) {
  const c = await cliente();
  if (!c) {
    const u = { id: crypto.randomUUID(), nombre: nombre.trim(), email: correo.trim(), guest: false, termsVersion: TERMS_VERSION };
    demo.set(u); guardarSesion(u); pendiente = null;
    return { estado: 'entrar' };
  }
  const { data, error } = await c.auth.signUp({
    email: correo.trim(), password: clave,
    options: { data: { nombre: nombre.trim(), terms_version: TERMS_VERSION } },
  });
  if (error) throw error;
  if (!data.session) return { estado: 'confirmar', correo: correo.trim() };   // debe confirmar por correo
  return { estado: (await entrar(data.user)) === 'ok' ? 'entrar' : 'terminos' };
}

export async function ingresar({ correo, clave }) {
  const c = await cliente();
  if (!c) {
    const u = demo.get();
    if (!u || u.email !== correo.trim()) throw new Error('Invalid login credentials');
    guardarSesion(u); pendiente = null;
    return { estado: 'entrar' };
  }
  const { data, error } = await c.auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (error) throw error;
  return { estado: (await entrar(data.user)) === 'ok' ? 'entrar' : 'terminos' };
}

export async function ingresarConGoogle() {
  const c = await cliente();
  if (!c) throw new Error('no-supabase');
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
  if (error) throw error;
}

export function continuarComoInvitado() { pendiente = null; store.set({ user: null, guest: true }); }

export async function salir() {
  const c = await cliente();
  pendiente = null;
  // Antes de salir, se sube lo último a la cuenta (si hay internet): al salir se borra de este teléfono.
  const s = store.get();
  if (s.user && !s.guest) await empujarPerfil({ favoriteLines: s.favoriteLines, shortcuts: s.shortcuts, history: s.history, trips: s.viajesCompletados });
  if (c) { try { await c.auth.signOut(); } catch { /* ya estaba fuera */ } } else demo.clear();
  // Lo personal se borra de este teléfono para que la siguiente persona no lo vea ni lo suba a su cuenta.
  store.set({ user: null, guest: false, ...datosPersonalesVacios() });
}

/* ---------- 7. CORREO DE CONFIRMACIÓN Y CONTRASEÑA ---------- */
export async function reenviar(correo) {
  const c = await cliente();
  if (!c) return;
  const { error } = await c.auth.resend({ type: 'signup', email: correo, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function olvide(correo) {
  const c = await cliente();
  if (!c) return;
  const { error } = await c.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}

export async function nuevaClave(clave) {
  const c = await cliente();
  if (!c) return;
  const { error } = await c.auth.updateUser({ password: clave });
  if (error) throw error;
}

/* ---------- 7b. EDITAR PERFIL ---------- */
/** Cambia el nombre de la cuenta (Supabase o modo demo) y lo refleja en la app. */
export async function actualizarNombre(nombre) {
  const limpio = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (limpio.length < 2 || limpio.length > 40) throw new Error('nombre-invalido');
  const actual = store.get().user;
  if (!actual) throw new Error('sin-sesion');
  const c = await cliente();
  if (!c) {
    const d = demo.get();
    if (d) { d.nombre = limpio; demo.set(d); }
  } else {
    // El nombre vive en los datos de la cuenta (user_metadata) y también en la tabla profiles.
    const { data, error } = await c.auth.updateUser({ data: { nombre: limpio } });
    if (error) throw error;
    try {
      await c.from('profiles').update({ nombre: limpio, updated_at: new Date().toISOString() }).eq('id', data.user.id);
    } catch { /* el nombre de la cuenta ya cambió; profiles se sincroniza en el próximo ingreso */ }
  }
  store.set({ user: { ...actual, nombre: limpio } });
  return limpio;
}

/* ---------- 8. TÉRMINOS Y ELIMINAR CUENTA ---------- */
export async function aceptarTerminos() {
  const u = pendiente;
  const c = await cliente();
  if (!c) {
    const d = demo.get();
    if (d) { d.termsVersion = TERMS_VERSION; demo.set(d); }
    if (u) guardarSesion(u);
    pendiente = null;
    return;
  }
  const { error } = await c.rpc('accept_terms', { p_version: TERMS_VERSION });
  if (error) throw error;
  if (u) guardarSesion(u);
  pendiente = null;
}

export async function eliminarCuenta() {
  const c = await cliente();
  pendiente = null;
  if (!c) { demo.clear(); store.set({ user: null, guest: false, ...datosPersonalesVacios() }); return; }
  const { error } = await c.rpc('delete_my_account');
  if (error) throw error;
  try { await c.auth.signOut(); } catch { /* sesión ya cerrada */ }
  store.set({ user: null, guest: false, ...datosPersonalesVacios() });
}

/* ---------- 9. MENSAJES DE ERROR EN ESPAÑOL (la pantalla los traduce) ---------- */
export function mensajeError(e) {
  const m = String(e?.message || '').toLowerCase();
  if (m.includes('no-supabase')) return 'Configura Supabase para usar Google';
  if (m.includes('already registered')) return 'Ese correo ya tiene cuenta. Toca “Inicia sesión”.';
  if (m.includes('email not confirmed')) return 'Aún no confirmaste tu correo. Revisa tu bandeja de entrada y la carpeta de spam.';
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un minuto.';
  if (m.includes('only request this after')) return 'Espera un minuto antes de pedir otro correo.';
  if (m.includes('different from the old')) return 'La contraseña nueva debe ser distinta a la anterior.';
  if (m.includes('session missing')) return 'El enlace venció. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.';
  if (m.includes('permission denied') || m.includes('row-level security')) return 'No tienes permiso para hacer eso. Algunas acciones requieren una cuenta registrada.';
  if (m.includes('failed to fetch')) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  return e?.message || 'Algo salió mal. Intenta de nuevo.';
}

/* ---------- 10. COMPATIBILIDAD CON EL RESTO DE LA APP ---------- */
export const hayAcceso = () => { const s = store.get(); return !!s.user || s.guest; };
export const inicial = () => (store.get().user?.nombre || 'M').trim()[0].toUpperCase();
