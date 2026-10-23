// ================================================================
// ARRANQUE DE LA APP
// agregar una pantalla nueva:
//   1) crear js/screens/mi-pantalla.js con el formato descrito en js/core/router.js
//   2) importarla y registrarla abajo
// ================================================================
import { register, startRouter } from './core/router.js';
import { applyPreferences } from './core/theme.js';
import { cargarLineas } from './data/lineas.js';
import { iniciar } from './services/auth.service.js';
import { vigilarVencimientos } from './services/alerts.service.js';

import splash from './screens/splash.js';
import welcome from './screens/welcome.js';
import auth from './screens/auth.js';
import home from './screens/home.js';
import search from './screens/search.js';
import route from './screens/route.js';
import lines from './screens/lines.js';
import lineDetail from './screens/line-detail.js';
import lineTrip from './screens/line-trip.js';
import rushHour from './screens/rush-hour.js';
import alerts from './screens/alerts.js';
import alertDetail from './screens/alert-detail.js';
import profile from './screens/profile.js';
import { favorites, history, offline, language, textSize, help } from './screens/profile-pages.js';
import legal from './screens/legal.js';
import trip from './screens/trip.js';
import tripEnd from './screens/trip-end.js';

[splash, welcome, auth, home, search, route, lines, lineDetail, lineTrip, rushHour, alerts, alertDetail, profile,
 favorites, history, offline, language, textSize, help, legal, trip, tripEnd].forEach(register);

applyPreferences();

// Las líneas (data/lineas/*.json) se cargan antes de abrir la primera pantalla.
try {
  await cargarLineas();
  await iniciar();          // restaura la sesión de Supabase (o la del modo demo)
  startRouter({ name: 'splash' });
  vigilarVencimientos();    // cada minuto quita los avisos vencidos y repinta Avisos/Inicio
} catch (e) {
  console.error(e);
  document.querySelector('#screen').innerHTML = '<p style="padding:24px;line-height:1.5">No se pudieron cargar las rutas. Revisa tu conexión e inténtalo de nuevo.</p>';
}
