// ================================================================
// ESTADÍSTICAS DE LA CUENTA (Perfil)
//   · viajes completados: se cuentan en el teléfono (y se guardan en la cuenta).
//   · avisos que publicaste y personas que los confirmaron: los calcula Supabase con la
//     función mis_estadisticas() (ver supabase/schema.sql), porque los votos de otras personas
//     no se pueden leer desde la app. Sin internet o sin la función se muestra "—", nunca un número inventado.
// ================================================================
import { cliente } from './supabase.js';
import { store } from '../core/store.js';

let ultima = { clave: '', cuando: 0 };

/** Pide las cifras a Supabase. Devuelve true solo si cambiaron (para repintar el Perfil). */
export async function cargarEstadisticas() {
  const s = store.get();
  if (!s.user || s.guest) return false;
  const clave = `${s.user.correo || ''}|${s.user.nombre || ''}`;
  if (ultima.clave === clave && Date.now() - ultima.cuando < 20000) return false;   // evita pedirlas en cada repintado
  ultima = { clave, cuando: Date.now() };
  const c = await cliente();
  if (!c) return false;
  try {
    const { data, error } = await c.rpc('mis_estadisticas');
    if (error || !data) return false;
    const nuevas = { avisos: Number(data.avisos) || 0, confirmaron: Number(data.confirmaron) || 0 };
    const antes = store.get().stats;
    if (antes && antes.avisos === nuevas.avisos && antes.confirmaron === nuevas.confirmaron) return false;
    store.set({ stats: nuevas });
    return true;
  } catch { return false; }                 // sin internet
}
