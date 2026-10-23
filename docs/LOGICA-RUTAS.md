# Rutas, calles y modo viaje

Descripción de cómo se calculan los viajes y de dónde salen los datos que usan. El código está en `js/services/`.

## Cálculo de una ruta (`routing.service.js`)

1. Cada línea es un recorrido de ida (`js/data/trazos.js`). La micro sube y baja por el mismo trazo, así que el tramo entre dos puntos mide lo mismo en cualquier sentido.
2. Del recorrido se toman los puntos cercanos al origen y al destino. Primero se buscan a 400 m o menos; si no hay ninguno, hasta 900 m.
3. Con una sola micro se elige la pareja de subida y bajada con menor tiempo total (caminar + ir en micro).
4. Con transbordo se buscan dos líneas que pasen a menos de 300 m una de otra. Solo se ofrece cuando no hay micro directa o cuando ahorra al menos 8 minutos.
5. Tiempo mostrado: caminata + espera (por frecuencia de la línea) + micro a 16 km/h + recargo de hora punta. La caminata se multiplica por 1,25 por los rodeos de las calles.
6. Cada opción lleva un `nivel` según lo que se camina en cada extremo: `cerca` (hasta 250 m), `media` (hasta 400 m) o `lejos`. Las de nivel `cerca` van primero.

## Líneas que pasan por un lugar (`lines.service.js`)

La distancia entre un lugar y una línea se mide contra los tramos del trazo (proyección sobre cada segmento), no solo contra sus puntos.

- Hasta 250 m: la línea pasa por ahí.
- Entre 250 y 400 m: se muestra aparte, con la distancia y los minutos a pie.
- Más de 400 m: solo se indica cuál es la más cercana y a cuánto queda.

## Datos

- `js/data/lugares.js`: coordenadas del catálogo contrastadas con OpenStreetMap. Las calles tienen un solo punto, por eso solo se usan como nombre aproximado.
- `js/data/calles.js`: calle más cercana cada ~220 m de cada recorrido (OpenStreetMap, Nominatim). Es la fuente de los nombres de calle de las instrucciones.
- `js/data/paraderos.js`: paraderos con nombre ubicados sobre el recorrido. Se descartan los que quedan a más de 500 m.
- `js/data/lineas.js`: agrega puntos intermedios al trazo para que ninguno quede a más de ~40 m del siguiente.

Para regenerar `calles.js` y `paraderos.js` están los scripts de `tools/` (respetar el límite de 1 consulta por segundo de Nominatim). Los datos de OpenStreetMap son © colaboradores de OpenStreetMap, licencia ODbL.

## Modo viaje (`trip.service.js`)

Un viaje es una lista de tramos, uno por micro. Cada tramo trae solo los paraderos entre donde se sube y donde se baja.

- `iniciarOpcion(opcion)`: viaje calculado en Buscar, con o sin transbordo.
- `iniciarTramoLinea(lineaId, kSube, kBaja)`: viaje en una línea conocida; si `kSube > kBaja` va de vuelta.
- `cambiarDeMicro()`: pasa al siguiente tramo en un transbordo.

## Lo que sigue aproximado

| Dato | Hoy | Hace falta |
|---|---|---|
| Paraderos | Nombres del prototipo ubicados sobre el recorrido | Paraderos reales con coordenadas |
| Vuelta | La ida invertida (`linea.vuelta`) | Trazo real en `trazos.js` |
| Tarifas de universitario, escolar y nocturna | Iguales al adulto | Tarifas de cada empresa |
| Espera y tiempos | Según la frecuencia | Datos en vivo |
| Líneas | 3 | Más líneas registradas |

## Pruebas

`tests/rutas.html` (con Live Server) comprueba que se suba y se baje cerca de lo pedido, que los tramos y tiempos sean razonables, que ida y vuelta se parezcan, que los recorridos no tengan huecos y que los lugares clave coincidan con OpenStreetMap.
