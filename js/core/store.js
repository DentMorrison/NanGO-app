// ================================================================
// ESTADO GLOBAL DE LA APP
// Guarda las preferencias y los datos de la persona en el teléfono (localStorage).
// Para conectar un servidor, los servicios (js/services) leen y escriben aquí.
// ================================================================
const KEY = 'nango.v1';

const DEFAULTS = {
  // Sesión
  user: null,                 // { nombre, correo, proveedor: 'correo' | 'google' }
  guest: false,
  seenWelcome: false,

  // Preferencias
  lang: 'es',                 // es | en | qu | ay
  theme: 'auto',              // auto | light | dark
  textSize: 1,                // 0 pequeño · 1 normal · 2 grande · 3 muy grande
  highContrast: false,
  reduceMotion: false,
  wifiOnly: true,

  // Búsqueda actual
  origin: null,               // nombre de un lugar del catálogo
  destination: null,

  // Personal
  shortcuts: [],            // lugares guardados por la persona: [{ id, label, icon, place }, …]
  favoriteLines: ['linea-60', 'linea-20mayo'],
  favoritePlaces: [],
  history: [],              // historial de búsquedas
  viajesCompletados: [],    // historial de viajes
  downloads: { 'linea-60': 'ok', 'linea-15': 'ok', 'linea-20mayo': 'pending' },

  // Avisos
  votes: {},                  // { idAviso: 'yes' | 'no' }
  alerts: null,               // avisos de la comunidad bajados de Supabase (null = aún no se han bajado)
  unreadAlerts: 0,
  misReportes: [],            // marcas de tiempo (ms) de los avisos que envió esta persona (límite por hora)

  // Viaje en curso (modo viaje)
  trip: null,                 // { lineaId, index, startedAt }
};

/** Datos de la persona (no las preferencias de la app): se borran de este teléfono al cerrar sesión. */
export const datosPersonalesVacios = () => ({
  shortcuts: [], favoriteLines: [...DEFAULTS.favoriteLines], favoritePlaces: [], history: [],
  viajesCompletados: [], votes: {}, misReportes: [], stats: null, trip: null, origin: null, destination: null,
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    s.history = (s.history || []).filter((h) => h.ts);
    // Quita los atajos de ejemplo (Casa/UNAJ/Trabajo) que venían de versiones anteriores:
    // ahora "Mis lugares" empieza vacío y la persona agrega los suyos.
    s.shortcuts = (s.shortcuts || []).filter((x) => !['casa', 'unaj', 'trabajo'].includes(x.id));
    s.origin = null; s.destination = null;                  // cada vez que se abre la app, Buscar empieza limpio   // descarta los viajes de ejemplo de versiones anteriores
    return s;
  }
  catch { return { ...DEFAULTS }; }
}

export const store = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
    listeners.forEach((fn) => fn(state));
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() { localStorage.removeItem(KEY); state = { ...DEFAULTS }; listeners.forEach((fn) => fn(state)); },
};
