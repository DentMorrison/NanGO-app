// Funciones del descargador de librerías (tools/vendor.mjs), sin usar internet.
import assert from 'node:assert/strict';
import { urlsDeCss, soloLatin, nombreLocal } from '../tools/vendor.mjs';

const fuentes = `/* cyrillic */
@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/s/inter/v13/cyr.woff2) format('woff2'); }
/* latin-ext */
@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/s/inter/v13/ext.woff2) format('woff2'); }
/* latin */
@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/s/inter/v13/lat.woff2) format('woff2'); }
`;
const reducido = soloLatin(fuentes);
assert.ok(reducido.includes('lat.woff2') && reducido.includes('ext.woff2'));
assert.ok(!reducido.includes('cyr.woff2'), 'debe quitar cirílico');

const tabler = `@font-face{src:url("./fonts/tabler-icons.woff2?v3.6.0") format("woff2"),url('./fonts/tabler-icons.woff?v3.6.0') format("woff")} .a{background:url(data:image/png;base64,AAA)}`;
assert.deepEqual(urlsDeCss(tabler), ['./fonts/tabler-icons.woff2?v3.6.0', './fonts/tabler-icons.woff?v3.6.0']);

assert.equal(nombreLocal('./fonts/tabler-icons.woff2?v3.6.0'), 'tabler-icons.woff2');
assert.equal(nombreLocal('https://fonts.gstatic.com/s/inter/v13/abc.woff2'), 'abc.woff2');
console.log('Todo en orden (vendor)');
