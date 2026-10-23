// Editar perfil: el nombre se limpia, se valida (2 a 40 caracteres) y se refleja en la app.
import assert from 'node:assert/strict';
import { store } from '../js/core/store.js';
import { actualizarNombre } from '../js/services/auth.service.js';

store.set({ user: { nombre: 'Ana', correo: 'ana@correo.com', proveedor: 'correo' }, guest: false });
assert.equal(await actualizarNombre('  María   Quispe  '), 'María Quispe');
assert.equal(store.get().user.nombre, 'María Quispe');
assert.equal(store.get().user.correo, 'ana@correo.com');            // el correo no cambia
await assert.rejects(() => actualizarNombre('A'), /nombre-invalido/);
await assert.rejects(() => actualizarNombre('x'.repeat(41)), /nombre-invalido/);
assert.equal(store.get().user.nombre, 'María Quispe');                // un nombre inválido no cambia nada
store.set({ user: null });
await assert.rejects(() => actualizarNombre('Luis'), /sin-sesion/);   // los invitados no editan perfil
console.log('Todo en orden (editar perfil)');
