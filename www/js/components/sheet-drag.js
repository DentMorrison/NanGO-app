// ================================================================
// HOJA INFERIOR ARRASTRABL
// ================================================================
const VISIBLE_CERRADA = 200;      // px de la hoja que quedan a la vista cuando está replegada

export function attachSheetDrag(sheet, root = document) {
  const handle = sheet.querySelector('.sheet__handle');
  if (!handle) return;
  const seguidores = sheet.dataset.follow ? [...root.querySelectorAll(sheet.dataset.follow)] : [];
  const elementos = [sheet, ...seguidores];
  let desplazamiento = 0, inicioY = 0, inicioDesp = 0, arrastrando = false, movido = false;
  const maximo = () => Math.max(0, sheet.offsetHeight - VISIBLE_CERRADA);

  const aplicar = (v, animar) => {
    desplazamiento = v;
    elementos.forEach((el) => {
      el.style.transition = animar ? 'transform 250ms cubic-bezier(.23,1,.32,1)' : 'none';
      el.style.transform = v ? `translateY(${v}px)` : '';
    });
    handle.setAttribute('aria-expanded', v < maximo() / 2);
  };
  const alternar = () => aplicar(desplazamiento > 0 ? 0 : maximo(), true);

  handle.setAttribute('role', 'button');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('aria-label', 'Mostrar u ocultar la lista');
  handle.setAttribute('aria-expanded', 'true');

  handle.addEventListener('pointerdown', (e) => {
    arrastrando = true; movido = false; inicioY = e.clientY; inicioDesp = desplazamiento;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const dy = e.clientY - inicioY;
    if (Math.abs(dy) > 4) movido = true;
    aplicar(Math.min(maximo(), Math.max(0, inicioDesp + dy)), false);
  });
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    if (!movido) alternar();
    else aplicar(desplazamiento > maximo() / 2 ? maximo() : 0, true);
  };
  handle.addEventListener('pointerup', soltar);
  handle.addEventListener('pointercancel', soltar);
  handle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
}
