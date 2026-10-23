// ================================================================
// SINCRONIZACIÓN DE DATOS DE LA CUENTA (Supabase)
// Favoritos, atajos (lugares guardados) e historial se guardan en la
// tabla `profiles` de la cuenta y se recuperan al ingresar en otro
// teléfono. Sin cuenta o sin conexión, todo sigue en este dispositivo.
// ================================================================
import { cliente, usuarioNube } from './supabase.js';
import { store } from '../core/store.js';

const hayCuenta = () => { const s = store.get(); return !!s.user && !s.guest; };

/**
 * Al ingresar: trae los datos de la cuenta a este teléfono.
 * Si la cuenta es nueva (vacía), sube lo que ya había en el teléfono.
 */
export async function sincronizarUsuario() {
  if (!hayCuenta()) return;
  const c = await cliente();
  if (!c) return;
  const u = await usuarioNube();
  if (!u) return;
  try {
    const pedir = (cols) => c.from('profiles').select(cols).eq('id', u.id).maybeSingle();
    let { data, error } = await pedir('favorite_lines, shortcuts, history, trips');
    if (error) ({ data, error } = await pedir('favorite_lines, shortcuts, history'));   // Supabase sin la columna trips todavía
    if (error || !data) return;

    const s = store.get();
    const viajesNube = data.trips || [];
    const vacio = !(data.favorite_lines || []).length && !(data.shortcuts || []).length && !(data.history || []).length && !viajesNube.length;
    if (vacio) {
      // Cuenta recién creada: sube lo que la persona ya tenía en el teléfono (como invitada).
      await empujarPerfil({ favoriteLines: s.favoriteLines, shortcuts: s.shortcuts, history: s.history, trips: s.viajesCompletados });
      return;
    }
    // Los viajes que solo estaban en este teléfono (antes de existir esta sincronización) se suben a la cuenta.
    const viajes = viajesNube.length ? viajesNube : s.viajesCompletados;
    if (!viajesNube.length && s.viajesCompletados.length) await empujarPerfil({ trips: s.viajesCompletados });
    store.set({
      favoriteLines: data.favorite_lines || [],
      shortcuts: (data.shortcuts || []).length ? data.shortcuts : s.shortcuts,
      history: data.history || [],
      viajesCompletados: viajes,
    });
  } catch { /* sin conexión: se queda lo local */ }
}

/** Sube a la cuenta los campos indicados (los que no vengan, no se tocan). */
export async function empujarPerfil({ favoriteLines, shortcuts, history, trips } = {}) {
  if (!hayCuenta()) return;
  const c = await cliente();
  if (!c) return;
  const u = await usuarioNube();
  if (!u) return;
  const fila = { id: u.id, updated_at: new Date().toISOString() };
  if (favoriteLines !== undefined) fila.favorite_lines = favoriteLines;
  if (shortcuts !== undefined) fila.shortcuts = shortcuts;
  if (history !== undefined) fila.history = history;
  if (trips !== undefined) fila.trips = trips;
  try {
    const { error } = await c.from('profiles').upsert(fila, { onConflict: 'id' });
    if (error && trips !== undefined) {              // Supabase sin la columna trips: se suben al menos los demás datos
      delete fila.trips;
      await c.from('profiles').upsert(fila, { onConflict: 'id' });
    }
  } catch { /* sin conexión */ }
}

export const tieneCuenta = hayCuenta;
