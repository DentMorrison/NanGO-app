// ================================================================
// CLIENTE COMPARTIDO DE SUPABASE
// Un solo cliente para toda la app (cuenta, avisos, favoritos…).
// Si falta configuración o no hay internet, `cliente()` devuelve null
// y cada servicio usa su respaldo local (datos en el teléfono).
// ================================================================

/* Crea un proyecto gratis en supabase.com y pega aquí tus datos.
   Si los dejas vacíos, todo funciona en modo local. */
export const SUPABASE_URL = 'https://mzbaygpbfhxdeomumcxz.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_X8LDgIOp1EikdF82PbVcnw_8TxBduk8';

export const hayNube = () => !!SUPABASE_URL && !!SUPABASE_KEY;

/** Carga un script clásico y espera a que termine. */
const cargarScript = (src) => new Promise((ok, mal) => {
  const el = document.createElement('script');
  el.src = src; el.onload = ok; el.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
  document.head.append(el);
});

/** Primero la copia local (assets/vendor/supabase, ver npm run vendor); si no está, internet. */
async function crearCliente() {
  try {
    if (!window.supabase) await cargarScript(new URL('../../assets/vendor/supabase/supabase.js', import.meta.url).href);
    if (window.supabase?.createClient) return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch { /* sin copia local: se usa internet */ }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

let db = null;
let cargando = null;

/** Devuelve el cliente de Supabase (o null si no está disponible). */
export async function cliente() {
  if (db) return db;
  if (!hayNube()) return null;
  if (!cargando) {
    cargando = (async () => {
      try {
        db = await crearCliente();
      } catch { db = null; }        // sin internet: modo local
      return db;
    })();
  }
  return cargando;
}

/** El usuario de la sesión actual (o null). Lee la sesión local, sin ir a la red. */
export async function usuarioNube() {
  const c = await cliente();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data?.session?.user ?? null;
  } catch { return null; }
}
