# Líneas de ÑanGO: cómo agregarlas y editarlas

Cada línea tiene su propio archivo en esta carpeta (`linea-60.json`, `linea-15.json`…).
El archivo `index.json` dice **cuáles líneas se muestran y en qué orden**.

Necesitas Node.js 18 o más nuevo para usar la herramienta (`tools/lineas.mjs`). Todo se ejecuta
desde la carpeta principal del proyecto.

## Editor para administradores (la forma más fácil)

Es una página con mapa para crear y corregir líneas sin tocar archivos a mano.

1. En una terminal, dentro de la carpeta del proyecto: `node tools/admin.mjs` (o `npm run admin`).
2. Abre **http://localhost:5173/admin/** en el navegador (necesita internet para mostrar el mapa).
3. A la izquierda eliges una línea o creas una nueva. Cada línea tiene 4 pestañas:
   - **Datos:** empresa, colores, tarifas, horario, frecuencia, foto y si es circular.
   - **Ida** y **Vuelta:** en el mapa eliges un modo:
     - ✎ **Dibujar:** cada clic agrega un punto al final del recorrido, en el orden en que pasa el micro.
     - 📍 **Paraderos:** cada clic pone un paradero. Se renombran y reordenan en la lista de abajo.
     - ✥ **Editar:** arrastras un punto para corregirlo, haces clic sobre la línea para agregar uno ahí y clic derecho sobre un punto lo borra.
     También puedes pegar el recorrido **por coordenadas**, importar un archivo **KML / GeoJSON** de Google My Maps, invertir el sentido y poner los paraderos escribiendo sus coordenadas.
   - **Revisión:** los mismos controles de `validar`, en vivo.
4. **Guardar** (o Ctrl+S) escribe los archivos de `data/lineas/`. **Deshacer** (o Ctrl+Z) vuelve atrás cualquier cambio.

Cosas que conviene saber:
- **Vuelta:** si la línea regresa por las mismas calles no hay que hacer nada (la app la deduce). Solo si regresa por otras calles, en la pestaña Vuelta pulsa *Dibujar la vuelta por otras calles*: arranca con la ida al revés y la corriges.
- **Paraderos sin ubicación:** las líneas actuales tienen solo los nombres. El botón *Ubicar los que faltan* los reparte sobre el recorrido (aproximado) y luego los arrastras a su lugar real.
- **Borradores:** una línea con errores se guarda como **borrador** y no se muestra en la app. Cuando queda sin errores, al guardar se publica sola. Una línea ya publicada que quedaría con errores **no se guarda**: el editor te dice qué corregir.
- **Orden y quitar:** con ▲ ▼ cambias el orden en que se muestran las líneas. ✕ la quita de la app (el archivo se conserva como borrador).
- **El dibujo no se pega a las calles solo:** hay que poner varios puntos en las curvas. Para trazar rápido siguiendo calles, dibuja en Google My Maps (que sí se ajusta a las calles) e importa el archivo.

**¿Solo para administradores?** El editor solo existe mientras tienes encendido `node tools/admin.mjs` en tu computador: el servidor atiende únicamente a ese computador y rechaza cualquier petición que no venga del propio editor. La app pública no incluye ninguna forma de escribir datos. Al publicar la app, **sube solo lo que la app necesita** (`index.html`, `css/`, `js/`, `assets/`, `data/` y `manifest.webmanifest`) y deja fuera `admin/`, `tools/` y `tests/`. Si varias personas administran, deben compartir los cambios entre sí (por ejemplo, con Git o una carpeta compartida) porque cada una edita los archivos de su propio computador. Un inicio de sesión real con roles llegará cuando las líneas pasen a una base de datos.

## Con la terminal (alternativa)


1. **Crea el archivo:**
   `node tools/lineas.mjs nueva linea-30 "Línea 30"`
   (el id va en minúsculas, sin tildes ni espacios, y empieza con `linea-`).
2. **Dibuja la línea en Google My Maps** (mymaps.google.com):
   - Crea un mapa y usa *Dibujar una línea* siguiendo las calles por las que pasa el micro.
   - Marca cada paradero con *Agregar marcador*, **en el orden del recorrido**, y ponle su nombre.
   - Usa **una capa por línea** para exportarlas por separado.
3. **Exporta:** menú ⋮ de la capa (o del mapa) → *Exportar a KML/KMZ* → marca
   *Exportar como KML en lugar de KMZ*.
4. **Importa:**
   `node tools/lineas.mjs importar linea-30 mi-mapa.kml`
   Carga el recorrido y los paraderos (con sus coordenadas) y revisa el resultado.
   También sirve un `.geojson` (por ejemplo de geojson.io).
   - `--solo-trazo` cambia solo el recorrido; `--solo-paraderos` cambia solo los paraderos.
   - `--tramo 2` elige la segunda línea dibujada si el archivo trae varias.
5. **Completa los datos** abriendo `data/lineas/linea-30.json`: empresa, tarifas, horario,
   frecuencia, colores y foto (ver la tabla de abajo).
