// Favoritos, historial y atajos.
// Con cuenta, se sincronizan con Supabase (ver sync.service.js).
// Sin cuenta o sin conexión, quedan guardados en este teléfono.
import { store } from '../core/store.js';
import { empujarPerfil } from './sync.service.js';

export const esLineaFavorita = (id) => store.get().favoriteLines.includes(id);

export function alternarLinea(id) {
  const s = store.get();
  const favoriteLines = s.favoriteLines.includes(id) ? s.favoriteLines.filter((x) => x !== id) : [...s.favoriteLines, id];
  store.set({ favoriteLines });
  empujarPerfil({ favoriteLines });
  return favoriteLines.includes(id);
}

export function agregarHistorial({ o, d, lineaId }) {
  const h = [{ o, d, lineaId, when: 'hoy', ts: Date.now() }, ...store.get().history.filter((x) => !(x.o === o && x.d === d))].slice(0, 20);
  store.set({ history: h });
  empujarPerfil({ history: h });
}

export function borrarHistorial() {
  store.set({ history: [] });
  empujarPerfil({ history: [] });
}

export function guardarAtajo(id, place) {
  const shortcuts = store.get().shortcuts.map((s) => (s.id === id ? { ...s, place } : s));
  store.set({ shortcuts });
  empujarPerfil({ shortcuts });
}
