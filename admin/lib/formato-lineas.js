// ================================================================
// FORMATO DE LAS LÍNEAS (código compartido)
// Lo usan la herramienta de terminal (tools/lineas.mjs), el servidor del editor (tools/admin.mjs) y
// el editor del navegador (admin/). No usa nada propio de Node, para que funcione en los dos lados.
// Aquí vive todo lo que "sabe" cómo es una línea: guardar el archivo, leer KML/GeoJSON y revisar errores.
// ================================================================
// ---------------------------------------------------------------- geografía
const rad = (g) => (g * Math.PI) / 180;
export function km(a, b) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}
/** Posición de un punto sobre un recorrido: { pos: segmento + fracción, d: km hasta el recorrido }. */
export function proyectar(ida, p) {
  const k = 111.32, c = Math.cos(rad(p[0]));
  const xy = (q) => [(q[1] - p[1]) * k * c, (q[0] - p[0]) * k];
  let mejor = { pos: 0, d: Infinity };
  for (let i = 0; i < ida.length - 1; i++) {
    const [ax, ay] = xy(ida[i]), [bx, by] = xy(ida[i + 1]);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < mejor.d) mejor = { pos: i + t, d };
  }
  return mejor;
}
export const redondear = (c) => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];

// ---------------------------------------------------------------- escritura (un punto por renglón)
export const CLAVES = ['id', 'numero', 'nombre', 'empresa', 'color', 'colorClaro', 'foto', 'tarifa', 'horario', 'frecuenciaMin', 'verificadaHace', 'circular'];
export const LISTAS = ['paraderos', 'ida', 'paraderosVuelta', 'vuelta'];
export function serializar(l) {
  const lineas = [];
  const ponerSimple = (k) => lineas.push(`  ${JSON.stringify(k)}: ${JSON.stringify(l[k])}`);
  CLAVES.filter((k) => k in l).forEach(ponerSimple);
  Object.keys(l).filter((k) => !CLAVES.includes(k) && !LISTAS.includes(k)).forEach(ponerSimple);
  const lista = (k, f) => { if (!(k in l)) return; const items = l[k].map((x) => `    ${f(x)}`); lineas.push(`  ${JSON.stringify(k)}: [${items.length ? '\n' + items.join(',\n') + '\n  ' : ''}]`); };
  const punto = (p) => (Array.isArray(p) ? `[${JSON.stringify(p[0])}, ${JSON.stringify(p[1])}]` : JSON.stringify(p));
  lista('paraderos', (p) => JSON.stringify(p));
  lista('ida', punto);
  lista('paraderosVuelta', (p) => JSON.stringify(p));
  lista('vuelta', punto);
  return `{\n${lineas.join(',\n')}\n}\n`;
}

// ---------------------------------------------------------------- lectura de archivos de mapas
const dec = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
// KML y GeoJSON guardan [longitud, latitud]; ÑanGO usa [latitud, longitud]. Aquí se da vuelta.
const pares = (txt) => txt.trim().split(/\s+/).map((t) => t.split(',').map(Number)).filter((a) => a.length >= 2 && a.every(Number.isFinite)).map((a) => redondear([a[1], a[0]]));

