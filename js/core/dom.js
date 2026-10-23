// Utilidades pequeñas para construir pantallas con plantillas de texto.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto que viene del usuario antes de ponerlo en HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Ícono de la librería Tabler: ic('home-2') */
export const ic = (name, cls = '') => `<i class="ti ti-${name} ${cls}" aria-hidden="true"></i>`;

/** Quita tildes y pasa a minúsculas (para buscar "plaza" y encontrar "Plaza"). */
export const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Genera un atributo para navegar: <button ${go('line-detail', { id })}> */
export const go = (screen, params) => `data-go="${screen}"${params ? ` data-params='${JSON.stringify(params).replace(/'/g, '&#39;')}'` : ''}`;

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Atributo data-params seguro (escapa comillas simples de nombres como O'Higgins). */
export const pr = (obj) => `data-params='${JSON.stringify(obj).replace(/'/g, '&#39;')}'`;
