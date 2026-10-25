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
  let onScan;
  let stopped=false;
  dom.window.BarcodeScanner={start:async (_video,callback) => {
    onScan=callback;
    return { stop() { stopped=true; } };
  }};
  dom.window.document.querySelector('[data-action="scan"][data-mode="sale"]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(dom.window.document.getElementById('scanner-video'));
  await onScan({text:'https://marca.example/promocion-aceite',format:'QR_CODE'});
  assert.match(dom.window.document.querySelector('[data-scan-message]').textContent,/contiene un enlace/);
  assert.ok(dom.window.document.getElementById('scanner-video'));
  await onScan({text:'7701234567890',format:'EAN_13'});
  assert.equal(dom.window.document.querySelector('[data-form="product"] [name="barcode"]').value,'7701234567890');
  assert.equal(stopped,true);
  const draft=(await dom.window.LocalDB.all('products')).find(product=>product.barcode==='7701234567890');
  assert.equal(draft?.needs_details,true);
  const form=dom.window.document.querySelector('[data-form="product"]');
  form.elements.name.value='Aceite de prueba';
  form.elements.price.value='12000';
  form.elements.stock.value='3';
  form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  let products=[];
  const saveStarted=Date.now();
  while (!products.some(product=>product.barcode==='7701234567890' && !product.needs_details) && Date.now()-saveStarted<4000) {
    await new Promise(resolve=>setTimeout(resolve,25));
    products=await dom.window.LocalDB.all('products');
  }
  assert.equal(products.find(product=>product.barcode==='7701234567890')?.name,'Aceite de prueba');
  while (!dom.window.document.getElementById('scanner-video') && Date.now()-saveStarted<4000) {
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  stopped=false;
  await onScan({text:'7701234567890',format:'EAN_13'});
  assert.match(dom.window.document.querySelector('[data-scan-cart]').textContent,/2 unidades/);
  assert.ok(dom.window.document.getElementById('scanner-video'));
  assert.equal(stopped,false);
  dom.window.document.querySelector('.scanner-modal [data-action="close"]').click();
  dom.window.document.querySelector('[data-action="view"][data-view="inventario"]').click();
  while (!dom.window.document.querySelector('[data-action="scan"][data-mode="find"]') && Date.now()-saveStarted<4000) {
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  dom.window.document.querySelector('[data-action="scan"][data-mode="find"]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  await onScan({text:'7709876543210',format:'EAN_13'});
  assert.equal(dom.window.document.querySelector('[data-form="product"] [name="barcode"]').value,'7709876543210');
  assert.equal((await dom.window.LocalDB.all('products')).find(product=>product.barcode==='7709876543210')?.needs_details,true);
  assert.equal(errors.length,0,errors.map(String).join('\n'));
  dom.window.close();
});
