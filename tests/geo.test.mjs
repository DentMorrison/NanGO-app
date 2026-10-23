// Lectura de coordenadas desde enlaces de Google Maps y texto suelto.
import assert from 'node:assert/strict';
import { extraerCoordsDeTexto, esEnlaceCorto } from '../js/services/geo.js';

const PIN = { lat: -15.49812, lng: -70.13345 };

// Mismo lugar, pero con el centro de la pantalla en otro sitio (@): debe ganar el pin (!3d!4d).
const desdeBarra = 'https://www.google.com/maps/place/Plaza/@-15.4900,-70.1200,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-15.49812!4d-70.13345!16s%2Fg%2F1abc';
const desdeCompartir = 'https://www.google.com/maps/place/Plaza/@-15.5010,-70.1400,17z/data=!4m2!3m1!1s0x0!3d-15.49812!4d-70.13345';
assert.deepEqual(extraerCoordsDeTexto(desdeBarra), PIN);
assert.deepEqual(extraerCoordsDeTexto(desdeCompartir), PIN);

// Sin pin: se usa el parámetro q, y solo al final el centro de la vista (@).
assert.deepEqual(extraerCoordsDeTexto('https://maps.google.com/?q=-15.4985,-70.1333'), { lat: -15.4985, lng: -70.1333 });
assert.deepEqual(extraerCoordsDeTexto('https://www.google.com/maps/@-15.4985,-70.1333,17z'), { lat: -15.4985, lng: -70.1333 });

// Texto suelto, como "dirección (lat, lng)" que guarda la app.
assert.deepEqual(extraerCoordsDeTexto('Av. Circunvalación (-15.49812, -70.13345)'), PIN);
assert.deepEqual(extraerCoordsDeTexto('-15.49812, -70.13345'), PIN);

// Cosas que no son coordenadas.
assert.equal(extraerCoordsDeTexto(''), null);
assert.equal(extraerCoordsDeTexto('hola mundo'), null);
assert.equal(extraerCoordsDeTexto('https://www.google.com/maps/place/Plaza'), null);
assert.equal(extraerCoordsDeTexto('-95.1, -70.1'), null);          // latitud imposible

// Enlaces cortos: no se pueden leer sin servidor.
assert.equal(extraerCoordsDeTexto('https://maps.app.goo.gl/Xk3pQ9'), null);
assert.equal(esEnlaceCorto('https://maps.app.goo.gl/Xk3pQ9'), true);
assert.equal(esEnlaceCorto(desdeBarra), false);

console.log('Todo en orden (coordenadas)');
