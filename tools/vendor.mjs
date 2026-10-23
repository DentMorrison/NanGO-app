// ================================================================
// Descarga UNA VEZ las librerías que la app pedía a internet y las guarda en assets/vendor/,
// para que la app (y el APK) funcionen sin conexión.
//
//   npm run vendor          (necesita internet y Node 18 o más)
//
// Qué baja:
//   · Leaflet 1.9.4 (mapa)                       → assets/vendor/leaflet/
//   · Tabler Icons 3.6.0 (íconos)                → assets/vendor/tabler/
//   · Inter y Barlow Condensed (letras, latín)   → assets/vendor/fonts/
//   · supabase-js 2 (cuenta y avisos)            → assets/vendor/supabase/
//   · protomaps-leaflet (opcional, mapa guardado) → assets/vendor/protomaps-leaflet/
// index.html y js/services/supabase.js ya buscan primero estos archivos y, si no están,
// usan internet como antes.
// ================================================================
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'assets', 'vendor');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:ital,wght@0,600;0,700;1,700&display=swap';

/** Todas las direcciones url(...) de un CSS (sin comillas), sin repetir y sin los "data:". */
export function urlsDeCss(css) {
  const out = new Set();
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g)) if (!m[1].startsWith('data:')) out.add(m[1]);
  return [...out];
}

/** De un CSS de Google Fonts deja solo los bloques "latin" y "latin-ext" (alcanzan para español). */
export function soloLatin(css) {
  const bloques = css.split(/(?=\/\*\s*[\w-]+\s*\*\/\s*@font-face)/);
  return bloques.filter((b) => /^\/\*\s*latin(-ext)?\s*\*\//.test(b.trim()) || !/^\/\*/.test(b.trim())).join('');
}

/** Nombre de archivo local para una dirección (sin ?versión). */
export const nombreLocal = (url) => decodeURIComponent(new URL(url, 'https://x.invalid/').pathname.split('/').pop());

async function bajar(url, opciones = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA }, ...opciones });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}
async function guardar(ruta, datos) {
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, datos);
  console.log('  ✓', path.relative(RAIZ, ruta));
}

/** Baja un CSS y todos los archivos que usa (tipografías), y reescribe el CSS para que apunte a ellos. */
async function cssConRecursos(urlCss, carpeta, archivoCss, { filtrar = (c) => c } = {}) {
  let css = filtrar(await (await bajar(urlCss)).text());
  for (const u of urlsDeCss(css)) {
    const absoluta = new URL(u, urlCss).href;
    const nombre = nombreLocal(absoluta);
    await guardar(path.join(carpeta, 'archivos', nombre), Buffer.from(await (await bajar(absoluta)).arrayBuffer()));
    css = css.split(u).join(`./archivos/${nombre}`);
  }
  await guardar(path.join(carpeta, archivoCss), css);
}

async function archivos(base, lista, carpeta) {
  for (const f of lista) await guardar(path.join(carpeta, f), Buffer.from(await (await bajar(`${base}/${f}`)).arrayBuffer()));
}

async function principal() {
  const versiones = {};
  const paso = async (nombre, fn, opcional = false) => {
    console.log(`\n${nombre}`);
    try { await fn(); versiones[nombre] = 'ok'; } catch (e) {
      versiones[nombre] = `error: ${e.message}`;
      console.log(`  ${opcional ? '– no disponible (opcional)' : '✗ falló'}: ${e.message}`);
      if (!opcional) process.exitCode = 1;
    }
  };

  await paso('Leaflet 1.9.4', () => archivos('https://unpkg.com/leaflet@1.9.4/dist',
    ['leaflet.js', 'leaflet.css', 'images/layers.png', 'images/layers-2x.png', 'images/marker-icon.png', 'images/marker-icon-2x.png', 'images/marker-shadow.png'],
    path.join(DESTINO, 'leaflet')));

  await paso('Tabler Icons 3.6.0', () => cssConRecursos('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css',
    path.join(DESTINO, 'tabler'), 'tabler-icons.min.css'));

  await paso('Letras Inter y Barlow Condensed', () => cssConRecursos(GOOGLE_FONTS,
    path.join(DESTINO, 'fonts'), 'fonts.css', { filtrar: soloLatin }));

  await paso('supabase-js 2', () => archivos('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd',
    ['supabase.js'], path.join(DESTINO, 'supabase')));

  // Opcional: dibuja el mapa guardado (assets/mapa/juliaca.pmtiles). Ver docs/OFFLINE.md.
  await paso('protomaps-leaflet', async () => {
    const info = await (await bajar('https://registry.npmjs.org/protomaps-leaflet/latest')).json();
    const base = `https://cdn.jsdelivr.net/npm/protomaps-leaflet@${info.version}/dist`;
    let ultimo;
    for (const f of ['protomaps-leaflet.js', 'protomaps-leaflet.min.js']) {
      try {
        await guardar(path.join(DESTINO, 'protomaps-leaflet', 'protomaps-leaflet.js'), Buffer.from(await (await bajar(`${base}/${f}`)).arrayBuffer()));
        versiones.protomapsLeaflet = info.version;
        return;
      } catch (e) { ultimo = e; }
    }
    throw ultimo;
  }, true);

  await guardar(path.join(DESTINO, 'VERSIONES.json'), JSON.stringify({ fecha: new Date().toISOString(), ...versiones }, null, 2));
  console.log(process.exitCode ? '\nHubo errores: revisa tu conexión y vuelve a ejecutar.' : '\nListo. Ahora la app no necesita internet para sus librerías.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
