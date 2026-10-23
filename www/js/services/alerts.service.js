// ================================================================
// SERVICIO DE AVISOS DE LA COMUNIDAD (conectado a Supabase)
// - Cualquiera puede VER los avisos publicados.
// - REPORTAR y VOTAR requiere una cuenta registrada.
// - Ya no hay avisos de ejemplo: sin avisos reales se muestra "Todo tranquilo".
//
// Moderación (la aplica Supabase con un disparador, ver supabase/schema.sql):
// 1. Un aviso nuevo nace 'pendiente' con 1 confirmación (quien lo crea).
// 2. Con 2 confirmaciones pasa a 'publicado'.
// 3. Con 5 votos de "Ya no" se da de baja ('invalido').
// 4. Límite anti-spam: máximo 5 avisos por hora por persona (y 20 al día); lo aplica Supabase y la app
//    lo avisa antes de enviar. Un aviso repetido (mismo tipo y línea en 30 min) también se rechaza.
// 5. Los avisos hechos sin conexión se guardan en el teléfono y se suben solos al volver la red.
// 6. Cada aviso VENCE solo: las horas por tipo están en la tabla alert_vigencia de Supabase
//    (se editan en Table Editor, ver supabase/schema.sql). Un aviso vencido ya no se muestra.
//    Como respaldo, si la nube no manda fecha de vencimiento, la app la calcula con las
//    mismas horas (VIGENCIA_HORAS), así ningún aviso queda "inmortal".
// ================================================================
import { TIPOS_AVISO } from '../data/avisos.js';
import { store } from '../core/store.js';
import { t } from '../core/i18n.js';
import { cliente, usuarioNube } from './supabase.js';
import { toast } from '../components/toast.js';

/** Horas que dura un aviso sin confirmar; debe coincidir con la fila 'pendiente' de alert_vigencia. */
const PENDIENTE_HORAS = 2;

/** Respaldo local de la tabla alert_vigencia (mantenla igual que en Supabase). */
const VIGENCIA_HORAS = { trafico: 3, accidente: 4, lluvia: 6, paro: 24, desvio: 48, tarifa: 168 };
const VIGENCIA_DEFECTO = 24;

/** Avisos que una persona puede enviar por hora; debe coincidir con limitar_reportes() de supabase/schema.sql. */
const LIMITE_POR_HORA = 5;
export const LIMITE_AVISOS_HORA = LIMITE_POR_HORA;
const HORA_MS = 3600000;

/** Cada cuánto se revisan los avisos vencidos mientras la app está abierta. */
const REVISION_MS = 60 * 1000;

export const tipoDe = (id) => TIPOS_AVISO.find((t) => t.id === id);

/** ¿La persona tiene cuenta? (los invitados solo miran). */
export const puedeAportar = () => { const s = store.get(); return !!s.user && !s.guest; };

/** Avisos en memoria (bajados de Supabase). Sin conexión ni avisos guardados: lista vacía. */
const fuente = () => store.get().alerts || [];
const buscar = (id) => fuente().find((a) => a.id === id);

/** ¿El aviso ya venció? (sin fecha = no vence; solo ocurre si algo no trae vencimiento). */
const vencido = (a) => !!a.expira && new Date(a.expira).getTime() <= Date.now();

/** Mensaje en pantalla sin romper nada si aún no hay interfaz (pruebas, arranque). */
const avisar = (texto) => { try { toast(texto); } catch { /* sin pantalla */ } };

/** Marcas de tiempo de los avisos que esta persona envió en la última hora. */
const recientes = () => (store.get().misReportes || []).filter((ts) => Date.now() - ts < HORA_MS);

/** ¿Puede enviar otro aviso ahora? Si no, cuántos minutos faltan para el siguiente. */
export function puedeReportar() {
  const r = recientes();
  if (r.length < LIMITE_POR_HORA) return { ok: true, esperaMin: 0 };
  const libera = Math.min(...r) + HORA_MS;
  return { ok: false, esperaMin: Math.max(1, Math.ceil((libera - Date.now()) / 60000)) };
}

