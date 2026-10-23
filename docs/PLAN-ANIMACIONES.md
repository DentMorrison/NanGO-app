# Animaciones

Solo se anima lo que ayuda a entender o lo que se ve pocas veces. Lo que se usa muchas veces al día cambia al instante. Todo se desactiva con “reducir animaciones” (del teléfono o de Perfil).

| Qué se mueve | Cuándo | Duración | Dónde |
|---|---|---|---|
| Carga: la combi recorre el anillo | Al abrir la app | 3,6 s por vuelta, mínimo 2 s de carga | `js/screens/splash.js` |
| Carga: nubes | Mientras carga | Pasada lenta de izquierda a derecha | `css/99-animations.css` (`cloud-drift`) |
| Inicio: saludo con la combi | Una vez por sesión | 2,4 s | `js/components/saludo-anim.js` |
| Hoja inferior | Al abrirla o cerrarla | 250 ms entra, 180 ms sale | `sheet-in`, `sheet-out` |
| Recorrido en el mapa | Al elegir una opción | 600 ms | `route-draw` |
| Botones y filas | Al tocar | 120 ms | `.btn:active`, `.chip:active` |
| Barra inferior | Al cambiar de pestaña | 150 ms | `tab-pop` |
| Gráfico de hora punta | Al abrirlo | ≈ 500 ms | `bar-grow` |
| Modo viaje | Al marcar un paradero | 250 ms | `stop-in` |

## Criterios

- Solo `transform` y `opacity`.
- Salida rápida: `cubic-bezier(.23, 1, .32, 1)`.
- Salir es más rápido que entrar.
- Con “reducir animaciones” se quita el movimiento y quedan los cambios de color y opacidad.
