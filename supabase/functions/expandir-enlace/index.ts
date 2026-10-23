// ================================================================
// EDGE FUNCTION: expandir-enlace
// Recibe un enlace corto de Google Maps (maps.app.goo.gl/…), sigue la redirección y devuelve
// la dirección larga, de donde la app saca las coordenadas.  POST { "url": "https://maps.app.goo.gl/xxxx" }
//   → { "url": "https://www.google.com/maps/place/…/data=!3d-15.49!4d-70.13…" }
//
// Por qué hace falta: el navegador no deja leer redirecciones de otro sitio (CORS), pero un servidor sí.
// Seguridad: solo sigue enlaces de Google (si no, cualquiera usaría esto para visitar páginas ajenas),
// máximo 6 saltos y 5 segundos.
// Despliegue:  supabase functions deploy expandir-enlace --no-verify-jwt
// ================================================================
// Tipo mínimo de Deno para que VS Code no marque error (en Supabase ya existe de verdad).
declare const Deno: { serve(manejador: (req: Request) => Response | Promise<Response>): void } | undefined;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DOMINIOS = ['goo.gl', 'google.com', 'google.com.pe', 'g.co', 'share.google'];

/** Solo https y solo dominios de Google (el propio dominio o un subdominio). */
export function permitido(texto: string): boolean {
  try {
    const u = new URL(texto);
    if (u.protocol !== 'https:') return false;
    return DOMINIOS.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}

/** Google a veces manda primero a una página de consentimiento; el destino real viene en "continue". */
export function sinConsentimiento(texto: string): string {
  const u = new URL(texto);
  if (u.hostname === 'consent.google.com') {
    const destino = u.searchParams.get('continue');
    if (destino) return destino;
  }
  return texto;
}

export async function expandir(inicio: string, pedir: typeof fetch = fetch): Promise<string | null> {
  let actual = inicio;
  for (let salto = 0; salto < 6; salto++) {
    if (!permitido(actual)) return null;
    const r = await pedir(actual, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; NanGO)' } });
    await r.body?.cancel();
    const siguiente = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && siguiente) {
      actual = sinConsentimiento(new URL(siguiente, actual).toString());
      continue;
    }
    return actual;                       // ya no redirige: es la dirección final
  }
  return null;
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      const { url } = await req.json();
      const final = typeof url === 'string' ? await expandir(url.trim()) : null;
      return new Response(JSON.stringify(final ? { url: final } : { error: 'enlace no permitido o sin respuesta' }), {
        status: final ? 200 : 400, headers: { ...CORS, 'content-type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'solicitud inválida' }), { status: 400, headers: { ...CORS, 'content-type': 'application/json' } });
    }
  });
}
