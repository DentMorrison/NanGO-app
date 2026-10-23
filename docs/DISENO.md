# Diseño

Colores, tipografías y componentes de la interfaz. Los valores salen de `css/00-tokens.css`: al cambiar uno ahí, cambia en todas las pantallas.

## Colores

| Uso | Claro | Oscuro |
|---|---|---|
| Azul de marca | `#1F4E8A` | `#2F6DB8` |
| Barra superior y bloques | `#0F2D57` | `#112A4D` |
| Acento (botón principal, destino) | `#F5C518` | `#F5C518` |
| Fondo / tarjeta | `#F1F4F8` / `#FFFFFF` | `#0B1524` / `#14233B` |
| Texto / texto secundario | `#14213A` / `#4D5B73` | `#E8EEF7` / `#9DB0C8` |
| Línea 60 / 15 / 20 de Mayo | `#C2410C` / `#2E7D32` / `#C62828` | `#FF8F4D` / `#52C98A` / `#FF7A7A` |

La franja de colores bajo la barra superior (8 px) usa los tonos del aguayo: magenta, naranja, amarillo, verde, turquesa y azul.

## Tipografía

- Barlow Condensed (cursiva, 700) para títulos y números grandes.
- Inter para el resto del texto. Tamaño mínimo 12 px.
- El saludo de Inicio usa Dantene (ver README, sección de licencias).
- Los tamaños están en `rem` para que el ajuste de Perfil → Tamaño del texto (`--text-scale`) los escale.

## Componentes

Definidos en `css/02-components.css` y `js/components/ui.js`.

| Componente | Clase o función |
|---|---|
| Barra superior + franja | `appbar()`, `.appbar`, `.stripe` |
| Barra con “volver” | `subbar(titulo, sub)` |
| Barra inferior | `tabbar.js`, `.tabbar` |
| Botones | `.btn` con `--primary`, `--dark`, `--outline`, `--danger`, `--lg`, `--sm`, `--block` |
| Filtros | `.chip`, `.chip.is-active`, `.chip-row` |
| Número de línea | `lineBadge(linea, 'sm\|md\|lg\|xl')` |
| Billete de próximo micro | `.ticket` |
| Filas agrupadas | `.group` + `.item` |
| Interruptor / segmentado | `.toggle`, `.segmented` |
| Hoja inferior | `.sheet` (sobre el mapa), `openModal()` (con fondo oscuro) |
| Campos | `.field`, `.field__input`, `.field__error` |

## Reglas

- Botones y filtros de 44 px de alto como mínimo.
- Contraste de texto de 4.5:1 o más.
- Íconos de Tabler, sin emojis.
- El número de línea va en blanco sobre el color de la línea.

## Modo oscuro

`#app[data-theme="dark"]` redefine las variables. El mapa se oscurece con un filtro CSS sobre las baldosas (`--map-filter`). En “automático” sigue al sistema.
