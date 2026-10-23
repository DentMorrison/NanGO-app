// Carga las líneas desde data/lineas/ (en el navegador lo hace cargarLineas con fetch; aquí se lee del disco).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function cargarDesdeDisco() {
  const { definirLineas } = await import('../js/data/lineas.js');
  const carpeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'lineas');
  const { lineas } = JSON.parse(fs.readFileSync(path.join(carpeta, 'index.json'), 'utf8'));
  definirLineas(lineas.map((id) => JSON.parse(fs.readFileSync(path.join(carpeta, `${id}.json`), 'utf8'))));
}
