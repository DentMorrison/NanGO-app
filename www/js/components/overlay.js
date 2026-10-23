// Hojas modales y diálogos (con fondo oscuro detrás).
//   const cerrar = openModal(html, { type: 'sheet' | 'dialog', actions: { nombre(el, ev) {} }, onMount(root) {} })
// Dentro del HTML: data-action="nombre" llama a actions.nombre; data-close cierra.
//
// Las hojas (type 'sheet') se pueden bajar para cerrarlas: arrastrando la rayita superior (o cualquier zona con
// data-grab) con el dedo o el mouse. Un tirón rápido la cierra aunque no se haya bajado mucho; si se suelta a
// medias, vuelve a su sitio. También cierran Escape y, con la rayita enfocada, Enter, Espacio o la flecha abajo.
const DISTANCIA_CIERRE = 90;      // px
const VELOCIDAD_CIERRE = 0.5;     // px por ms
const FRICCION_ARRIBA = 0.15;     // al tirar hacia arriba la hoja casi no se mueve

export function openModal(html, { type = 'sheet', actions = {}, onMount } = {}) {
  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const box = document.createElement('div');
  box.className = type === 'dialog' ? 'dialog' : 'modal-sheet';
  box.setAttribute('role', type === 'dialog' ? 'alertdialog' : 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = (type === 'sheet' ? '<div class="sheet__handle" role="button" tabindex="0" aria-label="Cerrar"></div>' : '') + html;
  app.append(overlay, box);

  let cerrado = false;
  const quitar = () => { box.remove(); overlay.remove(); document.removeEventListener('keydown', teclado); };
  const close = () => {
    if (cerrado) return;
    cerrado = true;
    box.classList.add('is-leaving');
    overlay.style.opacity = '0';
    setTimeout(quitar, 180);
  };
  function teclado(ev) { if (ev.key === 'Escape') close(); }
  document.addEventListener('keydown', teclado);

  overlay.addEventListener('click', close);
  box.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-close],[data-action]');
    if (!el) return;
    ev.stopPropagation();
    if (el.dataset.action && actions[el.dataset.action]) actions[el.dataset.action](el, ev, close);
    if (el.dataset.close !== undefined) close();
  });

  if (type === 'sheet') arrastrarParaCerrar(box, overlay, close, () => { cerrado = true; }, quitar);
  onMount?.(box, close);
  return close;
}

function arrastrarParaCerrar(box, overlay, close, marcarCerrado, quitar) {
  const manija = box.querySelector('.sheet__handle');
  let inicioY = 0, dy = 0, t0 = 0, arrastrando = false, idPuntero = null;

  const mover = (v) => {
    dy = v;
    box.style.transform = `translateY(${v > 0 ? v : v * FRICCION_ARRIBA}px)`;
    overlay.style.opacity = String(Math.max(0.25, 1 - Math.max(0, v) / (box.offsetHeight || 400)));
  };

  box.addEventListener('pointerdown', (ev) => {
    if (!ev.target.closest('.sheet__handle, [data-grab]') || arrastrando) return;
    arrastrando = true; idPuntero = ev.pointerId; inicioY = ev.clientY; t0 = performance.now(); dy = 0;
    box.style.animation = 'none';
    box.style.transition = 'none';
    box.setPointerCapture?.(ev.pointerId);
  });
  box.addEventListener('pointermove', (ev) => { if (arrastrando && ev.pointerId === idPuntero) mover(ev.clientY - inicioY); });

  const soltar = (ev) => {
    if (!arrastrando || ev.pointerId !== idPuntero) return;
    arrastrando = false;
    const velocidad = dy / Math.max(1, performance.now() - t0);
    if (dy > DISTANCIA_CIERRE || velocidad > VELOCIDAD_CIERRE) {
      marcarCerrado();
      box.style.transition = 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)';
      box.style.transform = 'translateY(105%)';
      overlay.style.transition = 'opacity 220ms ease-out';
      overlay.style.opacity = '0';
      setTimeout(quitar, 230);
    } else {
      box.style.transition = 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)';
      box.style.transform = 'translateY(0)';
      overlay.style.opacity = '1';
    }
  };
  box.addEventListener('pointerup', soltar);
  box.addEventListener('pointercancel', soltar);

  manija?.addEventListener('keydown', (ev) => {
    if (['Enter', ' ', 'ArrowDown'].includes(ev.key)) { ev.preventDefault(); close(); }
  });
}
