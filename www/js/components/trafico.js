// BLOQUE DE TRÁFICO / HORA PUNTA
import { t } from '../core/i18n.js';
import { ic } from '../core/dom.js';
import { rushChart } from './rush-chart.js';
import { estado, mejoresHoras, franjas, horaTexto } from '../services/rush.service.js';
import { tipoDia } from '../services/clock.js';
import { isDark } from '../core/theme.js';

const DIAS = [['lunvie', 'Lun–Vie'], ['sabado', 'Sábado'], ['domingo', 'Domingo']];

export function traficoHtml({ dia = tipoDia(), tabla = false } = {}) {
  const e = estado();
  const colores = isDark() ? ['#5B8DCB', '#8DBBF2', '#E8F2FF'] : ['#6A98D1', '#2F6DB8', '#0F2D57'];
  return `
    <div class="segmented" style="margin:12px 0 0">${DIAS.map(([id, n]) => `<button class="segmented__opt ${id === dia ? 'is-active' : ''}" data-action="dia" data-params='{"dia":"${id}"}'>${t(n)}</button>`).join('')}</div>
    <div class="rush__now"><div class="rush__now-icon">${ic(e.activa ? 'traffic-lights' : 'car')}</div>
      <div><b>${e.activa ? t('Ahora: tráfico pesado') : e.nivel >= 45 ? t('Ahora: concurrido') : t('Ahora: tráfico fluido')}</b>
      <span>${e.activa ? t('Baja a “concurrido” pasadas las {h}', { h: horaTexto(e.hasta) }) : t('Sin hora punta en este momento')}</span></div></div>
    <div id="grafico">${rushChart(dia)}</div>
    <div class="rush__legend"><span><i style="background:${colores[0]}"></i>${t('Fluido')}</span><span><i style="background:${colores[1]}"></i>${t('Concurrido')}</span><span><i style="background:${colores[2]}"></i>${t('Muy congestionado')}</span>
      <button class="link-btn" style="margin-left:auto" data-action="tabla" aria-expanded="${!!tabla}">${t('Ver tabla')}</button></div>
    ${tabla ? `<table class="rush__table">${franjas(dia).map(([a, b, n]) => `<tr><td>${horaTexto(a)} – ${horaTexto(b)}</td><td>${n >= 70 ? t('Muy congestionado') : t('Concurrido')}</td></tr>`).join('')}</table>` : ''}
    <div class="rush__tip">${ic('circle-check')}<div><b>${t('Mejores horas para viajar')}</b><span>${t(mejoresHoras())}</span></div></div>
    <div class="rush__tip">${ic('info-circle')}<div><span>${t('Patrón típico de la semana, no en vivo. Se ajusta con los avisos de la comunidad.')}</span></div></div>`;
}
