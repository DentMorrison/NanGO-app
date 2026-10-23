# Usar ÑanGO sin internet (APK / PWA)

La app ya lleva dentro del proyecto las líneas, paraderos, tarifas, el catálogo de lugares, las fotos y el
cálculo de rutas. Lo único que pedía a internet son **las librerías** y **el dibujo del mapa**.

## 1. Librerías locales (una sola vez)

```
npm run vendor
```

Descarga Leaflet, Tabler Icons, las letras (Inter y Barlow Condensed, solo latín) y supabase-js a
`assets/vendor/`. `index.html` y `js/services/supabase.js` buscan primero esos archivos y, si no están,
usan internet como antes. **Sube `assets/vendor/` al repositorio** y déjala dentro del APK.

Para comprobarlo: abre la app, en las herramientas del navegador (F12 → Network) marca **Offline** y
recarga. Los íconos, las letras y el mapa (sin fondo todavía) deben verse.

## 2. Mapa de Juliaca guardado (opcional pero recomendado)

Sin esto, el fondo del mapa (calles) se descarga de OpenStreetMap al moverlo. No conviene guardar esas
imágenes en masa: su política lo prohíbe. La forma correcta es un archivo de mapa propio, **PMTiles**:

1. Instala la herramienta `pmtiles` (https://github.com/protomaps/go-pmtiles/releases).
2. Elige una versión reciente en https://maps.protomaps.com/builds/ y ejecuta (cambia la fecha):

```
pmtiles extract https://build.protomaps.com/AAAAMMDD.pmtiles assets/mapa/juliaca.pmtiles --bbox=-70.22,-15.56,-70.05,-15.43 --maxzoom=15
```

3. Si no está `assets/vendor/protomaps-leaflet/`, ejecuta `npm run vendor` (esa pieza es opcional y la
   descarga al final).

La app elige el mapa según la situación (`components/map.js`):

| Situación | Mapa que se ve |
|---|---|
| Con internet | OpenStreetMap en línea (más detalle, zoom hasta 19) |
| Sin internet al abrir el mapa | El guardado (`juliaca.pmtiles`) |
| Se pierde el internet con el mapa abierto | Cambia solo al guardado |
| Vuelve el internet | Cambia solo al de en línea |
| El teléfono dice "conectado" pero las baldosas no llegan (wifi sin datos) | Cambia al guardado tras 4 baldosas fallidas |

Si no existe `assets/mapa/juliaca.pmtiles`, siempre usa OpenStreetMap. El mapa guardado tiene menos detalle
al acercarse: los mapas vectoriales de Protomaps llegan hasta el zoom 15 y de ahí solo se amplían.

## 3. Qué sigue necesitando internet

- Crear cuenta, ingresar, ver y votar avisos, sincronizar favoritos (sin internet queda el modo local).
- Pegar un enlace corto de Google Maps (lo expande la función `expandir-enlace`).
- La ruta caminando por calles (`rutaCaminata` en `services/geo.js`, usa OSRM); sin internet dibuja una línea recta.

## 4. Qué está comprobado y qué falta

Comprobado en Chromium con todo lo externo bloqueado (sin internet) y `serve_nango.py`:
- La app abre y se ven las letras, los íconos y las fotos desde `assets/vendor/`.
- "Elegir en el mapa" dibuja el mapa guardado, sin ningún pedido a OpenStreetMap, y la calle cercana sale de `calleCerca()`.
- Si falta `assets/mapa/juliaca.pmtiles`, vuelve al mapa en línea.

Falta probarlo en el teléfono:
- El mapa guardado lee el archivo por partes (peticiones Range). Con `serve_nango.py` funciona; dentro del APK
  (Capacitor) hay que confirmarlo. Si el mapa queda en blanco, revisar cómo se sirve el archivo.
- Ingreso con Google dentro del APK: necesita configurar el enlace de retorno (deep link) en Supabase y Capacitor.
- Los servidores simples que no aceptan Range (por ejemplo `python -m http.server`) no sirven para el mapa guardado.
  Usa `python serve_nango.py`.
