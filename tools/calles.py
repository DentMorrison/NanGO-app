import re, json, math, time, urllib.request, sys
src = open(sys.argv[1], encoding="utf-8").read()
out = {}
claves = [(m.group(1), m.start(), m.end()) for m in re.finditer(r"'(linea-[\w]+)'", src)]
for n_, (k_, s_, e_) in enumerate(claves):
    fin = claves[n_+1][1] if n_+1 < len(claves) else len(src)
    out[k_] = [(float(a), float(b)) for a, b in re.findall(r"\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]", src[e_:fin])]
print({k: len(v) for k, v in out.items()}, flush=True)
def km(a, b):
    R = 6371; p = math.pi / 180
    dl = (b[0]-a[0])*p; dn = (b[1]-a[1])*p
    x = math.sin(dl/2)**2 + math.cos(a[0]*p)*math.cos(b[0]*p)*math.sin(dn/2)**2
    return 2*R*math.asin(math.sqrt(x))
muestras = {}
for k, pts in out.items():
    sel = [0]; acc = 0
    for i in range(1, len(pts)):
        acc += km(pts[i-1], pts[i])
        if acc >= 0.22:
            sel.append(i); acc = 0
    if sel[-1] != len(pts)-1: sel.append(len(pts)-1)
    muestras[k] = sel
print({k: len(v) for k, v in muestras.items()}, flush=True)
res = {}
n = 0
for k, sel in muestras.items():
    res[k] = []
    for i in sel:
        lat, lon = out[k][i]
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&accept-language=es&lat={lat}&lon={lon}"
        req = urllib.request.Request(url, headers={"User-Agent": "NanGO-student-project/1.0 (UNAJ, transport guide Juliaca)"})
        calle = None
        for intento in range(3):
            try:
                d = json.load(urllib.request.urlopen(req, timeout=30))
                a = d.get("address", {})
                calle = a.get("road") or a.get("pedestrian") or a.get("footway") or a.get("path") or None
                break
            except Exception as e:
                time.sleep(3)
        res[k].append({"i": i, "c": [lat, lon], "calle": calle})
        n += 1
        if n % 20 == 0: print(n, flush=True)
        time.sleep(1.2)
    json.dump(res, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
json.dump(res, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
print("LISTO", flush=True)
