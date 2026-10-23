// PANTALLA DE LEGALES (Privacidad y Términos)
import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { appbar, subbar } from '../components/ui.js';
import { store } from '../core/store.js';
import { legalDe } from '../legal/index.js';

export default {
  name: 'legal',
  tab: 'profile',
  render(params = {}) {
    const tipo = params.tipo || 'both';
    const titulo = tipo === 'both' ? t('Privacidad y términos') : tipo === 'terms' ? t('Términos de Servicio') : t('Política de Privacidad');
    return `${appbar()}${subbar(titulo)}
      <div class="scroll">
        <div class="doc" style="padding:16px">${legalDe(store.get().lang, tipo)}</div>
      </div>`;
  },
};