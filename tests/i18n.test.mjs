// Cada traducción debe conservar las variables {n}, {lugar}… del texto en español,
// y el idioma elegido debe cambiar el texto que devuelve t().
import assert from 'node:assert/strict';
import en from '../js/i18n/en.js';
import qu from '../js/i18n/qu.js';
import ay from '../js/i18n/ay.js';
import { store } from '../js/core/store.js';
import { t } from '../js/core/i18n.js';

const vars = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join();
for (const [nombre, dic] of Object.entries({ en, qu, ay })) {
  for (const [es, tr] of Object.entries(dic)) {
    assert.ok(String(tr).trim(), `${nombre}: traducción vacía para "${es}"`);
    assert.equal(vars(tr), vars(es), `${nombre}: variables distintas en "${es}"`);
  }
}
store.set({ lang: 'es' }); assert.equal(t('hace {n} min', { n: 5 }), 'hace 5 min');
store.set({ lang: 'en' }); assert.equal(t('hace {n} min', { n: 5 }), '5 minutes ago');
store.set({ lang: 'qu' }); assert.equal(t('hace {n} min', { n: 5 }), '5 minutumanta ñawpaq');
store.set({ lang: 'ay' }); assert.equal(t('hace {n} min', { n: 5 }), '5 minutunaka nayra');
store.set({ lang: 'es' });
console.log('Todo en orden (traducciones)');
