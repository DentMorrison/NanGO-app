import json, math, re, sys, unicodedata

RAIZ, SALIDA = sys.argv[1], sys.argv[2]
leer = lambda ruta: open(RAIZ + "/" + ruta, encoding="utf-8").read()
STOP = {"de", "del", "la", "las", "los", "el", "y", "e", "a", "en", "av", "jr", "avenida", "jiron", "calle", "urb", "urbanizacion", "km", "carretera", "salida", "centro", "parque", "mercado", "colegio", "plaza", "cementerio"}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def claves(s):
    return [w for w in re.findall(r"[a-z0-9]+", norm(s)) if w not in STOP and len(w) > 1]


def km(a, b):
    R, p = 6371, math.pi / 180
    dl, dn = (b[0] - a[0]) * p, (b[1] - a[1]) * p
    x = math.sin(dl / 2) ** 2 + math.cos(a[0] * p) * math.cos(b[0] * p) * math.sin(dn / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


# --- datos
src = leer("js/data/trazos.js")
ks = [(m.group(1), m.end()) for m in re.finditer(r"'(linea-[\w]+)'", src)]
trazos = {}
for n, (k, fin) in enumerate(ks):
    hasta = ks[n + 1][1] if n + 1 < len(ks) else len(src)
    trazos[k] = [(float(a), float(b)) for a, b in re.findall(r"\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]", src[fin:hasta])]
lin = leer("js/data/lineas.js")
nombres = {m.group(1): re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(2)) for m in re.finditer(r"id: '(linea-[\w]+)'.*?paraderos: \[(.*?)\]", lin, re.S)}
catalogo = [(m.group(1).replace("\\'", "'"), (float(m.group(2)), float(m.group(3))), m.group(4)) for m in re.finditer(r"\{n:'((?:[^'\\]|\\.)*)',c:\[(-?[\d.]+),(-?[\d.]+)\],t:'([^']*)'\}", leer("js/data/lugares.js"))]
calles = {}
for m in re.finditer(r"'(linea-[\w]+)': \[(.*?)\n  \]", leer("js/data/calles.js"), re.S):
    calles[m.group(1)] = [(float(a), float(b), c) for a, b, c in re.findall(r"c: \[(-?[\d.]+), (-?[\d.]+)\], calle: (\"[^\"]*\"|null)", m.group(2)) if c != "null"]
    calles[m.group(1)] = [(a, b, json.loads(c)) for a, b, c in calles[m.group(1)]]


def proyectar(pts, c):
    mejor = (1e9, 0)
    for i, p in enumerate(pts):
        d = km(p, c)
        if d < mejor[0]:
            mejor = (d, i)
    return mejor


def candidatos(linea, nombre):
    pts = trazos[linea]
    base = re.sub(r"\(.*?\)", "", nombre).strip()
    base = re.sub(r"^Km \d+ ", "", base)
    base = re.sub(r"^Av\. ", "Avenida ", base)
    base = re.sub(r"^Jr\. ", "Jirón ", base)
    base = re.sub(r"^Urb\. ", "Urbanización ", base)
    k = claves(base)
    out = []
    if not k:
        return out
    es_calle = bool(re.match(r"^(Av\.|Jr\.|Avenida|Jirón|Carretera|Km|Óvalo Av)", nombre))
    en_ruta = lambda texto: sum(1 for w in k if any(p.startswith(w[:5]) or w.startswith(p[:5]) for p in re.findall(r"[a-z0-9]+", norm(texto)) if len(p) > 1 and len(w) > 1)) >= max(1, math.ceil(len(k) * 0.67))
    # 1) calles reales por donde pasa la línea
    if es_calle or "salida" in norm(nombre):
        for la, lo, calle in calles.get(linea, []):
            if en_ruta(calle):
                out.append(((la, lo), "calle real: " + calle))
    # 2) catálogo: primero el nombre exacto; si no, coincidencia de palabras dentro del mismo tipo de lugar
    exacto = norm(re.sub(r"\(.*?\)", "", nombre).strip())
    for n, c, t in catalogo:
        if norm(n) == exacto:
            out.append((c, "catálogo (exacto): " + n))
    if not out:
        for n, c, t in catalogo:
            if es_calle != (t == "Avenidas y jirones"):
                continue
            if not es_calle and t == "Educación" and not re.search(r"colegio|polit|unaj|institu|universidad", norm(nombre)):
                continue
            if en_ruta(n):
                out.append((c, "catálogo: " + n))
    return out


lineas_out, informe = {}, []
for linea, lista in nombres.items():
    pts = trazos[linea]
    resueltos = []
    for nombre in lista:
        mejor = None
        for c, fuente in candidatos(linea, nombre):
            d, i = proyectar(pts, c)
            if mejor is None or d < mejor[0]:
                mejor = (d, i, c, fuente)
        if mejor is None:
            informe.append((linea, nombre, "SIN DATOS", "-"))
            continue
        d, i, c, fuente = mejor
        if d > 0.5:
            informe.append((linea, nombre, "DESCARTADO (a %d m del recorrido)" % round(d * 1000), fuente))
            continue
        resueltos.append({"nombre": nombre, "idx": i, "c": pts[i], "dist": round(d * 1000), "fuente": fuente})
    # El orden de la lista original no importa: cada paradero se ubica por su posición real sobre el recorrido.
    resueltos.sort(key=lambda r: r["idx"])
    final = []
    for r in resueltos:
        if final and abs(r["idx"] - final[-1]["idx"]) < 2:      # dos nombres casi en el mismo punto: se queda el más cercano al recorrido
            if r["dist"] < final[-1]["dist"]:
                informe.append((linea, final[-1]["nombre"], "REEMPLAZADO por " + r["nombre"], ""))
                final[-1] = r
            else:
                informe.append((linea, r["nombre"], "DESCARTADO (muy cerca de " + final[-1]["nombre"] + ")", ""))
            continue
        final.append(r)
    for r in final:
        informe.append((linea, r["nombre"], "OK a %d m del recorrido (posición %d)" % (r["dist"], r["idx"]), r["fuente"]))
    lineas_out[linea] = final

cab = ["// PARADEROS CON NOMBRE ubicados sobre el recorrido real de cada línea.",
       "// Se generaron buscando cada nombre entre las calles reales de la línea (data/calles.js) y en el catálogo de lugares,",
       "// y se descartaron los que no quedan cerca del recorrido o que rompen su orden. Para regenerarlos: tools/resolver_paraderos.py.",
       "// Cada paradero: { nombre, c: [lat, lon] (punto del recorrido), dist: metros entre el lugar y el recorrido, fuente }.",
       "export const PARADEROS_REALES = {"]
for linea, lst in lineas_out.items():
    cab.append("  '%s': [" % linea)
    for r in lst:
        cab.append("    { nombre: %s, c: [%.6f, %.6f], dist: %d, fuente: %s }," % (json.dumps(r["nombre"], ensure_ascii=False), r["c"][0], r["c"][1], r["dist"], json.dumps(r["fuente"], ensure_ascii=False)))
    cab.append("  ],")
cab.append("};")
open(SALIDA, "w", encoding="utf-8").write("\n".join(cab) + "\n")
for f in informe:
    print(" | ".join(f))
