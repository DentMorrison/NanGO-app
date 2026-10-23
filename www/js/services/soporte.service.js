// ================================================================
// SOPORTE: enlaces de WhatsApp y correo con el mensaje ya escrito.
// Los mensajes van siempre en español, porque quien los lee es el equipo de ÑanGO,
// aunque la app esté en otro idioma (se indica el idioma de la app al final).
// ================================================================
import { CONTACTO, VERSION } from '../core/config.js';

const enc = encodeURIComponent;

export const enlaceWhatsApp = (texto) => `https://wa.me/${CONTACTO.whatsapp}?text=${enc(texto)}`;
export const enlaceCorreo = (asunto, texto) => `mailto:${CONTACTO.correo}?subject=${enc(asunto)}&body=${enc(texto)}`;

const MENSAJES = {
  ayuda: { asunto: 'Ayuda con ÑanGO', cuerpo: 'Hola ÑanGO, necesito ayuda con: ', conDatos: false },
  problema: {
    asunto: 'Problema en la app ÑanGO',
    cuerpo: 'Hola ÑanGO, quiero reportar un problema de la app.\n\n¿Qué pasó?\n\n\n¿En qué pantalla estabas?\n',
    conDatos: true,
  },
  sugerencia: {
    asunto: 'Sugerencia de lugar o ruta - ÑanGO',
    cuerpo: 'Hola ÑanGO, quiero sugerir un lugar o corregir una ruta.\n\nLínea o lugar:\n\n¿Qué hay que agregar o cambiar?\n',
    conDatos: true,
  },
};

/** { asunto, texto } listo para WhatsApp o correo. tipo: 'ayuda' | 'problema' | 'sugerencia'. */
export function mensaje(tipo, idioma = 'es') {
  const m = MENSAJES[tipo] || MENSAJES.ayuda;
  const datos = m.conDatos ? `\n—\nApp: ÑanGO v${VERSION}\nIdioma de la app: ${idioma}` : '';
  return { asunto: m.asunto, texto: m.cuerpo + datos };
}

/** Copia un texto al portapapeles. Devuelve true si lo logró. */
export async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso: se prueba el otro método */ }
  try {
    const el = document.createElement('textarea');
    el.value = texto; el.setAttribute('readonly', ''); el.style.cssText = 'position:fixed;opacity:0';
    document.body.append(el); el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch { return false; }
}
