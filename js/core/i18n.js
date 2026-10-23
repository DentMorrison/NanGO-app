// ================================================================
// TRADUCCIONES
//  completar los diccionarios en js/i18n/en.js, qu.js (quechua) y ay.js (aymara).
// ================================================================
import { store } from './store.js';
import en from '../i18n/en.js';
import qu from '../i18n/qu.js';
import ay from '../i18n/ay.js';

const DICCIONARIOS = { en, qu, ay };

export const IDIOMAS = [
  { id: 'es', nombre: 'Español', sub: 'Español' },
  { id: 'en', nombre: 'English', sub: 'Inglés' },
  { id: 'qu', nombre: 'Runasimi', sub: 'Quechua', pendiente: true },
  { id: 'ay', nombre: 'Aymar aru', sub: 'Aymara', pendiente: true },
];

/** t('Texto en español', { n: 3 }) -> reemplaza {n} */
export function t(texto, vars) {
  const dic = DICCIONARIOS[store.get().lang];
  let out = (dic && dic[texto]) || texto;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return out;
}

export const langCode = () => store.get().lang.toUpperCase();
