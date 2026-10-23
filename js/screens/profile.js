// PERFIL
import { store } from '../core/store.js';
import { t, IDIOMAS } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { toggle, item } from '../components/ui.js';
import { langCode } from '../core/i18n.js';
import { textSizeLabels, isDark } from '../core/theme.js';
import { inicial, salir, eliminarCuenta, actualizarNombre } from '../services/auth.service.js';
import { getLinea } from '../data/lineas.js';
import { cargarEstadisticas } from '../services/stats.service.js';

export default {
  name: 'profile',
  tab: 'profile',

  render() {
    const s = store.get();
    const invitado = !s.user;
    const idioma = IDIOMAS.find((l) => l.id === s.lang)?.nombre;
    return `
      <header class="profile-hero">
        <div class="appbar__row"><img class="appbar__logo" src="assets/img/brand/wordmark.png" alt="ÑanGO"><span class="appbar__spacer"></span>
          <button class="appbar__lang" data-go="language" aria-label="${t('Idioma')}">${ic('language')}${langCode()}</button></div>
        <div class="profile-hero__who">
          <div class="profile-hero__avatar">${invitado ? ic('user') : inicial()}</div>
          <div><b>${invitado ? t('Invitado') : esc(s.user.nombre)}</b><span>${invitado ? t('Sin cuenta · tus datos solo están en este teléfono') : esc(s.user.correo || t('Cuenta de Google'))}</span></div>
        </div>
      </header><div class="stripe"></div>
      <div class="scroll" style="padding-top:12px">
        ${invitado
          ? `<div class="invite"><h3>${t('Crea tu cuenta gratis')}</h3><p>${t('Guarda tus favoritos en la nube y ayuda a otros pasajeros con tus avisos.')}</p><button class="btn btn--primary btn--block" data-go="auth" data-params='{"modo":"registro"}'>${t('Crear cuenta')}</button></div>`
          : `<div class="stats"><div><b>${(s.viajesCompletados || []).length}</b><span>${t('viajes completados')}</span></div><div><b>${s.stats ? s.stats.avisos : '—'}</b><span>${t('avisos que publicaste')}</span></div><div><b>${s.stats ? s.stats.confirmaron : '—'}</b><span>${t('confirmaron tus avisos')}</span></div></div>`}
        <div class="group mt-12">
          ${invitado ? '' : item({ icon: 'user-edit', title: t('Editar perfil'), sub: esc(s.user.nombre), attrs: 'data-action="editar"' })}
          ${item({ icon: 'heart', title: t('Favoritos'), sub: `${s.favoriteLines.length} ${t('líneas')} · ${s.shortcuts.filter((a) => a.place).length} ${t('lugares')}`, attrs: 'data-go="favorites"' })}
          ${item({ icon: 'clock', title: t('Historial de viajes'), sub: s.viajesCompletados?.[0] ? `${esc(getLinea(s.viajesCompletados[0].lineas?.[0] || s.viajesCompletados[0].lineaId)?.nombre || '')}` : '', attrs: 'data-go="history"' })}
        </div>
        <div class="group">
          ${item({ icon: 'language', title: t('Idioma'), value: idioma, attrs: 'data-go="language"' })}
          ${item({ icon: 'text-size', title: t('Tamaño del texto'), value: t(textSizeLabels[s.textSize]), attrs: 'data-go="text-size"' })}
          <div class="item"><i class="item__icon ti ti-moon"></i><div class="item__body"><div class="item__title">${t('Modo oscuro')}</div></div>${toggle(isDark(), 'data-action="oscuro" aria-label="' + t('Modo oscuro') + '"')}</div>
        </div>
        <div class="group">
          ${item({ icon: 'help-circle', title: t('Ayuda y contacto'), attrs: 'data-go="help"' })}
          ${invitado ? '' : item({ icon: 'logout', title: t('Cerrar sesión'), chevron: false, attrs: 'data-action="salir"' })}
          ${invitado ? '' : item({ icon: 'user-off', title: t('Eliminar mi cuenta'), chevron: false, attrs: 'data-action="eliminar"' })}
        </div>
      </div>`;
  },

  /** Trae de Supabase las cifras de la cuenta y repinta solo si cambiaron. */
  mount(_root, _p, api) {
    let vivo = true;
    cargarEstadisticas().then((cambio) => { if (cambio && vivo) api.rerender(); });
    return () => { vivo = false; };
  },

  actions: {
    editar(_el, _p, api) {
      const u = store.get().user;
      if (!u) return;
      api.openModal(`<h3>${t('Editar perfil')}</h3>
        <label class="field mt-12"><div class="field__col"><span class="field__label">${t('Nombre')}</span>
          <input class="field__input" id="perfil-nombre" maxlength="40" autocomplete="name" value="${esc(u.nombre)}"></div></label>
        <label class="field"><div class="field__col"><span class="field__label">${t('Correo electrónico')}</span>
          <input class="field__input" value="${esc(u.correo || t('Cuenta de Google'))}" disabled></div></label>
        <button class="btn btn--primary btn--block btn--lg mt-16" data-action="guardar">${t('Guardar')}</button>`,
        { actions: { guardar: async (el, _ev, close) => {
          const nombre = document.getElementById('perfil-nombre')?.value || '';
          const largo = nombre.trim().length;
          if (largo < 2 || largo > 40) { api.toast(t('Tu nombre debe tener entre 2 y 40 caracteres.')); return; }
          el.disabled = true;
          try { await actualizarNombre(nombre); close(); api.rerender(); api.toast(t('Perfil actualizado')); }
          catch { el.disabled = false; api.toast(t('No se pudo guardar. Intenta de nuevo.')); }
        } } });
    },
    oscuro(_el, _p, api) { store.set({ theme: isDark() ? 'light' : 'dark' }); api.rerender(); },
    salir(_el, _p, api) {
      api.openModal(`<h3>${t('¿Cerrar sesión?')}</h3><p>${t('Tus favoritos, lugares y viajes quedan guardados en tu cuenta y se quitan de este teléfono.')}</p>
        <div class="dialog__actions"><button class="btn btn--outline" data-close>${t('Cancelar')}</button><button class="btn btn--danger" data-action="ok">${t('Cerrar sesión')}</button></div>`,
        { type: 'dialog', actions: { ok: async (_e, _ev, close) => { close(); await salir(); api.goTab('auth'); } } });
    },
    eliminar(_el, _p, api) {
      api.openModal(`<h3>${t('Eliminar mi cuenta')}</h3><p>${t('¿Eliminar tu cuenta y todos tus datos? Esta acción no se puede deshacer.')}</p>
        <div class="dialog__actions"><button class="btn btn--outline" data-close>${t('Cancelar')}</button><button class="btn btn--danger" data-action="ok">${t('Eliminar mi cuenta')}</button></div>`,
        { type: 'dialog', actions: { ok: async (_e, _ev, close) => {
          close();
          try { await eliminarCuenta(); api.goTab('auth'); }
          catch { api.toast(t('No se pudo eliminar la cuenta. Intenta de nuevo.')); }
        } } });
    },
  },
};