const quitar = (id) => store.set({ alerts: fuente().filter((a) => a.id !== id) });

/** Vencimiento calculado en el teléfono: fecha de creación + horas según el tipo. */
const estimarExpira = (tipo, creadoIso) => {
  const horas = VIGENCIA_HORAS[tipo] ?? VIGENCIA_DEFECTO;
  return new Date(new Date(creadoIso).getTime() + horas * 3600000).toISOString();
};

/** Avisos publicados, filtrados por línea y tipo. */
export function listar({ soloMisLineas = true, tipo = null } = {}) {
  const mias = store.get().favoriteLines;
  return fuente()
    // FILTRO DE ESTADO: 'publicado'. También mostramos los 'pendiente' para poder votarlos.
    .filter((a) => a.estado === 'publicado' || a.estado === 'pendiente')
    // VIGENCIA: los avisos vencidos no se muestran
    .filter((a) => !vencido(a))
    // FILTRO DE LÍNEAS FAVORITAS
    .filter((a) => !soloMisLineas || mias.includes(a.lineaId))
    // FILTRO POR TIPO (ej. "Desvíos" o "Tráfico")
    .filter((a) => !tipo || a.tipo === tipo);
}

export const obtener = (id) => buscar(id);
export const votoDe = (id) => store.get().votes[id] || null;

