// Lógica de la Edge Function: solo enlaces de Google y seguimiento de redirecciones.
import assert from 'node:assert/strict';
import { permitido, expandir, sinConsentimiento } from '../supabase/functions/expandir-enlace/index.ts';

assert.equal(permitido('https://maps.app.goo.gl/Xk3pQ9'), true);
assert.equal(permitido('https://www.google.com/maps/place/X'), true);
assert.equal(permitido('http://maps.app.goo.gl/Xk3pQ9'), false);            // sin https
assert.equal(permitido('https://evil.com/?u=maps.app.goo.gl'), false);
assert.equal(permitido('https://goo.gl.evil.com/x'), false);                // dominio parecido
assert.equal(permitido('https://localhost/x'), false);
assert.equal(permitido('no es un enlace'), false);

assert.equal(
  sinConsentimiento('https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FX'),
  'https://www.google.com/maps/place/X');

// Simula: corto → consentimiento → largo
const FINAL = 'https://www.google.com/maps/place/X/data=!3d-15.49812!4d-70.13345';
const falso = async (url) => {
  const redir = (to) => ({ status: 302, headers: new Headers({ location: to }), body: null });
  if (url.startsWith('https://maps.app.goo.gl/')) return redir('https://consent.google.com/m?continue=' + encodeURIComponent(FINAL));
  return { status: 200, headers: new Headers(), body: null };
};
assert.equal(await expandir('https://maps.app.goo.gl/Xk3pQ9', falso), FINAL);

// Redirección hacia un sitio ajeno: se rechaza.
const malo = async () => ({ status: 302, headers: new Headers({ location: 'https://evil.com/robo' }), body: null });
assert.equal(await expandir('https://maps.app.goo.gl/Xk3pQ9', malo), null);

// Redirección infinita: se corta.
const bucle = async (u) => ({ status: 302, headers: new Headers({ location: u }), body: null });
assert.equal(await expandir('https://maps.app.goo.gl/a', bucle), null);

console.log('Todo en orden (expandir-enlace)');
