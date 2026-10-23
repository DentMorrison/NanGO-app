# Guía de la lógica

Las pantallas funcionan con datos y cálculos de ejemplo. Aquí está qué reemplazar y dónde, sin tocar las pantallas.

## Cómo está organizado

```
screens/  (cómo se ve)  →  services/  (qué hace)  →  data/ + store  (de dónde sale)
```

- Las pantallas solo llaman a funciones de `js/services/`.
- Cada servicio trae arriba un comentario `TODO(lógica)` con lo que falta.
- Mientras se conserven los nombres de las funciones y la forma de lo que devuelven, las pantallas siguen funcionando.

## Servicios

| Archivo | Hoy | Falta |
|---|---|---|
| `services/auth.service.js` | Conectado a **Supabase**: alta e ingreso con correo y contraseña, ingreso con Google, confirmación por correo, recuperación de contraseña, aceptación de términos y eliminación de cuenta. Si no hay internet o falta configuración, cae en **MODO DEMO** (la sesión queda en el teléfono). Funciones: `registrar`, `ingresar`, `ingresarConGoogle`, `continuarComoInvitado`, `salir`, `reenviar`, `olvide`, `nuevaClave`, `aceptarTerminos`, `eliminarCuenta`. | En Supabase: habilitar el proveedor Google en *Authentication → Providers* y ejecutar `supabase/schema.sql` (crea tablas, permisos y RPC). La URL y la clave publicable se pegan en `js/services/supabase.js`. |
| `services/alerts.service.js` | Conectado a **Supabase** (`alerts` y `alert_votes`). Todos ven los avisos; reportar y votar requiere cuenta. Un aviso pasa a publicado con 2 confirmaciones y se da de baja con 5 “Ya no”. Sin conexión usa los ejemplos de `data/avisos.js`. | Panel de moderación y caducidad automática de avisos viejos. |
| `services/routing.service.js` | Opciones con una micro o un transbordo, según cercanía a los recorridos (ver `LOGICA-RUTAS.md`). | Paraderos reales y sentido real de ida y vuelta. |
| `services/eta.service.js` | “Próximo en N min” sale de la frecuencia de la línea (no es en vivo). | Horarios reales si las empresas los entregan. |
| `services/rush.service.js`, `data/horas.js` | Franjas de referencia: 7:30–8, 12–1, 2–3 y 6–8 PM; sábado ×0,75 y domingo ×0,5. | Datos reales por línea y por día. |
| `services/lines.service.js` | Paraderos ubicados con `data/paraderos.js`; cercanía de líneas a un punto. | Paraderos reales con coordenadas. |
| `services/trip.service.js` | El viaje avanza al pulsar “Ya pasé este paradero”. | Vibración y notificaciones con la app en segundo plano. |
| `services/favorites.service.js`, `services/sync.service.js`, `core/store.js` | Con cuenta, favoritos, historial y atajos se sincronizan con la tabla `profiles` de **Supabase**; sin cuenta quedan en `localStorage`. | Resolver conflictos entre varios dispositivos (hoy, al ingresar gana la nube). |
| `services/places.service.js` | Lee `data/lugares.js` (1 927 lugares). | Mantener el catálogo o pedirlo a un servidor. |
| `screens/profile-pages.js` → `offline` | Las descargas son un interruptor visual. | Descarga real de datos y mapa (Service Worker). |
| `components/map.js` | OpenStreetMap en línea; si existe `assets/mapa/juliaca.pmtiles` usa el mapa guardado (ver `docs/OFFLINE.md`). | Generar el archivo del mapa y probarlo en el APK. |

## Nube (Supabase)
- **Datos por cuenta:** favoritos, lugares guardados, historial de búsquedas e historial de viajes se guardan en `profiles` (columnas `favorite_lines`, `shortcuts`, `history`, `trips`) y se recuperan al ingresar en otro teléfono. Al cerrar sesión o borrar la cuenta se borran de este teléfono (`datosPersonalesVacios()` en `store.js`); las preferencias (idioma, tema, tamaño) se conservan. Una persona invitada que se registra sí sube lo que ya tenía.
- **Vigencia de los avisos:** cada aviso vence solo. Las horas por tipo están en la tabla `alert_vigencia` (Supabase → Table Editor → columna `horas`); `schema.sql` calcula `alerts.expira_at` al crear el aviso, lo alarga cuando alguien lo confirma y la app (`alerts.service.js`) solo muestra los vigentes. Los avisos de ejemplo no vencen.
- **Enlaces cortos de Google Maps:** `supabase/functions/expandir-enlace` sigue la redirección de `maps.app.goo.gl` (solo dominios de Google) y `services/enlaces.service.js` la llama desde el selector del mapa. Despliegue: `supabase functions deploy expandir-enlace --no-verify-jwt`.

