// ================================================================
// EDITOR DE LÍNEAS DE ÑanGO (solo para administradores)
// Se abre desde el servidor local:  node tools/admin.mjs  ->  http://localhost:5173/admin/
// Permite: editar los datos de cada línea, dibujar el recorrido de ida y de vuelta en el mapa o
// escribirlo por coordenadas, poner los paraderos, importar KML/GeoJSON, revisar errores y guardar.
// Las reglas de qué es una línea válida están en lib/formato-lineas.js (las mismas que usa la terminal).
// ================================================================
import {
  revisar, km, proyectar, redondear, puntoEn, plantillaLinea, ID_VALIDO,
  leerKML, leerGeoJSON, leerCoordenadas, formatoCoordenadas,
} from './lib/formato-lineas.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TOKEN = document.querySelector('meta[name="admin-token"]').content;
const CENTRO = [-15.4985, -70.1333];
const copia = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- estado
const E = {
  indice: [], archivos: [], datos: new Map(),   // líneas tal como están guardadas
  nuevas: new Set(),                            // líneas creadas aquí y aún sin guardar
  id: null, b: null,                            // línea que se edita y su borrador
  limpio: null,                                 // texto del borrador al guardarlo (null = nunca guardado)
  tab: 'datos', modo: 'dibujar', otras: true,
  hist: [], pendiente: null, servidor: null,    // deshacer; copia previa a una edición de texto; última respuesta al guardar
};