6. **Revisa:** `node tools/lineas.mjs validar`
   Avisa de errores (✗) y de cosas dudosas (!). Con errores la herramienta termina en error.
7. **Pruébala en la app** recargando la página.

Para volver a importar un recorrido corregido, repite el paso 4: reemplaza lo que había.

## Qué lleva un archivo de línea

| Campo | Qué es | Ejemplo |
|---|---|---|
| `id` | Igual al nombre del archivo | `"linea-30"` |
| `numero` | Número o nombre corto (no se repite entre líneas) | `"30"` |
| `nombre` | Nombre que se ve en la app | `"Línea 30"` |
| `empresa` | Empresa de transporte | `"Empresa Unión J Perú"` |
| `color` | Color principal. Con texto blanco encima, debe tener buen contraste | `"#C2410C"` |
| `colorClaro` | Versión más clara del color | `"#FF8F4D"` |
| `foto` | Ruta de la foto del micro | `"assets/img/lineas/linea-30.png"` |
| `tarifa` | Precio por tipo de pasajero, en soles. `porConfirmar: true` si aún no está verificado | `{"adulto":1,"universitario":1,"escolar":1,"nocturna":1.5,"porConfirmar":false}` |
| `horario` | Primer y último servicio y desde cuándo rige la tarifa nocturna, con formato `5:00 AM` | `{"inicio":"5:00 AM","fin":"11:00 PM","nocturnoDesde":"10:00 PM"}` |
| `frecuenciaMin` | Cada cuántos minutos pasa un micro | `6` |
| `verificadaHace` | Texto que ve la persona | `"3 días"` |
| `paraderos` | Paraderos de la **ida**, en orden (ver abajo) | |
| `ida` | Recorrido de ida: lista de puntos `[latitud, longitud]` | `[-15.4985, -70.1333]` |
| `vuelta` | **Opcional.** Recorrido de regreso, solo si va por **otras calles** que la ida | |
| `paraderosVuelta` | **Opcional.** Paraderos de la vuelta, solo si son otros | |
| `circular` | **Opcional.** `true` si el micro da vueltas a un circuito y no regresa por otro lado | `true` |

**Ojo con el orden de los puntos:** primero la latitud (en Juliaca cerca de `-15.5`) y después la
longitud (cerca de `-70.1`). Google My Maps y GeoJSON los guardan al revés; la herramienta los da
vuelta sola al importar. Si editas a mano y los pones al revés, `validar` lo detecta.

## Ida y vuelta

El micro solo avanza en el sentido de su recorrido. Por eso la app maneja **dos sentidos** por línea
y, al buscar una ruta, elige el que realmente lleva del origen al destino (se ve como "Ida" o "Vuelta").

Hay tres casos y **no necesitas saber de antemano cuál es cada línea**:

1. **Regresa por las mismas calles** (lo más común): dibuja solo la `ida`. La app deduce la vuelta
   sola, al revés, con los mismos paraderos en orden inverso. No escribas `vuelta`.
2. **Regresa por otras calles:** además de la ida, importa la vuelta:
   `node tools/lineas.mjs importar linea-30 vuelta.kml --vuelta`
   (dibuja el regreso en otra capa de Google My Maps, con sus paraderos marcados en orden de regreso).
   Queda guardada como `vuelta` y `paraderosVuelta`.
3. **Circuito:** el micro da vueltas siempre en el mismo sentido y no tiene "regreso". Pon
   `"circular": true`. El recorrido debe cerrar el circuito (el final queda junto al inicio).

Si dudas entre 1 y 2, empieza con la ida sola: es lo mismo que decir "regresa por la misma calle".
Cuando confirmes que una línea regresa por otro lado (por ejemplo, viéndolo en un recorrido real),
agregas su vuelta después sin tocar nada más. `validar` te avisa si una vuelta que cargaste es en
realidad la misma calle de la ida (para que la borres) o si quedó dibujada en el sentido equivocado.

## Paraderos

Hay dos formas de escribirlos, y se pueden mezclar, pero conviene **todos de una forma o todos de la otra**:

```json
"paraderos": [
  "Km 3 Salida Coata",
  "Av. Modesto Borda"
]
```
Solo el nombre. La app calcula su lugar aproximado repartiéndolos a lo largo del recorrido.

```json
"paraderos": [
  {"nombre": "Km 3 Salida Coata", "c": [-15.52189, -70.07989]},
  {"nombre": "Av. Modesto Borda", "c": [-15.51851, -70.08687]}
]
```
Con coordenadas reales. La app los dibuja en su lugar exacto y, al armar una ruta, elige el
paradero más cercano. Es la forma recomendada: así lo deja la importación desde Google My Maps.

`validar` avisa si algún paradero está lejos del recorrido o fuera de orden.

## Editar a mano

Es un archivo JSON: los textos van entre comillas, hay una coma entre elementos y ninguna después
del último. Si te equivocas, `validar` dice qué archivo y qué falló, y mientras tanto la app
**salta esa línea** (y muestra las demás) avisando en la consola del navegador.

Si agregas un archivo a mano, anótalo también en `index.json`; si no, la app no lo muestra.
