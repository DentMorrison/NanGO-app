// Gráfico de congestión por hora (barras por media hora, de 5:00 a 22:00).
// la altura de la barra indica el nivel y hay tabla alternativa.
import { serie } from '../services/rush.service.js';
import { horaDecimal } from '../services/clock.js';
import { isDark } from '../core/theme.js';
import { t } from '../core/i18n.js';

export function rushChart(dia) {
  const W = 319, H = 168, base = 140, max = 100;
  const datos = serie(dia);
  const slot = W / datos.length, bw = slot - 2.5, r = 2.5;
  const dk = isDark();
  const color = (v) => (v >= 70 ? (dk ? '#E8F2FF' : '#0F2D57') : v >= 45 ? (dk ? '#8DBBF2' : '#2F6DB8') : (dk ? '#5B8DCB' : '#6A98D1'));
  const barras = datos.map(({ v }, i) => {
    const x = i * slot + (slot - bw) / 2, y = base - (v / 100) * max;
    return `<path class="rush__bar" style="animation-delay:${i * 8}ms" d="M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z" fill="${color(v)}"/>`;
  }).join('');
  const etiquetas = [[6, '6 AM'], [12, '12 PM'], [18, '6 PM'], [21, '9 PM']].map(([h, l]) => {
    const i = datos.findIndex((d) => d.h === h);
    return `<text x="${i * slot + slot / 2}" y="${base + 18}" text-anchor="middle" font-size="12" fill="var(--tx2)">${l}</text>`;
  }).join('');
  const hAhora = Math.min(21.5, Math.max(5, Math.round(horaDecimal() * 2) / 2));
  const ia = datos.findIndex((d) => d.h === hAhora);
  const ax = ia * slot + slot / 2;
  const marcaAhora = `<line x1="${ax}" y1="22" x2="${ax}" y2="${base}" stroke="var(--tx)" stroke-width="1.5" stroke-dasharray="3 3"/>
    <rect x="${ax - 38}" y="0" width="76" height="20" rx="10" fill="var(--tx)"/>
    <text x="${ax}" y="14" text-anchor="middle" font-size="12" font-weight="700" fill="var(--bg)">${t('Ahora')}</text>`;
  const pico = datos.reduce((m, d) => (d.v > m.v ? d : m), datos[0]);
  const ip = datos.findIndex((d) => d.h === pico.h);
  return `<svg class="rush__chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('Congestión típica por hora. Picos a las 7:30, 12, 2 y 6 PM.')}" font-family="Inter">
    ${barras}<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--bd)" stroke-width="2"/>${etiquetas}${marcaAhora}
    <text x="${ip * slot + slot / 2}" y="${base - (pico.v / 100) * max - 8}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--tx)">${t('Pico')}</text></svg>`;
}