// ---------------------------------------------------------------- servidor
async function api(metodo, url, cuerpo) {
  try {
    const r = await fetch(url, { method: metodo, headers: { 'content-type': 'application/json', 'x-admin-token': TOKEN }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    return { ok: r.ok, estado: r.status, datos: await r.json().catch(() => ({})) };
  } catch (e) { return { ok: false, estado: 0, datos: { error: 'No hay conexión con el servidor local. ¿Sigue encendido?' } }; }
}
async function cargarEstado() {
  const r = await api('GET', '/api/estado');
  if (!r.ok) throw new Error(r.datos.error || 'No se pudo leer el estado');
  E.indice = r.datos.indice; E.archivos = r.datos.archivos;
  await Promise.all(E.archivos.map(async (id) => {
    if (E.datos.has(id) && id === E.id) return;
    try { E.datos.set(id, await (await fetch(`../data/lineas/${id}.json`, { cache: 'no-store' })).json()); } catch { /* archivo roto: se ve en "validar" */ }
  }));
}

// ---------------------------------------------------------------- avisos en pantalla
let temporizador;
function avisar(texto, mal = false) {
  const el = $('#aviso'); el.textContent = texto; el.className = `ver${mal ? ' mal' : ''}`;
  clearTimeout(temporizador); temporizador = setTimeout(() => { el.className = ''; }, mal ? 7000 : 3500);
}

// ---------------------------------------------------------------- el borrador
// Dentro del editor los paraderos son siempre objetos { nombre, c? }; al guardar, los que no tienen
// coordenada vuelven a ser solo el nombre (así los archivos quedan como antes).
const aObjetos = (lista) => (lista || []).map((p) => (typeof p === 'string' ? { nombre: p } : { ...p }));
function prepararBorrador(raw) {
  const b = copia(raw);
  b.paraderos = aObjetos(b.paraderos); b.ida = b.ida || [];
  if (b.paraderosVuelta) b.paraderosVuelta = aObjetos(b.paraderosVuelta);
  return b;
}
function paraGuardar(b) {
  const o = copia(b);
  const aTexto = (l) => l.map((p) => (p.c ? { nombre: p.nombre, c: p.c } : p.nombre));
  o.paraderos = aTexto(o.paraderos);
  if (o.paraderosVuelta?.length) o.paraderosVuelta = aTexto(o.paraderosVuelta); else delete o.paraderosVuelta;
  if (!o.vuelta?.length) delete o.vuelta;
  if (!o.circular) delete o.circular;
  return o;
}
const sucio = () => !!E.b && JSON.stringify(E.b) !== E.limpio;
const circular = () => E.b?.circular === true;
const vueltaPropia = () => Array.isArray(E.b?.vuelta) || Array.isArray(E.b?.paraderosVuelta);
const lado = () => (E.tab === 'vuelta' ? { ruta: 'vuelta', paradas: 'paraderosVuelta' } : { ruta: 'ida', paradas: 'paraderos' });
const editable = () => E.b && (E.tab === 'ida' || (E.tab === 'vuelta' && vueltaPropia() && !circular()));
const ruta = () => E.b[lado().ruta];
const paradas = () => E.b[lado().paradas];
const alReves = (puntos) => [...puntos].reverse();

function asegurarVuelta() {                       // una vuelta propia siempre tiene recorrido y paraderos (aunque estén vacíos)
  if (!Array.isArray(E.b.vuelta)) E.b.vuelta = alReves(E.b.ida);
  if (!Array.isArray(E.b.paraderosVuelta)) E.b.paraderosVuelta = alReves(copia(E.b.paraderos));
}
function instantanea() { E.hist.push(JSON.stringify(E.b)); if (E.hist.length > 60) E.hist.shift(); }
function deshacer() {
  if (!E.hist.length) return;
  E.b = JSON.parse(E.hist.pop());
  if (E.tab === 'vuelta' && !vueltaPropia()) E.modo = 'dibujar';
  renderTodo();
}

// ---------------------------------------------------------------- revisión en vivo
const revisionActual = () => revisar(paraGuardar(E.b), E.id);
function actualizarEstado() {
  const hay = sucio();
  $('#estado-guardado').textContent = !E.b ? '' : hay ? 'Cambios sin guardar' : 'Todo guardado';
  $('#estado-guardado').className = hay ? 'pendiente' : '';
  $('#btn-guardar').disabled = !hay;
  $('#btn-deshacer').disabled = !E.hist.length;
  if (!E.b) return;
  const r = revisionActual(), n = $('#n-revision');
  n.textContent = r.errores.length + r.avisos.length || '✓';
  n.className = r.errores.length ? 'mal' : r.avisos.length ? 'aviso' : '';
}
function cambio() { actualizarEstado(); }

// ---------------------------------------------------------------- lista de líneas
function nombreDe(id) { const l = E.id === id && E.b ? E.b : E.datos.get(id); return l ? `${l.nombre || id}` : id; }
function renderLista() {
  const fila = (id, { publicada, i }) => {
    const l = E.datos.get(id) || {};
    const flechas = publicada ? `<button class="mini" data-acc="subir-linea" data-id="${id}" ${i === 0 ? 'disabled' : ''} title="Subir en la lista">▲</button><button class="mini" data-acc="bajar-linea" data-id="${id}" ${i === E.indice.length - 1 ? 'disabled' : ''} title="Bajar en la lista">▼</button><button class="mini peligro" data-acc="quitar-linea" data-id="${id}" title="Quitar de la app (el archivo se conserva)">✕</button>` : '';
    return `<div class="fila-linea ${E.id === id ? 'elegida' : ''}"><span class="punto" style="background:${esc(l.color || '#999')}"></span><button class="nombre" data-acc="abrir" data-id="${id}">${esc(nombreDe(id))} <span class="id">${esc(id)}</span></button>${E.nuevas.has(id) ? '<span class="etiqueta">nueva</span>' : ''}${flechas}</div>`;
  };
  const publicadas = E.indice.map((id, i) => fila(id, { publicada: true, i })).join('');
  const borradores = [...new Set([...E.archivos.filter((id) => !E.indice.includes(id)), ...E.nuevas])];
  $('#lista').innerHTML = `<h2>Líneas de la app</h2>${publicadas || '<p class="pista">Aún no hay líneas publicadas.</p>'}${borradores.length ? `<h3>Borradores (no se muestran en la app)</h3>${borradores.map((id) => fila(id, { publicada: false })).join('')}` : ''}<button id="btn-nueva" data-acc="nueva-linea">+ Nueva línea</button>`;
}

async function abrir(id) {
  if (sucio() && !confirm('Hay cambios sin guardar en esta línea. ¿Descartarlos?')) return;
  E.id = id; E.b = prepararBorrador(E.datos.get(id));
  E.limpio = E.nuevas.has(id) ? null : JSON.stringify(E.b);
  E.hist = []; E.servidor = null; E.tab = 'datos'; E.modo = 'dibujar';
  $('#editor').hidden = false;
  renderTodo(true);
}
function nuevaLinea() {
  if (sucio() && !confirm('Hay cambios sin guardar en esta línea. ¿Descartarlos?')) return;
  const id = (prompt('Id de la nueva línea.\nSolo minúsculas, números y guiones. Ejemplo: linea-30', 'linea-') || '').trim();
  if (!id) return;
  if (!ID_VALIDO.test(id)) return avisar('El id debe verse así: linea-30 (minúsculas, números y guiones).', true);
  if (E.datos.has(id) || E.nuevas.has(id)) return avisar(`Ya existe ${id}.`, true);
  const nombre = prompt('Nombre de la línea (como se verá en la app):', `Línea ${id.replace(/^linea-/, '')}`);
  if (nombre === null) return;
  E.datos.set(id, plantillaLinea(id, nombre.trim())); E.nuevas.add(id);
  E.id = null; E.b = null; abrir(id);
}
async function guardarIndice(ids, mensaje) {
  const r = await api('PUT', '/api/indice', { lineas: ids });
  if (!r.ok) return avisar(r.datos.error || 'No se pudo cambiar el orden.', true);
  E.indice = r.datos.indice; renderLista(); if (mensaje) avisar(mensaje);
}
function moverLinea(id, d) {
  const i = E.indice.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= E.indice.length) return;
  const ids = [...E.indice]; [ids[i], ids[j]] = [ids[j], ids[i]]; guardarIndice(ids);
}
function quitarLinea(id) {
  if (!confirm(`¿Quitar "${nombreDe(id)}" de la app?\nEl archivo se conserva como borrador y puedes volver a publicarla guardándola de nuevo.`)) return;
  guardarIndice(E.indice.filter((x) => x !== id), 'La línea ya no se muestra en la app.');
}

// ---------------------------------------------------------------- guardar
async function guardar() {
  if (!sucio()) return;
  const cuerpo = paraGuardar(E.b);
  const r = await api('PUT', `/api/linea/${E.id}`, cuerpo);
  if (!r.ok) {
    E.servidor = r.datos; E.tab = r.datos.errores ? 'revision' : E.tab; renderTodo();
    return avisar(r.datos.error || 'No se pudo guardar.', true);
  }
  E.datos.set(E.id, cuerpo); E.nuevas.delete(E.id); E.limpio = JSON.stringify(E.b); E.servidor = r.datos;
  await cargarEstado(); renderLista(); renderVista(); actualizarEstado();
  avisar(r.datos.publicada ? 'Guardada y publicada en la app.' : 'Guardada como borrador: todavía no se muestra en la app (mira "Revisión").', !r.datos.publicada);
}

// ---------------------------------------------------------------- vistas del panel
const obtener = (ruta) => ruta.split('.').reduce((o, k) => o?.[k], E.b);
function poner(ruta, valor) {
  const ks = ruta.split('.'); let o = E.b;
  ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
  o[ks.at(-1)] = valor;
}
const campo = (etiqueta, ruta, tipo = 'text', extra = '') => `<label class="campo"><span>${etiqueta}</span><input type="${tipo}" data-campo="${ruta}" value="${esc(obtener(ruta) ?? '')}" ${extra}></label>`;
const casilla = (etiqueta, ruta) => `<label class="check"><input type="checkbox" data-campo="${ruta}" ${obtener(ruta) ? 'checked' : ''}> ${etiqueta}</label>`;
const color = (etiqueta, ruta) => { const v = obtener(ruta) || '#000000'; return `<label class="campo"><span>${etiqueta}</span><span class="color-fila"><input type="color" data-campo="${ruta}" value="${esc(/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000')}"><small>${esc(v)}</small></span></label>`; };

function htmlDatos() {
  return `
    <div class="bloque"><h3>Identificación</h3>
      <label class="campo"><span>Id (no se puede cambiar)</span><input type="text" value="${esc(E.id)}" readonly></label>
      <div class="rejilla">${campo('Número', 'numero')}${campo('Nombre en la app', 'nombre')}</div>
      ${campo('Empresa', 'empresa')}${campo('Foto del micro (ruta)', 'foto')}
      <div class="rejilla">${color('Color principal', 'color')}${color('Color claro', 'colorClaro')}</div>
    </div>
    <div class="bloque"><h3>Tarifa (S/)</h3>
      <div class="rejilla">${campo('Adulto', 'tarifa.adulto', 'number', 'step="0.1" min="0"')}${campo('Universitario', 'tarifa.universitario', 'number', 'step="0.1" min="0"')}${campo('Escolar', 'tarifa.escolar', 'number', 'step="0.1" min="0"')}${campo('Nocturna', 'tarifa.nocturna', 'number', 'step="0.1" min="0"')}</div>
      ${casilla('Tarifa por confirmar', 'tarifa.porConfirmar')}
    </div>
    <div class="bloque"><h3>Horario y frecuencia</h3>
      <div class="rejilla">${campo('Primer servicio', 'horario.inicio', 'text', 'placeholder="5:00 AM"')}${campo('Último servicio', 'horario.fin', 'text', 'placeholder="11:00 PM"')}${campo('Tarifa nocturna desde', 'horario.nocturnoDesde', 'text', 'placeholder="10:00 PM"')}${campo('Pasa cada (minutos)', 'frecuenciaMin', 'number', 'min="1"')}</div>
      ${campo('Verificada hace', 'verificadaHace')}
    </div>
    <div class="bloque"><h3>Tipo de recorrido</h3>
      ${casilla('Línea circular (da vueltas a un circuito y no tiene regreso por otro lado)', 'circular')}
    </div>`;
}

function htmlTramo() {
  const sentido = E.tab === 'vuelta' ? 'vuelta' : 'ida';
  if (circular() && sentido === 'vuelta') return `<div class="tarjeta"><p>Esta línea es <b>circular</b>: tiene un solo sentido, así que no tiene vuelta. Se edita todo en la pestaña <b>Ida</b>.</p></div>`;
  if (sentido === 'vuelta' && !vueltaPropia()) {
    return `<div class="tarjeta"><p>La vuelta va por <b>las mismas calles que la ida</b>: la app la deduce sola (el recorrido al revés y los mismos paraderos en orden inverso). No hay nada que dibujar.</p><p>Si esta línea regresa por <b>otras calles</b>, puedes dibujar la vuelta aparte:</p><button type="button" class="primario" data-acc="vuelta-propia">Dibujar la vuelta por otras calles</button></div>`;
  }
  const pts = ruta(), ps = paradas();
  let largo = 0; pts.forEach((p, i) => { if (i) largo += km(pts[i - 1], p); });
  const pista = {
    dibujar: 'Haz clic en el mapa para agregar puntos al <b>final</b> del recorrido, en el orden en que pasa el micro. Pon varios puntos en las curvas para seguir bien las calles.',
    paraderos: 'Haz clic en el mapa donde está el paradero. Se agregan en orden; puedes corregir el orden en la lista de abajo.',
    mover: 'Arrastra un punto para corregirlo. Haz clic sobre la línea para agregar un punto ahí. Clic derecho sobre un punto lo borra.',
  }[E.modo];
  const fila = (p, i) => `<li><span class="num">${i + 1}</span><input type="text" data-parada="${i}" value="${esc(p.nombre)}"><span class="botones"><button type="button" data-acc="parada-subir" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-acc="parada-bajar" data-i="${i}" ${i === ps.length - 1 ? 'disabled' : ''}>▼</button>${p.c ? `<button type="button" data-acc="parada-ir" data-i="${i}" title="Ver en el mapa">⌖</button>` : ''}<button type="button" class="peligro" data-acc="parada-borrar" data-i="${i}">✕</button></span><span class="coord ${p.c ? '' : 'falta'}">${p.c ? `${p.c[0]}, ${p.c[1]}` : 'sin ubicación en el mapa'}</span></li>`;
  const sinUbicar = ps.filter((p) => !p.c).length;
  return `
    ${sentido === 'vuelta' ? '<div class="acciones"><button type="button" class="peligro" data-acc="vuelta-auto">Volver a la vuelta automática</button></div>' : ''}
    <div class="modos">
      <button type="button" data-acc="modo" data-modo="dibujar" class="${E.modo === 'dibujar' ? 'activo' : ''}">✎ Dibujar</button>
      <button type="button" data-acc="modo" data-modo="paraderos" class="${E.modo === 'paraderos' ? 'activo' : ''}">📍 Paraderos</button>
      <button type="button" data-acc="modo" data-modo="mover" class="${E.modo === 'mover' ? 'activo' : ''}">✥ Editar</button>
    </div>
    <div class="pista">${pista}</div>
    <div class="cifras"><b>${pts.length}</b> puntos · <b>${largo.toFixed(1)}</b> km · <b>${ps.length}</b> paraderos</div>
    <div class="acciones">
      <button type="button" data-acc="invertir" title="Da vuelta el orden del recorrido y de los paraderos">⇅ Invertir sentido</button>
      <button type="button" class="peligro" data-acc="borrar-ruta">Borrar recorrido</button>
      <label class="boton-archivo"><button type="button" data-acc="elegir-archivo">⬆ Importar KML / GeoJSON</button><input type="file" id="archivo" accept=".kml,.geojson,.json,.xml" hidden></label>
    </div>
    <details><summary>Poner el recorrido por coordenadas</summary>
      <textarea id="coords" rows="7" spellcheck="false" placeholder="Una coordenada por renglón:&#10;-15.4985, -70.1333&#10;-15.4990, -70.1340">${esc(formatoCoordenadas(pts))}</textarea>
      <div class="acciones" style="margin-top:6px"><button type="button" data-acc="aplicar-coords">Aplicar coordenadas</button></div>
      <div class="pista">Primero latitud y luego longitud. Si las pegas al revés (como en Google Maps o GeoJSON), se dan vuelta solas.</div>
    </details>
    <h3 style="font-size:13px;margin:12px 0 4px">Paraderos</h3>
    <ol id="paradas">${ps.map(fila).join('') || '<li style="display:block;color:#5b6676">Aún no hay paraderos. Usa el modo 📍 Paraderos o agrégalos abajo.</li>'}</ol>
    <div class="agregar-parada"><input type="text" id="np-nombre" placeholder="Nombre del paradero"><input type="text" id="np-coord" placeholder="latitud, longitud"><button type="button" data-acc="agregar-parada">Agregar</button></div>
    ${sinUbicar && pts.length > 1 ? `<div class="acciones" style="margin-top:8px"><button type="button" data-acc="ubicar-faltantes">Ubicar los ${sinUbicar} sin ubicación (aproximado)</button></div><div class="pista">Los reparte a lo largo del recorrido, como hace la app hoy. Después puedes arrastrarlos a su lugar real en el modo ✥ Editar.</div>` : ''}`;
}

function htmlRevision() {
  const r = revisionActual(), s = E.servidor;
  const lista = (cls, items) => (items.length ? `<ul class="${cls}">${items.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '');
  const bien = !r.errores.length && !r.avisos.length;
  return `<div class="revision">
    <p class="cifras"><b>${r.resumen.puntos}</b> puntos · <b>${r.resumen.km.toFixed(1)}</b> km · <b>${r.resumen.paraderos}</b> paraderos (${r.resumen.conCoord} con ubicación) · ${esc(r.resumen.sentidos)}</p>
    ${bien ? '<p class="bien">✓ Todo en orden.</p>' : ''}
    ${r.errores.length ? '<b class="mal">Errores (hay que corregirlos para publicar)</b>' : ''}${lista('mal', r.errores)}
    ${r.avisos.length ? '<b class="aviso">Avisos</b>' : ''}${lista('aviso', r.avisos)}
    ${s ? `<hr><b>Al guardar, el servidor dijo:</b>${s.error ? `<p class="mal">${esc(s.error)}</p>` : ''}${lista('mal', s.errores || [])}${lista('aviso', s.avisos || [])}` : ''}
  </div>`;
}

function renderVista() {
  if (!E.b) return;
  $('#titulo-linea').textContent = `${E.b.nombre || E.id}  ·  ${E.id}`;
  $('#vista').innerHTML = E.tab === 'datos' ? htmlDatos() : E.tab === 'revision' ? htmlRevision() : htmlTramo();
  document.querySelectorAll('#pestanas button').forEach((b) => b.classList.toggle('activo', b.dataset.tab === E.tab));
  $('#mapa').classList.toggle('dibujar', editable() && E.modo !== 'mover');
}
function renderTodo(ajustar = false) { renderLista(); renderVista(); redibujar(ajustar); actualizarEstado(); }

// ---------------------------------------------------------------- mapa
let mapa, gOtras, gRef, gRuta, gVertices, gParadas;
function iniciarMapa() {
  mapa = L.map('mapa').setView(CENTRO, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
  gOtras = L.layerGroup().addTo(mapa); gRef = L.layerGroup().addTo(mapa); gRuta = L.layerGroup().addTo(mapa);
  gVertices = L.layerGroup().addTo(mapa); gParadas = L.layerGroup().addTo(mapa);
  mapa.on('click', alClicMapa);
}
const redond = (ll) => redondear([ll.lat, ll.lng]);

function redibujar(ajustar = false) {
  [gOtras, gRef, gRuta, gVertices, gParadas].forEach((g) => g.clearLayers());
  if (!E.b) return;
  if (E.otras) {
    E.indice.concat(E.archivos.filter((id) => !E.indice.includes(id))).filter((id) => id !== E.id).forEach((id) => {
      const l = E.datos.get(id); if (l?.ida?.length > 1) L.polyline(l.ida, { color: l.color || '#888', weight: 3, opacity: 0.35, interactive: false }).addTo(gOtras);
    });
  }
  const color = E.b.color || '#1d4ed8';
  let puntosEnfoque = E.b.ida;

  if (editable()) {
    const pts = ruta(), ps = paradas();
    puntosEnfoque = pts.length ? pts : ps.filter((p) => p.c).map((p) => p.c);
    // la otra dirección, como referencia
    const otra = E.tab === 'ida' ? (vueltaPropia() ? E.b.vuelta : null) : E.b.ida;
    if (otra?.length > 1) L.polyline(otra, { color: '#667085', weight: 3, opacity: 0.7, dashArray: '6 8', interactive: false }).addTo(gRef);

    if (pts.length > 1) {
      const linea = L.polyline(pts, { color, weight: 5, opacity: 0.9 }).addTo(gRuta);
      if (E.modo === 'mover') linea.on('click', (e) => insertarPunto(redond(e.latlng)));
    }
    if (pts.length) {
      L.circleMarker(pts[0], { radius: 7, color: '#067647', fillColor: '#12b76a', fillOpacity: 1, weight: 2, interactive: false }).addTo(gRuta);
      if (pts.length > 1) L.circleMarker(pts.at(-1), { radius: 7, color: '#b42318', fillColor: '#f04438', fillOpacity: 1, weight: 2, interactive: false }).addTo(gRuta);
    }
    if (E.modo === 'mover') {
      pts.forEach((p, i) => {
        const m = L.marker(p, { draggable: true, icon: L.divIcon({ className: 'vtx', iconSize: [12, 12] }) }).addTo(gVertices);
        m.on('dragend', (e) => { instantanea(); pts[i] = redond(e.target.getLatLng()); redibujar(); renderVista(); actualizarEstado(); });
        m.on('contextmenu', (e) => { e.originalEvent?.preventDefault?.(); instantanea(); pts.splice(i, 1); redibujar(); renderVista(); actualizarEstado(); });
      });
    }
    ps.forEach((p, i) => {
      if (!p.c) return;
      const m = L.marker(p.c, { draggable: E.modo !== 'dibujar', icon: L.divIcon({ className: '', html: `<div class="num-parada">${i + 1}</div>`, iconSize: [22, 22] }) }).addTo(gParadas);
      m.bindTooltip(p.nombre);
      m.on('dragend', (e) => { instantanea(); p.c = redond(e.target.getLatLng()); redibujar(); renderVista(); actualizarEstado(); });
    });
  } else {
    // datos / revisión / vuelta automática: se muestra la línea tal como está
    if (E.b.ida.length > 1) L.polyline(E.b.ida, { color, weight: 5, opacity: 0.85, interactive: false }).addTo(gRuta);
    if (vueltaPropia() && E.b.vuelta?.length > 1) L.polyline(E.b.vuelta, { color, weight: 4, opacity: 0.6, dashArray: '6 8', interactive: false }).addTo(gRef);
    E.b.paraderos.forEach((p, i) => { if (p.c) L.marker(p.c, { icon: L.divIcon({ className: '', html: `<div class="num-parada">${i + 1}</div>`, iconSize: [22, 22] }), interactive: false }).addTo(gParadas); });
  }
  if (ajustar) {
    const todos = [...(puntosEnfoque || [])];
    if (todos.length > 1) mapa.fitBounds(todos, { padding: [30, 30] }); else mapa.setView(todos[0] || CENTRO, todos[0] ? 15 : 13);
  }
}

function alClicMapa(e) {
  if (!editable()) return;
  if (E.modo === 'dibujar') { instantanea(); ruta().push(redond(e.latlng)); }
  else if (E.modo === 'paraderos') { instantanea(); paradas().push({ nombre: `Paradero ${paradas().length + 1}`, c: redond(e.latlng) }); }
  else return;
  redibujar(); renderVista(); actualizarEstado();
}
function insertarPunto(p) {
  const pts = ruta(); if (pts.length < 2) return;
  instantanea();
  pts.splice(Math.floor(proyectar(pts, p).pos) + 1, 0, p);
  redibujar(); renderVista(); actualizarEstado();
}

// ---------------------------------------------------------------- acciones del panel
function importarTexto(texto, nombreArchivo) {
  let datos;
  try { datos = /<kml|<Placemark/i.test(texto) ? leerKML(texto) : leerGeoJSON(texto); }
  catch { return avisar(`No pude leer ${nombreArchivo}: no parece KML ni GeoJSON.`, true); }
  if (!datos.trazos.length && !datos.puntos.length) return avisar('El archivo no trae líneas dibujadas ni puntos marcados.', true);
  let n = 0;
  if (datos.trazos.length > 1) {
    const r = prompt(`El archivo trae ${datos.trazos.length} líneas dibujadas:\n${datos.trazos.map((t, i) => `${i + 1}: ${t.nombre || 'sin nombre'} (${t.pts.length} puntos)`).join('\n')}\n\n¿Cuál quieres usar? (número)`, '1');
    if (r === null) return; n = Math.min(datos.trazos.length, Math.max(1, Number(r) || 1)) - 1;
  }
  if ((ruta().length || paradas().length) && !confirm('Esto reemplaza el recorrido y los paraderos que ya hay en esta pestaña. ¿Seguir?')) return;
  instantanea();
  if (datos.trazos.length) E.b[lado().ruta] = datos.trazos[n].pts;
  if (datos.puntos.length) E.b[lado().paradas] = datos.puntos.map((p, i) => ({ nombre: p.nombre || `Paradero ${i + 1}`, c: p.c }));
  renderTodo(true);
  avisar(`Importado: ${datos.trazos.length ? `${datos.trazos[n].pts.length} puntos` : 'sin recorrido'}${datos.puntos.length ? `, ${datos.puntos.length} paraderos` : ''}.`);
}

const acciones = {
  abrir: (el) => abrir(el.dataset.id),
  'nueva-linea': nuevaLinea,
  'subir-linea': (el) => moverLinea(el.dataset.id, -1),
  'bajar-linea': (el) => moverLinea(el.dataset.id, 1),
  'quitar-linea': (el) => quitarLinea(el.dataset.id),
  modo: (el) => { E.modo = el.dataset.modo; renderVista(); redibujar(); },
  'vuelta-propia': () => { instantanea(); asegurarVuelta(); E.modo = 'mover'; renderTodo(true); },
  'vuelta-auto': () => { if (!confirm('Se borran el recorrido y los paraderos propios de la vuelta, y la app volverá a deducirla de la ida. ¿Seguir?')) return; instantanea(); delete E.b.vuelta; delete E.b.paraderosVuelta; renderTodo(true); },
  invertir: () => { instantanea(); E.b[lado().ruta] = alReves(ruta()); E.b[lado().paradas] = alReves(paradas()); renderTodo(); },
  'borrar-ruta': () => { if (!ruta().length || !confirm('¿Borrar todos los puntos del recorrido? (Puedes deshacerlo con Ctrl+Z.)')) return; instantanea(); E.b[lado().ruta] = []; renderTodo(); },
  'elegir-archivo': () => $('#archivo').click(),
  'aplicar-coords': () => {
    const r = leerCoordenadas($('#coords').value);
    if (r.errores.length) return avisar(`Hay problemas: ${r.errores.slice(0, 3).join('; ')}`, true);
    if (r.puntos.length < 2) return avisar('Pon al menos 2 coordenadas.', true);
    instantanea(); E.b[lado().ruta] = r.puntos; renderTodo(true);
    avisar(`Recorrido con ${r.puntos.length} puntos${r.invertidos ? ` (se dieron vuelta ${r.invertidos} que venían como longitud, latitud)` : ''}.`);
  },
  'parada-subir': (el) => { const i = +el.dataset.i, ps = paradas(); if (i < 1) return; instantanea(); [ps[i - 1], ps[i]] = [ps[i], ps[i - 1]]; renderTodo(); },
  'parada-bajar': (el) => { const i = +el.dataset.i, ps = paradas(); if (i >= ps.length - 1) return; instantanea(); [ps[i + 1], ps[i]] = [ps[i], ps[i + 1]]; renderTodo(); },
  'parada-borrar': (el) => { instantanea(); paradas().splice(+el.dataset.i, 1); renderTodo(); },
  'parada-ir': (el) => { const p = paradas()[+el.dataset.i]; if (p?.c) mapa.setView(p.c, Math.max(mapa.getZoom?.() || 16, 16)); },
  'agregar-parada': () => {
    const nombre = $('#np-nombre').value.trim() || `Paradero ${paradas().length + 1}`, texto = $('#np-coord').value.trim();
    let c;
    if (texto) { const r = leerCoordenadas(texto); if (r.errores.length || r.puntos.length !== 1) return avisar('La coordenada debe verse así: -15.4985, -70.1333', true); c = r.puntos[0]; }
    instantanea(); paradas().push(c ? { nombre, c } : { nombre }); renderTodo();
  },
  'ubicar-faltantes': () => {
    const pts = ruta(), ps = paradas(); instantanea();
    ps.forEach((p, i) => { if (!p.c) p.c = redondear(puntoEn(pts, ps.length === 1 ? 0 : i / (ps.length - 1))); });
    renderTodo(); avisar('Listo. Arrástralos a su lugar real en el modo ✥ Editar.');
  },
};

// ---------------------------------------------------------------- eventos
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acc]'); if (el && acciones[el.dataset.acc]) { e.preventDefault(); acciones[el.dataset.acc](el); }
});
$('#pestanas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b || !E.b) return;
  E.tab = b.dataset.tab; if (E.tab === 'vuelta' && !vueltaPropia()) E.modo = 'dibujar';
  renderVista(); redibujar(true);
});
$('#vista').addEventListener('focusin', () => { E.pendiente = E.b ? JSON.stringify(E.b) : null; });
$('#vista').addEventListener('change', (e) => {
  if (e.target.id === 'archivo') {
    const f = e.target.files[0]; if (!f) return;
    const lector = new FileReader(); lector.onload = () => importarTexto(String(lector.result), f.name); lector.readAsText(f); e.target.value = ''; return;
  }
  if (E.pendiente && E.pendiente !== JSON.stringify(E.b)) { E.hist.push(E.pendiente); actualizarEstado(); }
  E.pendiente = null;
});
$('#vista').addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.campo) {
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    poner(t.dataset.campo, v);
    if (t.type === 'color') { t.nextElementSibling.textContent = t.value; redibujar(); renderLista(); }
    if (t.dataset.campo === 'circular') { renderVista(); redibujar(); }
    if (t.dataset.campo === 'nombre') $('#titulo-linea').textContent = `${E.b.nombre || E.id}  ·  ${E.id}`;
    cambio();
  } else if (t.dataset.parada !== undefined) {
    paradas()[+t.dataset.parada].nombre = t.value; cambio();
  }
});
$('#ver-otras').addEventListener('change', (e) => { E.otras = e.target.checked; redibujar(); });
$('#btn-guardar').addEventListener('click', guardar);
$('#btn-deshacer').addEventListener('click', deshacer);
document.addEventListener('keydown', (e) => {
  const enTexto = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); guardar(); }
  else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && !enTexto) { e.preventDefault(); deshacer(); }
});
window.addEventListener('beforeunload', (e) => { if (sucio()) { e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------- arranque
(async function iniciar() {
  if (TOKEN === '__TOKEN__' || !TOKEN) { $('#sin-servidor').hidden = false; return; }
  iniciarMapa();
  try { await cargarEstado(); } catch (e) { $('#lista').innerHTML = `<p class="pista">No se pudieron leer las líneas: ${esc(e.message)}</p>`; return; }
  renderLista(); actualizarEstado();
  if (E.indice[0]) abrir(E.indice[0]);
})();