- Un solo cliente en `js/services/supabase.js` (ahí se pegan la URL y la clave publicable). Todos los servicios lo comparten.
- `supabase/schema.sql` crea todo lo del servidor: tablas `profiles`, `alerts` y `alert_votes`; sus permisos (RLS + `GRANT`); las funciones `accept_terms`, `delete_my_account` y `votar_aviso`; y unos avisos de ejemplo.
- Pasos: crear un proyecto en [supabase.com](https://supabase.com) → **SQL Editor → New query** → pegar `schema.sql` → **Run** → **Authentication → Providers** → activar **Google**.
- Si falta internet o configuración, la app sigue funcionando en modo local: cuenta de demostración, avisos de ejemplo y datos guardados en el teléfono.
- Sin cuenta se puede mirar todo; reportar avisos, votar y sincronizar favoritos/historial/atajos requiere ingresar.

## Datos

| Archivo | Contenido |
|---|---|
| `data/lineas/*.json` + `index.json` | Línea, empresa, color, tarifas, horario, frecuencia, recorrido, paraderos y foto. Para agregar una línea: usar el editor (`npm run admin`) o `node tools/lineas.mjs nueva`, y una foto en `assets/img/lineas/`. `js/data/lineas.js` las carga al arrancar. |
| `js/data/trazos.js` | Copia de los recorridos que usan solo los scripts `tools/*.py` para calcular calles y paraderos. |
| `js/data/paraderos.js` | Paraderos con nombre ubicados sobre el recorrido (se usan si el `.json` de la línea no trae coordenadas de paraderos). |
| `js/data/calles.js` | Calles por las que pasa cada línea (OpenStreetMap). |
| `js/data/lugares.js` | Catálogo: `{ n: nombre, c: [lat, lon], t: tipo }`. |
| `js/data/referencias.js` | Lugares conocidos de Inicio, con foto y descripción. |
| `js/data/horas.js` | Franjas de hora punta. |
| `js/data/avisos.js` | Tipos de aviso y avisos de ejemplo. |

## Idiomas

- El texto en español es la clave: `t('Buen día')`.
- Las traducciones están en `js/i18n/en.js`, `qu.js` (quechua) y `ay.js` (aymara). Lo que falta se muestra en español.

## Agregar una pantalla

1. Crear `js/screens/mi-pantalla.js` (la forma está explicada en `js/core/router.js`):
   ```js
   export default {
     name: 'mi-pantalla', tab: 'home',
     render(params, api) { return `<div class="scroll">…</div>`; },
     mount(root, params, api) { /* eventos, mapas */ },
     actions: { guardar(el, params, api) { … } },
   };
   ```
2. Registrarla en `js/main.js`.
3. Navegar con `data-go="mi-pantalla"`, `data-back`, `data-tab="home"` o `data-action="guardar"`.

## Estado

`js/core/store.js` guarda sesión, preferencias, favoritos, historial y viaje en curso en `localStorage` (clave `nango.v1`). Para empezar de cero: `localStorage.clear()` en la consola y recargar.

## Pruebas

- `?hora=7:45` en la dirección simula la hora (hora punta, tarifa nocturna, líneas en servicio).
- `tests/rutas.html` revisa la lógica de rutas.
- En el celular: abrir `http://<IP-de-la-PC>:5500` en la misma red Wi-Fi.

- **Contacto y soporte:** el WhatsApp, el correo y la versión están en `js/core/config.js`. Los mensajes ya escritos que se abren en WhatsApp y correo están en `services/soporte.service.js` (siempre en español, porque los lee el equipo).
- **Estadísticas del Perfil:** "viajes completados" se cuenta en el teléfono; "avisos que publicaste" y "confirmaron tus avisos" (personas distintas) los calcula la función `mis_estadisticas()` de Supabase y los pide `services/stats.service.js` (máximo una vez cada 20 s). Sin internet o sin la función se ve "—".