export function leerKML(txt) {
  const trazos = [], puntos = [];
  for (const m of txt.matchAll(/<Placemark[\s>][\s\S]*?<\/Placemark>/g)) {
    const b = m[0], nombre = (b.match(/<name>([\s\S]*?)<\/name>/) || [])[1];
    const n = nombre ? dec(nombre) : '';
    const ls = b.match(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const pn = b.match(/<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (ls) trazos.push({ nombre: n, pts: pares(ls[1]) });
    else if (pn) { const c = pares(pn[1])[0]; if (c) puntos.push({ nombre: n, c }); }
  }
  return { trazos, puntos };
}
export function leerGeoJSON(txt) {
  const j = JSON.parse(txt);
  const feats = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [{ geometry: j, properties: {} }];
  const trazos = [], puntos = [];
  for (const f of feats) {
    const g = f.geometry || {}, n = f.properties?.name || f.properties?.nombre || '';
    const inv = ([lo, la]) => redondear([la, lo]);
    if (g.type === 'LineString') trazos.push({ nombre: n, pts: g.coordinates.map(inv) });
    else if (g.type === 'MultiLineString') g.coordinates.forEach((c) => trazos.push({ nombre: n, pts: c.map(inv) }));
    else if (g.type === 'Point') puntos.push({ nombre: n, c: inv(g.coordinates) });
  }
  return { trazos, puntos };
}

// ---------------------------------------------------------------- validación
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrasteConBlanco = (hex) => 1.05 / (lum(hex) + 0.05);
const HEX = /^#[0-9a-fA-F]{6}$/, HORA = /^(1[0-2]|0?[1-9]):[0-5]\d (AM|PM)$/;
const ZONA = { lat: [-16.0, -15.0], lon: [-70.6, -69.7] };       // alrededor de Juliaca
const SALTO_KM = 1.5, PARADERO_LEJOS_KM = 0.15;

export function revisar(l, id, { existeFoto } = {}) {
  const errores = [], avisos = [];
  const e = (m) => errores.push(m), a = (m) => avisos.push(m);
  if (l.id !== id) e(`el "id" (${l.id}) debe ser igual al nombre del archivo (${id})`);
  for (const k of ['numero', 'nombre', 'empresa']) if (!l[k] || typeof l[k] !== 'string') e(`falta "${k}"`);
  if (/por confirmar/i.test(l.empresa || '')) a('la empresa está "por confirmar"');
  for (const k of ['color', 'colorClaro']) if (!HEX.test(l[k] || '')) e(`"${k}" debe ser un color tipo #C2410C`);
  if (HEX.test(l.color || '') && contrasteConBlanco(l.color) < 4.5) a(`"color" tiene poco contraste con el texto blanco (${contrasteConBlanco(l.color).toFixed(1)}:1, lo ideal es 4.5 o más)`);
  if (!l.foto) a('no tiene "foto"'); else if (existeFoto && !existeFoto(l.foto)) a(`no existe la foto ${l.foto}`);
  const t = l.tarifa || {};
  for (const k of ['adulto', 'universitario', 'escolar', 'nocturna']) if (typeof t[k] !== 'number' || t[k] <= 0) e(`tarifa.${k} debe ser un número mayor que 0`);
  if (t.nocturna < t.adulto) a('la tarifa nocturna es menor que la de adulto');
  if (t.porConfirmar) a('la tarifa está "por confirmar"');
  for (const k of ['inicio', 'fin', 'nocturnoDesde']) if (!HORA.test(l.horario?.[k] || '')) e(`horario.${k} debe verse así: "5:00 AM" o "10:30 PM"`);
  if (typeof l.frecuenciaMin !== 'number' || l.frecuenciaMin <= 0) e('"frecuenciaMin" debe ser un número mayor que 0');

  const ida = l.ida;
  const puntoOk = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  let kmTotal = 0;
  if (!Array.isArray(ida) || ida.length < 2) e('"ida" necesita al menos 2 puntos');
  else if (!ida.every(puntoOk)) e('"ida" tiene un punto que no es [latitud, longitud]');
  else {
    const invertido = ida.filter((p) => Math.abs(p[0]) > 90 || (Math.abs(p[0]) > 60 && Math.abs(p[1]) < 30)).length;
    if (invertido) e(`${invertido} puntos parecen tener latitud y longitud invertidas (debe ser [latitud, longitud], por ejemplo [-15.49, -70.13])`);
    else {
      const fuera = ida.filter((p) => p[0] < ZONA.lat[0] || p[0] > ZONA.lat[1] || p[1] < ZONA.lon[0] || p[1] > ZONA.lon[1]).length;
      if (fuera) a(`${fuera} puntos están fuera de la zona de Juliaca`);
      for (let i = 0; i < ida.length - 1; i++) {
        const d = km(ida[i], ida[i + 1]); kmTotal += d;
        if (d > SALTO_KM) a(`salto de ${d.toFixed(1)} km entre los puntos ${i + 1} y ${i + 2} (¿falta un tramo?)`);
        if (d === 0) a(`el punto ${i + 1} está repetido`);
      }
    }
  }
  const idaOk = Array.isArray(ida) && ida.length > 1 && ida.every(puntoOk);
  if ('circular' in l && typeof l.circular !== 'boolean') e('"circular" debe ser true o false');
  if (l.circular === true && idaOk) {
    const cierre = km(ida[0], ida[ida.length - 1]);
    if (cierre > 0.3) a(`está marcada "circular" pero el inicio y el final del recorrido están a ${Math.round(cierre * 1000)} m: el micro no cierra el circuito`);
    if ('vuelta' in l || 'paraderosVuelta' in l) a('las líneas circulares tienen un solo sentido: "vuelta" y "paraderosVuelta" no se usan');
  }

  // Paraderos de un sentido: nombres, coordenadas, distancia al recorrido y orden.
  const revisarParaderos = (ps, recorrido, campo) => {
    let conCoord = 0;
    if (!Array.isArray(ps) || ps.length < 2) { e(`"${campo}" necesita al menos 2`); return 0; }
    const nombres = ps.map((p) => (typeof p === 'string' ? p : p?.nombre));
    if (nombres.some((n) => !n || typeof n !== 'string')) e(`hay un paradero sin nombre en "${campo}"`);
    conCoord = ps.filter((p) => typeof p === 'object' && puntoOk(p?.c)).length;
    if (ps.some((p) => typeof p === 'object' && p && 'c' in p && !puntoOk(p.c))) e(`hay un paradero de "${campo}" con "c" mal escrito (debe ser [latitud, longitud])`);
    if (conCoord && conCoord < ps.length) a(`en "${campo}" solo ${conCoord} de ${ps.length} paraderos tienen coordenadas: completa todos o ninguno (si falta alguno, la app aproxima su lugar)`);
    if (new Set(nombres).size !== nombres.length) a(`hay nombres de paradero repetidos en "${campo}"`);
    if (conCoord === ps.length && recorrido) {
      let previo = -1;
      ps.forEach((p) => {
        const r = proyectar(recorrido, p.c);
        if (r.d > PARADERO_LEJOS_KM) a(`"${p.nombre}" (${campo}) está a ${Math.round(r.d * 1000)} m del recorrido`);
        if (r.pos + 0.5 < previo) a(`"${p.nombre}" (${campo}) aparece antes que el paradero anterior sobre el recorrido (revisa el orden)`);
        previo = Math.max(previo, r.pos);
      });
    }
    return conCoord;
  };
  const conCoord = revisarParaderos(l.paraderos, idaOk ? ida : null, 'paraderos');

  // Vuelta: si no hay, la app usa la ida al revés (misma calle de regreso).
  let sentidos = l.circular === true ? 'circular (un solo sentido)' : 'ida y vuelta por la misma calle';
  if ('vuelta' in l) {
    const v = l.vuelta;
    if (!(Array.isArray(v) && v.length >= 2 && v.every(puntoOk))) e('"vuelta" debe ser una lista de puntos [latitud, longitud]');
    else if (idaOk && l.circular !== true) {
      sentidos = 'vuelta propia';
      const lejos = Math.max(...v.map((p) => proyectar(ida, p).d));
      const alReves = km(v[0], ida[ida.length - 1]) < km(v[0], ida[0]);       // ¿la vuelta arranca donde termina la ida?
      if (lejos < 0.04 && alReves) { a('"vuelta" es la misma calle que la ida, en sentido contrario: puedes borrar "vuelta" y la app la deduce sola'); sentidos = 'ida y vuelta por la misma calle'; }
      else if (lejos < 0.04) a('"vuelta" va por las mismas calles y en el MISMO sentido que la ida: debe empezar donde termina la ida. Si es la misma calle, bórrala y la app la deduce al revés');
      else if (km(v[0], ida[ida.length - 1]) > 1) a(`la vuelta empieza a ${km(v[0], ida[ida.length - 1]).toFixed(1)} km del final de la ida: ¿está dibujada en el sentido correcto?`);
    }
  }
  if ('paraderosVuelta' in l) {
    const geom = Array.isArray(l.vuelta) && l.vuelta.length > 1 && l.vuelta.every(puntoOk) ? l.vuelta : idaOk ? [...ida].reverse() : null;
    revisarParaderos(l.paraderosVuelta, geom, 'paraderosVuelta');
  }
  return { errores, avisos, resumen: { puntos: ida?.length || 0, km: kmTotal, paraderos: l.paraderos?.length || 0, conCoord, sentidos } };
}


// ---------------------------------------------------------------- utilidades para crear y editar
export const ID_VALIDO = /^linea-[a-z0-9-]+$/;

/** Punto aproximado a la fracción f (0 a 1) del recorrido, igual que hace la app cuando un paradero no tiene coordenadas. */
export const puntoEn = (puntos, f) => puntos[Math.min(puntos.length - 1, Math.round((puntos.length - 1) * f))];

/** Línea nueva con valores de partida (hay que completar recorrido y paraderos). */
export function plantillaLinea(id, nombre) {
  const numero = id.replace(/^linea-/, '');
  return {
    id, numero, nombre: nombre || `Línea ${numero}`, empresa: 'POR CONFIRMAR',
    color: '#1D4ED8', colorClaro: '#7AA7FF', foto: `assets/img/lineas/${id}.png`,
    tarifa: { adulto: 1, universitario: 1, escolar: 1, nocturna: 1.5, porConfirmar: true },
    horario: { inicio: '5:00 AM', fin: '11:00 PM', nocturnoDesde: '10:00 PM' },
    frecuenciaMin: 8, verificadaHace: 'sin verificar', paraderos: [], ida: [],
  };
}

/** Solo se guardan los campos conocidos de una línea (lo demás se ignora). */
export function limpiarLinea(l) {
  const out = {};
  for (const k of [...CLAVES, ...LISTAS]) if (l[k] !== undefined) out[k] = l[k];
  return out;
}

/**
 * Texto con una coordenada por renglón ("latitud, longitud") -> puntos del recorrido.
 * Acepta coma, punto y coma o espacios entre los números, e ignora una altura al final.
 * Si vienen como "longitud, latitud" (como en Google Maps o GeoJSON) los da vuelta.
 */
export function leerCoordenadas(texto) {
  const puntos = [], errores = []; let invertidos = 0;
  String(texto).split(/\r?\n/).forEach((linea, i) => {
    if (!linea.trim()) return;
    const n = linea.match(/-?\d+(?:\.\d+)?/g);
    if (!n || n.length < 2) { errores.push(`renglón ${i + 1}: no encontré dos números`); return; }
    let a = Number(n[0]), b = Number(n[1]);
    if (Math.abs(a) > 60 && Math.abs(b) < 30) { [a, b] = [b, a]; invertidos++; }
    if (Math.abs(a) > 90 || Math.abs(b) > 180) { errores.push(`renglón ${i + 1}: coordenada fuera de rango`); return; }
    puntos.push(redondear([a, b]));
  });
  return { puntos, errores, invertidos };
}
export const formatoCoordenadas = (puntos) => puntos.map((p) => `${p[0]}, ${p[1]}`).join('\n');
