// Piezas de interfaz reutilizables (devuelven HTML). Los estilos están en css/02-components.css.
import { esc, ic } from '../core/dom.js';
import { t, langCode } from '../core/i18n.js';
import { getLinea } from '../data/lineas.js';

/** Barra superior azul con el lettering de ÑanGO y el idioma. */
export const appbar = () => `
  <header class="appbar">
    <div class="appbar__row">
      <img class="appbar__logo" src="assets/img/brand/wordmark.png" alt="ÑanGO">
      <span class="appbar__spacer"></span>
      <button class="appbar__lang" data-go="language" aria-label="${t('Idioma')}">${ic('language')}${langCode()}</button>
    </div>
  </header><div class="stripe"></div>`;

/** Barra con botón volver para pantallas internas. */
export const subbar = (titulo, sub = '', derecha = '') => `
  <div class="subbar">
    <button class="subbar__back" data-back aria-label="${t('Volver')}">${ic('arrow-left')}</button>
    <div class="grow"><h2 class="subbar__title">${t(titulo)}</h2>${sub ? `<div class="subbar__sub">${t(sub)}</div>` : ''}</div>
    ${derecha}
  </div>`;

/** Variables de color de una línea: style="${lineVars(l)}" */
export const lineVars = (l) => `--line:${l.color}`;

/** Insignia con el número de la línea. size: sm | md | lg | xl | '' */
export const lineBadge = (l, size = '') => `<span class="line-badge ${size ? `line-badge--${size}` : ''}" style="${lineVars(l)}" aria-label="${esc(l.nombre)}">${l.numero}</span>`;
export const lineDot = (l) => `<i class="line-dot" style="${lineVars(l)}"></i>`;

/** Botón de filtro (chip). */
export const chip = (texto, { active = false, count, attrs = '', icon = '' } = {}) =>
  `<button class="chip ${active ? 'is-active' : ''}" ${attrs}>${icon ? ic(icon) : ''}${esc(texto)}${count !== undefined ? ` <b class="chip__count">${count}</b>` : ''}</button>`;

/** Interruptor accesible. */
export const toggle = (on, attrs = '') => `<button class="toggle ${on ? 'is-on' : ''}" role="switch" aria-checked="${on}" ${attrs}></button>`;

/** Fila de lista con ícono, título y subtítulo. */
export const item = ({ icon, title, sub = '', value = '', chevron = true, attrs = '', trailing = '', ok = false }) => `
  <${attrs ? 'button' : 'div'} class="item" ${attrs}>
    ${icon ? `<i class="item__icon ti ti-${icon}" aria-hidden="true"></i>` : ''}
    <div class="item__body"><div class="item__title">${title}</div>${sub ? `<div class="item__sub ${ok ? 'item__sub--ok' : ''}">${sub}</div>` : ''}</div>
    ${value ? `<span class="item__value">${value}${chevron ? ic('chevron-right') : ''}</span>` : (chevron && attrs ? `<i class="item__chevron ti ti-chevron-right" aria-hidden="true"></i>` : '')}
    ${trailing}
  </${attrs ? 'button' : 'div'}>`;

/** Nombre de línea por id (con respaldo). */
export const lineaPorId = (id) => getLinea(id);
