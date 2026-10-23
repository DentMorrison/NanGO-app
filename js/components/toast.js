// mensaje para avisos
export function toast(texto, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = texto;
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
