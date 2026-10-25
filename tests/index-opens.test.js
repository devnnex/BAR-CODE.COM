import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import 'fake-indexeddb/auto';

test('index.html abierto como archivo dibuja la caja local', async () => {
  const path = fileURLToPath(new URL('../index.html', import.meta.url));
  const errors=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error));
  const dom=await JSDOM.fromFile(path, {
    url:new URL('../index.html',import.meta.url).href,
    resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,
    beforeParse(window) {
      window.indexedDB=globalThis.indexedDB;
      window.IDBKeyRange=globalThis.IDBKeyRange;
      window.crypto.randomUUID=()=>globalThis.crypto.randomUUID();
    }
  });
  const started=Date.now();
  while (!dom.window.document.body.textContent.includes('Caja rápida') && Date.now()-started<4000) {
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(errors.length,0,errors.map(String).join('\n'));
  assert.match(dom.window.document.body.textContent,/Caja rápida/);
  assert.match(dom.window.document.body.textContent,/Inventario/);
  dom.window.close();
});
