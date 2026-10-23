// Contacto: enlaces de WhatsApp y correo con el mensaje ya escrito.
import assert from 'node:assert/strict';
import { enlaceWhatsApp, enlaceCorreo, mensaje } from '../js/services/soporte.service.js';
import { CONTACTO, VERSION } from '../js/core/config.js';
import en from '../js/i18n/en.js';

assert.equal(CONTACTO.whatsapp, '51949453415');
assert.match(CONTACTO.whatsapp, /^51\d{9}$/);                       // Perú: 51 + 9 dígitos
assert.match(CONTACTO.correo, /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/);

const ayuda = mensaje('ayuda');
const wa = enlaceWhatsApp(ayuda.texto);
assert.ok(wa.startsWith('https://wa.me/51949453415?text='));
assert.equal(decodeURIComponent(wa.split('?text=')[1]), 'Hola ÑanGO, necesito ayuda con: ');

const prob = mensaje('problema', 'qu');
assert.ok(prob.texto.includes(`ÑanGO v${VERSION}`) && prob.texto.includes('Idioma de la app: qu'));
const mail = enlaceCorreo(prob.asunto, prob.texto);
assert.ok(mail.startsWith(`mailto:${CONTACTO.correo}?subject=`));
assert.equal(decodeURIComponent(mail.split('subject=')[1].split('&body=')[0]), 'Problema en la app ÑanGO');
assert.ok(!mensaje('sugerencia').texto.includes('undefined'));

// Todo el texto de la pantalla de Ayuda tiene traducción al inglés.
for (const k of ['Correo', 'Preguntas frecuentes', '¿Cuánto dura un aviso?', '¿Funciona sin internet?', 'Reportar un problema de la app',
  'Sugerir un lugar o corregir una ruta', 'Enviar por WhatsApp', 'Enviar por correo', 'Copiar correo', 'Correo copiado']) assert.ok(en[k], `falta en inglés: ${k}`);
console.log('Todo en orden (soporte)');
