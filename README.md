# ÑanGO · Guía de transporte público de Juliaca

---

## Cómo abrirla en VS Code (3 pasos)

1. Descomprime la carpeta y ábrela con **VS Code** (`Archivo → Abrir carpeta`).
2. Instala la extensión **Live Server** (de Ritwick Dey). VS Code te la sugiere al abrir la carpeta.
3. Clic derecho sobre `index.html` → **Open with Live Server**. Se abre en el navegador.

Alternativa sin extensión (necesita Python): `python -m http.server 5173` dentro de la carpeta y abrir <http://localhost:5173>.

> No funciona haciendo doble clic sobre `index.html`: el navegador bloquea los módulos de JavaScript si no hay un servidor local. Requiere **internet** para el mapa, los íconos y las tipografías.


**Para usarla en tu celular de verdad (misma red Wi-Fi):**
1. Abre la app con Live Server en la computadora.
2. En la computadora abre una terminal y ejecuta `ipconfig`. Copia la **Dirección IPv4** (por ejemplo `192.168.1.15`).
3. En el celular, conectado al **mismo Wi-Fi**, abre el navegador y escribe `http://192.168.1.15:5500` (con tu IP).
4. Si no abre: acepta el aviso del Firewall de Windows (redes privadas) o desactívalo un momento para probar.
5. Para tenerla como ícono: menú del navegador → **Agregar a pantalla de inicio**. (La instalación como app completa requiere publicarla con **https**.)


**Para probar la hora punta:** abre `http://localhost:5500/?hora=7:45` (cambia la hora a gusto).

---

## Estructura

```
NanGO-proyecto/
├── index.html                 Estructura mínima: carga estilos, librerías y js/main.js
├── manifest.webmanifest       Datos para instalarla como app (PWA)
├── data/lineas/               LÍNEAS: un .json por línea + index.json (ver data/lineas/LEEME.md)
├── admin/                     Editor de líneas con mapa (solo para administradores: npm run admin)
├── tools/                     lineas.mjs (validar / importar), admin.mjs y scripts de datos (.py)
├── tests/                     routing.test.mjs, admin-api.test.mjs y rutas.html (npm test)
├── css/                       Estilos, uno por tema, en orden de carga
│   ├── 00-tokens.css          Colores, tipografía, medidas y modo oscuro  ← aquí se cambia la identidad visual
│   ├── 01-base.css            Reinicio y estructura de la app
│   ├── 02-components.css      Botones, chips, listas, hojas, diálogos, campos…
│   ├── 03-map.css             Mapa
│   ├── 04-flow.css            Carga, bienvenida y registro
│   ├── 05…10-*.css            Inicio · Buscar · Líneas · Avisos · Perfil · Modo viaje
│   └── 99-animations.css      Todas las animaciones
├── js/
│   ├── main.js                Arranque: registra las pantallas
│   ├── core/                  Núcleo: router, estado (store), traducciones (i18n), tema, utilidades
│   ├── screens/               UNA pantalla por archivo (home, search, lines, alerts, profile, trip…)
│   ├── components/            Piezas reutilizables: barra inferior, mapa, gráfico, hojas, toast…
│   ├── services/              LA LÓGICA (rutas, tiempos, avisos, sesión…)  ← aquí está la lógica
│   ├── data/                  Datos: lugares, calles, paraderos, hora punta, avisos (las líneas se cargan de data/lineas/)
│   └── i18n/                  Diccionarios de idiomas (en, qu, ay)
├── assets/img/                Logotipo, fotos de las líneas, planeta en capas, combis, portada
├── assets/icons/              Íconos de la app
└── docs/
    ├── GUIA-LOGICA.md         Qué reemplazar en la lógica y dónde
    ├── LOGICA-RUTAS.md        Cómo se calculan las rutas
    ├── DISENO.md              Colores, tipografías y componentes
    ├── PLAN-ANIMACIONES.md    Qué se anima y cómo
    ├── PENDIENTES.md          Datos por confirmar
    └── puntos-referencia/     Puntos originales de cada recorrido
```

## Pantallas incluidas

Carga (planeta con nubes y combi animadas) · Bienvenida · Registro/Ingreso · **Inicio** · **Buscar** (catálogo de 1 927 lugares, mapa con rutas cercanas, resultados, ruta paso a paso) · **Líneas** (lista y ficha de cada una con recorrido, tarifas y tráfico) · **Avisos** (lista, detalle, reportar) · **Perfil** (favoritos, historial, sin internet, idioma, tamaño del texto, ayuda) · **Modo viaje** (en curso, aviso de bajada, llegada).

## Tecnologías

HTML + CSS + JavaScript **sin compilar** (módulos ES), [Leaflet](https://leafletjs.com) + OpenStreetMap para el mapa, [Tabler Icons](https://tabler.io/icons), tipografías Inter y Barlow Condensed (Google Fonts). Sin frameworks ni `npm install`, para que cualquiera la abra y la entienda. Si se migra a React, Flutter u otro, los servicios y los datos se reutilizan tal cual.

## Créditos y licencias

Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL); el catálogo de lugares usa también datos abiertos de OpenStreetMap. Leaflet (BSD-2), Tabler Icons (MIT), Inter y Barlow Condensed (SIL OFL).

**Tipografía del saludo de Inicio:** *Dantene* (Grezline Studio), en `assets/fonts/Dantene.otf`. Su licencia es **solo para uso personal**: para publicar la app o usarla comercialmente hay que comprar la licencia en <https://grezlinestudio.com> o cambiar la fuente en `css/05-home.css`.

## Administración de líneas y pruebas

- **Editar líneas:** `npm run admin` y abrir <http://localhost:5173/admin/> (guía en `data/lineas/LEEME.md`). La app lee las líneas de `data/lineas/*.json` al arrancar.
- **Validar datos:** `npm run validar`.
- **Pruebas:** `npm test` (rutas y editor). `tests/rutas.html` revisa las rutas en el navegador.
- **Al publicar la app** sube solo `index.html`, `css/`, `js/`, `assets/`, `data/` y `manifest.webmanifest`; deja fuera `admin/`, `tools/` y `tests/`.
- Los recorridos copiados en `js/data/trazos.js` solo los usan los scripts de `tools/*.py` (calles y paraderos); la app usa `data/lineas/`. Si cambias el trazo de una línea en el editor, hay que volver a generar `calles.js` y `paraderos.js` con esos scripts.
