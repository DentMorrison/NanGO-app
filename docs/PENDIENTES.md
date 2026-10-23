# Pendientes

## Datos
- [ ] Paraderos reales de las 3 líneas, con nombre y coordenada (hoy salen de `js/data/paraderos.js`, ubicados con los nombres del prototipo).
- [ ] Tarifas de universitario y escolar, y confirmar la nocturna de S/ 1.50 (`porConfirmar: true` en `js/data/lineas.js`).
- [ ] Horarios y frecuencias de cada línea.
- [ ] Hora punta real por línea y por día (hoy son franjas de referencia: 7:30–8, 12–1, 2–3 y 6–8 PM).
- [ ] Recorrido de vuelta, si usa otras calles (hoy es la ida invertida).
- [ ] Más líneas de Juliaca: datos, recorrido y foto.
- [ ] Revisar el catálogo de lugares (`js/data/lugares.js`).
- [ ] Traducciones al quechua y al aymara (`js/i18n/qu.js`, `ay.js`) y revisión del inglés.
- [ ] Número de WhatsApp y correo reales en `screens/profile-pages.js`.

## Lógica (ver `GUIA-LOGICA.md`)
- [ ] Cuentas reales (registro, ingreso, Google).
- [ ] Avisos con servidor y moderación.
- [ ] Rutas con paraderos reales.
- [x] Librerías locales (`npm run vendor`) y mapa guardado de Juliaca (`assets/mapa/juliaca.pmtiles`), comprobados sin internet en el navegador.
- [ ] Probar el mapa guardado y el ingreso con Google dentro del APK (ver `docs/OFFLINE.md`).
- [x] Se quitó la fila "Paquetes offline" del Perfil (era una simulación). La pantalla sigue en `profile-pages.js` (ruta `offline`) sin entrada; si se retoma, convertirla en "Uso sin internet" con el estado real del mapa guardado y un botón "Actualizar datos de las líneas".
- [ ] Vibración y avisos del modo viaje en segundo plano.
- [x] Elegir un lugar tocando el mapa (`components/mapa-picker.js`; la calle sale de `calleCerca()`, sin servicios externos).
- [ ] Desplegar la Edge Function `expandir-enlace` para leer enlaces cortos de Google Maps (`supabase functions deploy expandir-enlace --no-verify-jwt`).
- [ ] Páginas de privacidad y términos.

## Imágenes
- A las fotos de las líneas se les ocultó el emblema y las placas. Hacer lo mismo con fotos nuevas.
- El logotipo y el lettering están en PNG; falta una versión vectorial (SVG).

- [ ] Volver a ejecutar `supabase/schema.sql` en el SQL Editor de Supabase: activa la vigencia de avisos, la columna `profiles.trips` (historial de viajes por cuenta) y la función `mis_estadisticas()` del Perfil. Ver `docs/GUIA-LOGICA.md`.

- [ ] Confirmar el correo de contacto: la Ayuda usa `nango.juliaca@gmail.com` (`js/core/config.js`), pero los textos legales (`js/legal/privacy_es.js` y `terms_es.js`) dicen `App_ñanGo@gmail.com`, que además lleva una ñ y no es un correo válido de Gmail. Dejar uno solo en los tres sitios.
- [ ] Quechua y aymara: la pantalla de Ayuda y casi toda la app siguen en español en esos idiomas (están marcados `pendiente`). Pedir la traducción a una persona hablante antes de activarlos.
- [ ] La pregunta "¿Funciona sin internet?" de Ayuda solo es cierta cuando el APK ya trae librerías y mapa guardados (ver `docs/OFFLINE.md`); comprobarlo en un teléfono sin señal antes de publicar.
