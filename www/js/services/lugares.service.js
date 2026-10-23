// ================================================================
// LUGARES GUARDADOS ("Mis lugares" en Inicio)
// Son los que la persona agrega con su propio nombre (Casa de mi abuela, Gym…).
// Cada uno: { id, label, icon, place }   ·  place = nombre del catálogo o "lat, lng" del mapa.
// Con cuenta se sincronizan con Supabase (ver sync.service.js); sin cuenta solo en este teléfono.
// ================================================================
import { store } from '../core/store.js';
import { empujarPerfil } from './sync.service.js';

/** Íconos para identificar un lugar de un vistazo. `icon` es el nombre de Tabler que se guarda. */
export const ICONOS_LUGAR = [
  { icon: 'home-2', label: 'Casa' },
  { icon: 'school', label: 'Estudio' },
  { icon: 'briefcase', label: 'Trabajo' },
  { icon: 'heart', label: 'Corazón' },
  { icon: 'star', label: 'Otro' },
];

const guardar = (shortcuts) => { store.set({ shortcuts }); empujarPerfil({ shortcuts }); };

export const listarLugares = () => store.get().shortcuts;
export const getLugarGuardado = (id) => store.get().shortcuts.find((x) => x.id === id) || null;

export function agregarLugar({ nombre, icon, place }) {
  const s = store.get();
  const id = `lugar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  guardar([...s.shortcuts, { id, label: nombre.trim(), icon, place }]);
  return id;
}

export function actualizarLugar(id, { nombre, icon, place }) {
  const s = store.get();
  guardar(s.shortcuts.map((x) => (x.id === id ? { ...x, label: nombre.trim(), icon, place } : x)));
}

export function eliminarLugar(id) {
  guardar(store.get().shortcuts.filter((x) => x.id !== id));
}
