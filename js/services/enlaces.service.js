// ================================================================
// ENLACES CORTOS DE GOOGLE MAPS  (maps.app.goo.gl/…)
// El navegador no puede seguir esa redirección; lo hace la Edge Function `expandir-enlace`
// (supabase/functions/expandir-enlace). Devuelve la dirección larga o null si no se pudo.
// ================================================================
import { SUPABASE_URL, SUPABASE_KEY, hayNube } from './supabase.js';

export async function expandirEnlace(url) {
  if (!hayNube()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/expandir-enlace`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.url === 'string' ? d.url : null;
  } catch { return null; }                 // sin internet o función sin desplegar
}
