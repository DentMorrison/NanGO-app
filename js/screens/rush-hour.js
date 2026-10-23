// HORA PUNTA: cuándo está más lleno cada línea (patrón típico, no en vivo).
// El contenido es el mismo de la pestaña "Tráfico" de la ficha de la línea (components/trafico.js).
import { t } from '../core/i18n.js';
import { esc } from '../core/dom.js';
import { appbar, subbar, lineBadge } from '../components/ui.js';
import { traficoHtml } from '../components/trafico.js';
import { getLinea } from '../data/lineas.js';
import { tipoDia } from '../services/clock.js';

export default {
  name: 'rush-hour',
  tab: 'lines',

  render(params) {
    const l = getLinea(params.id);
    const dia = params.dia || tipoDia();
    return `${appbar()}
      ${subbar('Cuándo está más lleno', l.nombre)}
      <div class="scroll">
        <div class="rush">
          <div class="rush__head">${lineBadge(l, 'lg')}<div><div style="font:italic 700 1.875rem/1 var(--font-display)">${esc(l.nombre)}</div><div class="muted" style="font-size:.875rem">${t('Patrón típico de la semana')}</div></div></div>
          ${traficoHtml({ dia, tabla: params.tabla })}
        </div>
      </div>`;
  },

  actions: {
    dia(_el, { dia }, api, _e, pantalla) { pantalla.dia = dia; api.rerender(); },
    tabla(_el, _p, api, _e, pantalla) { pantalla.tabla = !pantalla.tabla; api.rerender(); },
  },
};
