import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
PART = {"de", "del", "la", "las", "los", "el", "y", "e", "a", "en"}


def tc(nombre):
    if not nombre:
        return None
    out = []
    for i, x in enumerate(nombre.strip().split()):
        if x.lower() in PART and i > 0:
            out.append(x.lower())
        elif x.isupper() and len(x) <= 3 and i > 0:
            out.append(x)
        else:
            out.append(x[:1].upper() + x[1:].lower() if (x.islower() or x.isupper()) else x)
    return " ".join(out)


cab = [
    "// CALLES REALES por donde pasa cada línea.",
    "// Fuente: OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL). Se consultó la calle más cercana",
    "// cada ~220 m del recorrido con Nominatim (geocodificación inversa).",
    "// Cada punto: { i: posición en linea.ida, c: [lat, lon], calle: nombre o null }.",
    "// Para actualizarlo, volver a ejecutar la consulta (ver docs/LOGICA-RUTAS.md).",
    "export const CALLES_LINEA = {",
]
lineas = list(cab)
for k, v in d.items():
    lineas.append("  '%s': [" % k)
    for s in v:
        c = tc(s["calle"])
        nombre = json.dumps(c, ensure_ascii=False) if c else "null"
        lineas.append("    { i: %d, c: [%.6f, %.6f], calle: %s }," % (s["i"], s["c"][0], s["c"][1], nombre))
    lineas.append("  ],")
lineas.append("};")
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(lineas) + "\n")
print("ok", {k: len(v) for k, v in d.items()})
nombres = sorted({tc(s["calle"]) for v in d.values() for s in v if s["calle"]})
print(len(nombres), " | ".join(nombres))
