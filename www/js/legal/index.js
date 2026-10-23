// ================================================================
// TEXTOS LEGALES (términos y política de privacidad) por idioma.
// Los documentos completos viven en js/legal/*.js.
// ================================================================
import { termsES } from './terms_es.js';
import { termsEN } from './terms_en.js';
import { termsQU } from './terms_qu.js';
import { termsAY } from './terms_ay.js';
import { privacyES } from './privacy_es.js';
import { privacyEN } from './privacy_en.js';
import { privacyQU } from './privacy_qu.js';
import { privacyAY } from './privacy_ay.js';

export const LEGAL = {
  es: { terms: termsES, privacy: privacyES },
  en: { terms: termsEN, privacy: privacyEN },
  qu: { terms: termsQU, privacy: privacyQU },
  ay: { terms: termsAY, privacy: privacyAY },
};

/** Devuelve el documento ('terms' | 'privacy') en el idioma pedido, con respaldo en español. */
export const legalDe = (lang, tipo) => {
  const base = LEGAL[lang] || LEGAL.es;
  if (tipo === 'both') {
    return base.terms + '<hr>' + base.privacy;
  }
  return base[tipo] || LEGAL.es[tipo];
};
