"""corregir las coordenadas aproximadas (3 decimales) del catálogo con datos de OpenStreetMap (Nominatim)."""
import json, math, re, sys, time, unicodedata, urllib.parse, urllib.request

ENTRADA, SALIDA_JS, SALIDA_LOG = sys.argv[1], sys.argv[2], sys.argv[3]
UA = {"User-Agent": "NanGO-student-project/1.0 (UNAJ, transport guide Juliaca)"}
txt = open(ENTRADA, encoding="utf-8").read()
PAT = re.compile(r"\{n:'((?:[^'\\]|\\.)*)',c:\[(-?[\d.]+),(-?[\d.]+)\],t:'([^']*)'\}")
STOP = {"de", "del", "la", "las", "los", "el", "y", "e", "a", "en", "no", "n", "nº", "inicial", "institucion", "educativa", "educacion", "juliaca", "av", "jr", "avenida", "jiron", "calle", "pasaje", "urb", "urbanizacion", "parque", "plaza", "mercado", "colegio", "hospital", "estadio", "terminal"}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def palabras(s):
    return {w for w in re.findall(r"[a-z0-9]+", norm(s)) if w not in STOP and len(w) > 2}


def km(a, b):
    R, p = 6371, math.pi / 180
    dl, dn = (b[0] - a[0]) * p, (b[1] - a[1]) * p
    x = math.sin(dl / 2) ** 2 + math.cos(a[0] * p) * math.cos(b[0] * p) * math.sin(dn / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def expandir(n):
    n = re.sub(r"^Av\. ", "Avenida ", n)
    n = re.sub(r"^Jr\. ", "Jirón ", n)
    n = re.sub(r"^Urb\. ", "Urbanización ", n)
    n = re.sub(r"\(.*?\)", "", n)
    return n.strip()


def decimales(v):
    return len(v.split(".")[1]) if "." in v else 0


cambios, log = {}, []
for m in PAT.finditer(txt):
    n, lat, lon, t = m.group(1).replace("\\'", "'"), m.group(2), m.group(3), m.group(4)
    if (decimales(lat) > 4 and decimales(lon) > 4) or t == 'Avenidas y jirones' or n.startswith(('Institución', 'Nuestra Señora', 'Jardín', 'Urbanización', 'Parque', 'Cancha')) or n in ('UNAJ', 'Universidad Nacional de Juliaca'):   # las calles son largas: un solo punto no sirve para corregirlas
        continue
    q = expandir(n) + ", Juliaca"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 5, "accept-language": "es", "viewbox": "-70.20,-15.43,-70.05,-15.57", "bounded": 1})
    res = []
    for intento in range(3):
        try:
            res = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
            break
        except Exception:
            time.sleep(3)
    objetivo = palabras(n)
    mejor = None
    for r in res:
        nombre = r.get("display_name", "").split(",")[0]
        comunes = objetivo & palabras(nombre)
        if objetivo and comunes and len(comunes) >= max(1, math.ceil(len(objetivo) / 2)):
            mejor = (r, nombre)
            break
    actual = [float(lat), float(lon)]
    if mejor:
        r, nombre = mejor
        nuevo = [round(float(r["lat"]), 5), round(float(r["lon"]), 5)]
        dist = round(km(actual, nuevo) * 1000)
        cambios[(n, lat, lon)] = nuevo
        log.append({"n": n, "estado": "corregido", "osm": nombre, "mueve_m": dist, "nuevo": nuevo})
    else:
        log.append({"n": n, "estado": "sin coincidencia (se deja igual)", "candidatos": [r.get("display_name", "")[:50] for r in res[:2]]})
    print(log[-1], flush=True)
    time.sleep(1.2)


def sustituir(m):
    n, lat, lon, t = m.group(1), m.group(2), m.group(3), m.group(4)
    nuevo = cambios.get((n.replace("\\'", "'"), lat, lon))
    if not nuevo:
        return m.group(0)
    return "{n:'%s',c:[%s,%s],t:'%s'}" % (n, nuevo[0], nuevo[1], t)


open(SALIDA_JS, "w", encoding="utf-8").write(PAT.sub(sustituir, txt))
json.dump(log, open(SALIDA_LOG, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("LISTO", len(cambios), "corregidos de", len(log), flush=True)
