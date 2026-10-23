#!/usr/bin/env node
// ================================================================
// SERVIDOR LOCAL DE ÑanGO + EDITOR DE LÍNEAS PARA ADMINISTRADORES
//
//   node tools/admin.mjs            (o:  npm run admin)
//   node tools/admin.mjs --puerto 8080
//
// Abre un servidor SOLO en este computador (127.0.0.1) que:
//   · muestra la app en           http://localhost:5173/
//   · y el editor de líneas en    http://localhost:5173/admin/
// El editor guarda en data/lineas/ a través de este servidor. Como el servidor solo existe mientras
// lo tienes encendido en tu computador, nadie más puede editar las líneas: la página pública de la
// app no incluye ninguna forma de escribir datos.
//
// Seguridad: el servidor rechaza cualquier petición que no venga del editor (cada vez que se
// enciende crea una clave nueva que solo el editor conoce), y solo escribe archivos dentro de
// data/lineas/ con nombres del tipo "linea-xx".
// ================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { revisar, serializar, limpiarLinea, ID_VALIDO, LISTAS } from '../admin/lib/formato-lineas.js';

const RAIZ_POR_DEFECTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
const LIMITE_CUERPO = 5 * 1024 * 1024;

export function crearServidor({ raiz = RAIZ_POR_DEFECTO, puerto = 5173 } = {}) {
  const CARPETA = path.join(raiz, 'data', 'lineas');
  const INDICE = path.join(CARPETA, 'index.json');
  const PAGINA_EDITOR = path.join(raiz, 'admin', 'index.html');
  const token = crypto.randomBytes(24).toString('hex');
  let hostsPermitidos = new Set();

  // ------------------------------------------------ utilidades de archivos
  const existeFoto = (ruta) => {
    if (typeof ruta !== 'string') return false;
    const p = path.resolve(raiz, ruta);
    return p.startsWith(raiz + path.sep) && fs.existsSync(p);
  };
  const leerJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const leerIndice = () => { try { return leerJSON(INDICE).lineas.filter((x) => typeof x === 'string'); } catch { return []; } };
  const archivosDeLineas = () => fs.readdirSync(CARPETA).filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_')).map((f) => f.slice(0, -5)).sort();
  const escribir = (archivo, texto) => { const tmp = `${archivo}.tmp-${process.pid}`; fs.writeFileSync(tmp, texto); fs.renameSync(tmp, archivo); };
  const escribirIndice = (ids) => escribir(INDICE, JSON.stringify({ lineas: ids }, null, 2) + '\n');
  const lineaEn = (id) => path.join(CARPETA, `${id}.json`);

  // ------------------------------------------------ respuestas
  const responder = (res, estado, objeto) => {
    res.writeHead(estado, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(objeto));
  };
  const leerCuerpo = (req) => new Promise((ok, mal) => {
    const trozos = []; let tam = 0;
    req.on('data', (t) => { tam += t.length; if (tam > LIMITE_CUERPO) { mal(new Error('demasiado grande')); req.destroy(); } else trozos.push(t); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(trozos).toString('utf8'))); } catch { mal(new Error('JSON inválido')); } });
    req.on('error', mal);
  });

  // ------------------------------------------------ API del editor
  async function api(req, res, url) {
    const t = String(req.headers['x-admin-token'] || '');
    const claveOk = t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token));
    if (!claveOk) return responder(res, 403, { error: 'Falta la clave del editor. Abre el editor desde http://localhost:PUERTO/admin/ con este servidor encendido.' });
    if (req.headers.origin) {
      let host = ''; try { host = new URL(req.headers.origin).host; } catch { /* queda vacío */ }
      if (!hostsPermitidos.has(host)) return responder(res, 403, { error: 'Origen no permitido.' });
    }

    if (req.method === 'GET' && url.pathname === '/api/estado') {
      return responder(res, 200, { indice: leerIndice(), archivos: archivosDeLineas() });
    }

    const m = url.pathname.match(/^\/api\/linea\/([^/]+)$/);
    if (req.method === 'PUT' && m) {
      const id = decodeURIComponent(m[1]);
      if (!ID_VALIDO.test(id)) return responder(res, 400, { error: 'El id debe verse así: linea-30 (minúsculas, números y guiones).' });
      let cuerpo;
      try { cuerpo = await leerCuerpo(req); } catch (e) { return responder(res, 400, { error: e.message }); }
      if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return responder(res, 400, { error: 'El contenido debe ser un objeto.' });
      const linea = limpiarLinea(cuerpo);
      if (linea.id !== id) return responder(res, 400, { error: 'El "id" del contenido no coincide con el de la dirección.' });
      for (const k of LISTAS) if (k in linea && !Array.isArray(linea[k])) return responder(res, 400, { error: `"${k}" debe ser una lista.` });

      const r = revisar(linea, id, { existeFoto });
      for (const otro of archivosDeLineas().filter((x) => x !== id)) {
        try { if (leerJSON(lineaEn(otro)).numero === linea.numero) r.errores.push(`el número "${linea.numero}" también lo usa ${otro}`); } catch { /* otro archivo roto: lo avisa "validar" */ }
      }
      const indice = leerIndice(), enIndice = indice.includes(id);
      if (r.errores.length && enIndice) {
        return responder(res, 400, { error: 'No se guardó: dejaría la línea publicada con errores. Corrígelos y vuelve a guardar.', errores: r.errores, avisos: r.avisos });
      }
      escribir(lineaEn(id), serializar(linea));
      let publicada = false;
      if (!r.errores.length) { if (!enIndice) escribirIndice([...indice, id]); publicada = true; }
      return responder(res, 200, { guardada: true, publicada, errores: r.errores, avisos: r.avisos });
    }

    if (req.method === 'PUT' && url.pathname === '/api/indice') {
      let cuerpo;
      try { cuerpo = await leerCuerpo(req); } catch (e) { return responder(res, 400, { error: e.message }); }
      const ids = cuerpo?.lineas;
      if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string' || !ID_VALIDO.test(x))) return responder(res, 400, { error: '"lineas" debe ser una lista de ids.' });
      if (new Set(ids).size !== ids.length) return responder(res, 400, { error: 'Hay ids repetidos.' });
      const malas = [];
      for (const id of ids) {
        try { if (revisar(leerJSON(lineaEn(id)), id, { existeFoto }).errores.length) malas.push(id); } catch { malas.push(id); }
      }
      if (malas.length) return responder(res, 400, { error: `Estas líneas no existen o tienen errores y no se pueden publicar: ${malas.join(', ')}` });
      escribirIndice(ids);
      return responder(res, 200, { indice: ids });
    }
    return responder(res, 404, { error: 'No existe.' });
  }

  // ------------------------------------------------ archivos de la app
  function estatico(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, { error: 'Método no permitido.' });
    let ruta;
    try { ruta = decodeURIComponent(url.pathname); } catch { return responder(res, 400, { error: 'Dirección inválida.' }); }
    if (ruta === '/admin') { res.writeHead(302, { location: '/admin/' }); return res.end(); }
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = path.resolve(raiz, `.${ruta}`);
    const relativo = path.relative(raiz, archivo);
    if (relativo.startsWith('..') || path.isAbsolute(relativo)) return responder(res, 403, { error: 'No permitido.' });
    if (relativo.split(path.sep).some((p) => p.startsWith('.') || p === 'node_modules')) return responder(res, 404, { error: 'No existe.' });
    let st; try { st = fs.statSync(archivo); } catch { return responder(res, 404, { error: 'No existe.' }); }
    if (!st.isFile()) return responder(res, 404, { error: 'No existe.' });
    const cabeceras = { 'content-type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' };
    if (archivo === PAGINA_EDITOR) {                      // el editor recibe la clave de este servidor
      const html = fs.readFileSync(archivo, 'utf8').replace('__TOKEN__', token);
      res.writeHead(200, cabeceras); return res.end(req.method === 'HEAD' ? undefined : html);
    }
    res.writeHead(200, { ...cabeceras, 'content-length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(archivo).pipe(res);
  }

  const server = http.createServer((req, res) => {
    // Solo se atiende a quien entra por localhost (evita que otras páginas usen este servidor a escondidas).
    if (!hostsPermitidos.has(String(req.headers.host))) return responder(res, 403, { error: 'Host no permitido.' });
    const url = new URL(req.url, 'http://localhost');
    const atender = url.pathname.startsWith('/api/') ? api(req, res, url) : Promise.resolve(estatico(req, res, url));
    atender.catch((e) => { console.error(e); if (!res.headersSent) responder(res, 500, { error: 'Error interno.' }); else res.end(); });
  });

  return {
    server, token,
    iniciar: () => new Promise((ok, mal) => {
      server.once('error', mal);
      server.listen(puerto, '127.0.0.1', () => {
        const p = server.address().port;
        hostsPermitidos = new Set([`localhost:${p}`, `127.0.0.1:${p}`]);
        ok(p);
      });
    }),
    cerrar: () => new Promise((ok) => { server.close(() => ok()); server.closeAllConnections?.(); }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--puerto');
  const puerto = i > 0 ? Number(process.argv[i + 1]) || 5173 : 5173;
  const s = crearServidor({ puerto });
  s.iniciar().then((p) => {
    console.log(`\nÑanGO · servidor local\n  App:               http://localhost:${p}/\n  Editor de líneas:  http://localhost:${p}/admin/\n\nFunciona solo en este computador. Ctrl+C para cerrar.\n`);
  }).catch((e) => {
    console.log(e.code === 'EADDRINUSE' ? `El puerto ${puerto} ya está en uso. Prueba con otro:  node tools/admin.mjs --puerto 8080` : `No se pudo iniciar: ${e.message}`);
    process.exit(1);
  });
}