/** Reloj relativo para los avisos que llegan de la nube. */
export function haceDe(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return t('Ahora');
  if (min < 60) return t('hace {n} min', { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t('hace {n} h', { n: h });
  return t('hace {n} días', { n: Math.round(h / 24) });
}

/** Quita de la memoria (y del almacenamiento del teléfono) los avisos vencidos y refresca "hace…".
 *  Devuelve true si algo cambió, para saber si hay que repintar la pantalla. */
export function podarVencidos() {
  const actuales = store.get().alerts;
  if (!actuales?.length) return false;
  const vigentes = actuales.filter((a) => !vencido(a));
  const cambio = vigentes.length !== actuales.length;
  store.set({
    alerts: vigentes.map((a) => (a.ts ? { ...a, hace: haceDe(a.ts) } : a)),
  });
  return cambio;
}

let reloj = null;
/** Mientras la app está abierta, revisa cada minuto los avisos vencidos y repinta Avisos/Inicio.
 *  Llámala una sola vez al arrancar (ver main.js). */
export function vigilarVencimientos() {
  if (reloj) return;
  // Al volver la conexión: se suben los avisos guardados sin red y se bajan los nuevos.
  if (typeof window !== 'undefined') window.addEventListener('online', () => { cargarAvisos(); });
  reloj = setInterval(async () => {
    podarVencidos();
    // No repintamos si hay una hoja abierta (p. ej. el formulario de reporte) para no borrar lo escrito.
    if (typeof document === 'undefined' || document.querySelector('.modal-sheet')) return;
    try {
      const { current, api } = await import('../core/router.js');
      if (['alerts', 'home'].includes(current()?.name)) api.rerender();
    } catch { /* sin pantalla todavía */ }
  }, REVISION_MS);
}

/** Baja los avisos de la comunidad y los votos de esta persona. */
export async function cargarAvisos() {
  const c = await cliente();
  if (!c) { podarVencidos(); return; }   // sin conexión: se muestran los últimos guardados que sigan vigentes
  try {
    await subirPendientes();             // primero los avisos hechos sin conexión
    const COLUMNAS = 'id,tipo,linea_id,titulo,texto,confirmaciones,rechazos,estado,created_at';
    const pedir = (conVigencia) => {
      let q = c.from('alerts')
        .select(conVigencia ? `${COLUMNAS},expira_at` : COLUMNAS)
        .in('estado', ['publicado', 'pendiente']);
      if (conVigencia) q = q.or(`expira_at.is.null,expira_at.gt.${new Date().toISOString()}`);
      return q.order('created_at', { ascending: false }).limit(60);
    };
    let { data, error } = await pedir(true);
    if (error) ({ data, error } = await pedir(false));   // Supabase sin el script de vigencia: se calcula aquí
    if (error || !data) { podarVencidos(); return; }

    // Los reportes hechos sin conexión (id "local-…") siguen en el teléfono hasta que se suban.
    const locales = fuente().filter((a) => String(a.id).startsWith('local-') && !vencido(a));
    const nube = data
      .map((a) => ({
        id: a.id, tipo: a.tipo, lineaId: a.linea_id, titulo: a.titulo,
        texto: a.texto || '', hace: haceDe(a.created_at), ts: a.created_at,
        // Si la nube no trae vencimiento, se calcula: ningún aviso queda sin fecha.
        expira: a.expira_at || estimarExpira(a.tipo, a.created_at),
        confirmaciones: a.confirmaciones, rechazos: a.rechazos || 0, estado: a.estado,
      }))
      .filter((a) => !vencido(a));
    // Se guarda SIEMPRE, aunque llegue vacío: así los avisos que vencieron en la nube desaparecen aquí.
    store.set({ alerts: [...locales, ...nube] });

    const u = await usuarioNube();
    if (u) {
      const { data: votos } = await c.from('alert_votes').select('alert_id,voto').eq('user_id', u.id);
      const votes = {};
      (votos || []).forEach((v) => { votes[v.alert_id] = v.voto; });
      store.set({ votes });
    }
  } catch { podarVencidos(); /* sin conexión: quedan los guardados que sigan vigentes */ }
}

/** Avisos que se están subiendo ahora mismo (evita subir el mismo dos veces). */
const subiendo = new Set();

const RECHAZOS = {
  'limite-reportes': 'Llegaste al límite de avisos. Intenta de nuevo más tarde.',
  'aviso-duplicado': 'Ya reportaste esto hace poco.',
};

/** Sube un aviso del teléfono a Supabase.
 *  Devuelve { estado: 'ok', id } | { estado: 'rechazado', motivo } | { estado: 'pendiente' } (sin cuenta, sin red o fallo temporal). */
async function subir(aviso) {
  if (subiendo.has(aviso.id)) return { estado: 'pendiente' };
  subiendo.add(aviso.id);
  try {
    if (!puedeAportar()) return { estado: 'pendiente' };
    const c = await cliente();
    if (!c) return { estado: 'pendiente' };
    const u = await usuarioNube();
    if (!u) return { estado: 'pendiente' };
    const { data, error } = await c.from('alerts').insert({
      user_id: u.id, tipo: aviso.tipo, linea_id: aviso.lineaId,
      donde: aviso.donde || null, titulo: aviso.titulo, texto: aviso.texto || null,
    }).select('id,created_at,expira_at').single();
    if (error || !data) {
      const m = String(error?.message || '').toLowerCase();
      const clave = Object.keys(RECHAZOS).find((k) => m.includes(k));
      return clave ? { estado: 'rechazado', motivo: RECHAZOS[clave] } : { estado: 'pendiente' };
    }
    store.set({
      alerts: fuente().map((a) => (a.id === aviso.id
        ? { ...a, id: data.id, ts: data.created_at, hace: haceDe(data.created_at), expira: data.expira_at || a.expira }
        : a)),
    });
    return { estado: 'ok', id: data.id };
  } catch {
    return { estado: 'pendiente' };       // sin conexión: queda en el teléfono
  } finally {
    subiendo.delete(aviso.id);
  }
}

/** Sube los avisos hechos sin conexión (id "local-…") que sigan vigentes. Se llama al volver la red. */
export async function subirPendientes() {
  if (!puedeAportar()) return;
  const pendientes = fuente().filter((a) => String(a.id).startsWith('local-') && !vencido(a));
  for (const a of pendientes) {
    const r = await subir(a);
    if (r.estado === 'rechazado') { quitar(a.id); avisar(t(r.motivo)); }
  }
}

/** Envía un reporte. Queda 'pendiente' hasta que otra persona lo confirme o el equipo lo apruebe.
 *  Devuelve null si se alcanzó el límite de avisos por hora (no se crea nada). */
export async function reportar({ tipo, lineaId, donde, nota }) {
  if (!puedeReportar().ok) return null;
  const nuevo = {
    id: `local-${Date.now()}`,
    tipo, lineaId, donde: donde || null,
    titulo: `${tipoDe(tipo).nombre}${donde ? ` en ${donde}` : ''}`,
    texto: nota || '',
    hace: t('Ahora'),
    ts: new Date().toISOString(),
    confirmaciones: 1, rechazos: 0, estado: 'pendiente',
    expira: new Date(Date.now() + PENDIENTE_HORAS * 3600000).toISOString(),
  };
  // 1) Aparece de inmediato en el teléfono (y cuenta para el límite por hora).
  store.set({ alerts: [nuevo, ...fuente()], misReportes: [...recientes(), Date.now()] });

  // 2) Se sube a la nube si hay cuenta y conexión; si no, queda guardado y se reintenta solo.
  const r = await subir(nuevo);
  if (r.estado === 'rechazado') { quitar(nuevo.id); avisar(t(r.motivo)); return null; }
  return r.estado === 'ok' ? { ...nuevo, id: r.id } : nuevo;
}

/** "Sigue así" (yes) o "Ya no" (no). Devuelve la cantidad actual de confirmaciones. */
export async function votar(id, voto) {
  // 1) Se aplica de inmediato en el teléfono (respuesta instantánea).
  const a = buscar(id);
  const votos = { ...store.get().votes };
  if (a) {
    if (votos[id] === voto) {
      delete votos[id];
      if (voto === 'yes') a.confirmaciones = Math.max(0, a.confirmaciones - 1);
      if (voto === 'no') a.rechazos = Math.max(0, (a.rechazos || 0) - 1);
    } else {
      if (voto === 'yes') a.confirmaciones++;
      if (voto === 'no') a.rechazos = (a.rechazos || 0) + 1;
      if (votos[id] === 'yes') a.confirmaciones = Math.max(0, a.confirmaciones - 1);
      if (votos[id] === 'no') a.rechazos = Math.max(0, (a.rechazos || 0) - 1);
      votos[id] = voto;
    }
    if (a.confirmaciones >= 2 && a.estado === 'pendiente') a.estado = 'publicado';
    if ((a.rechazos || 0) >= 5 && a.estado === 'publicado') a.estado = 'invalido';
    store.set({ votes: votos });
  }

  // 2) Se guarda en la nube si hay cuenta y el aviso es real (id de Supabase, no "local-…").
  if (!puedeAportar() || !/^[0-9a-f-]{36}$/i.test(String(id))) return a?.confirmaciones;
  const c = await cliente();
  if (!c) return a?.confirmaciones;
  try {
    const { data, error } = await c.rpc('votar_aviso', { p_alert: id, p_voto: voto });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      const actual = buscar(id);
      if (actual && row) {
        actual.confirmaciones = row.confirmaciones ?? actual.confirmaciones;
        actual.rechazos = row.rechazos ?? actual.rechazos;
        actual.estado = row.estado ?? actual.estado;
        // El servidor alarga el vencimiento cuando se publica o lo confirman otra vez: lo copiamos.
        actual.expira = row.expira_at ?? actual.expira;
        store.set({ alerts: fuente() });
      }
      return row?.confirmaciones ?? a?.confirmaciones;
    }
  } catch { /* sin conexión: queda el voto local */ }
  return a?.confirmaciones;
}

export function marcarLeidos() { store.set({ unreadAlerts: 0 }); }
