(function () {
  'use strict';
  const db = globalThis.LocalDB;
  const root = document.getElementById('app');
  const state = { shop:null, products:[], sales:[], movements:[], cart:{}, view:'caja', query:'', modal:null, controls:null, toast:'', scanMode:'sale' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = value => new Intl.NumberFormat('es-CO',{style:'currency',currency:state.shop?.currency||'COP',maximumFractionDigits:state.shop?.currency==='COP'?0:2}).format(Number(value)||0);
  const activeProducts = () => state.products.filter(p => p.active);
  const productById = id => state.products.find(p => p.id===id);
  const cartLines = () => Object.entries(state.cart).filter(([,qty])=>qty>0).map(([id,qty])=>({product:productById(id),qty})).filter(line=>line.product);
  const cartTotal = () => cartLines().reduce((total,line)=>total+line.qty*Number(line.product.price),0);

  function notify(message) {
    state.toast = String(message);
    render();
    clearTimeout(notify.timer);
    notify.timer = setTimeout(()=>{state.toast='';if(state.modal?.type!=='scanner')render();},4400);
  }
  function friendly(error) {
    if (error?.name==='ConstraintError') return 'Este código de barras ya está registrado.';
    return error?.message || String(error) || 'Ocurrió un error.';
  }
  async function reload() {
    const [shop,products,sales,movements] = await Promise.all([db.getSettings(),db.all('products'),db.all('sales'),db.all('movements')]);
    state.shop=shop;
    state.products=products.sort((a,b)=>a.name.localeCompare(b.name,'es'));
    state.sales=sales.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    state.movements=movements.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    render();
  }
  function nav(view,icon,label) {
    return `<button class="nav-item ${state.view===view?'active':''}" data-action="view" data-view="${view}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`;
  }
  function heading(title,description,action='') {
    return `<div class="page-heading"><div><span class="eyebrow">${esc(state.shop.name)}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
  }
  function caja() {
    const matches=activeProducts().filter(p=>!p.needs_details && (!state.query||`${p.name} ${p.barcode}`.toLowerCase().includes(state.query.toLowerCase()))).slice(0,35);
    const lines=cartLines();
    return `${heading('Caja rápida','Escanea un código o busca un producto.',`<button class="primary compact" data-action="scan" data-mode="sale">⌗ Escanear</button>`)}
      <div class="checkout-grid"><section class="panel"><div class="section-title"><h2>Buscar producto</h2><span>${activeProducts().length} en catálogo</span></div><div class="search-row"><input id="search" type="search" placeholder="Nombre o código de barras" value="${esc(state.query)}" autocomplete="off"><button class="secondary" data-action="manual" data-mode="sale">Código</button></div><div class="product-picker">${matches.length?matches.map(p=>`<button class="picker-item" data-action="add" data-id="${esc(p.id)}" ${Number(p.stock)<1?'disabled':''}><span class="item-symbol">▦</span><span class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.barcode)} · ${esc(p.stock)} ${esc(p.unit)}</small></span><span class="item-price">${money(p.price)}</span><span class="plus">+</span></button>`).join(''):'<p class="empty">No hay productos. Agrégalos en Inventario.</p>'}</div></section>
      <section class="panel cart-panel"><div class="section-title"><h2>Venta actual</h2><button class="text-button" data-action="clear-cart">Vaciar</button></div>${lines.length?`<div class="cart-lines">${lines.map(({product:p,qty})=>`<div class="cart-line"><span class="grow"><strong>${esc(p.name)}</strong><small>${money(p.price)} c/u</small></span><span class="qty-controls"><button data-action="minus" data-id="${esc(p.id)}">−</button><span>${qty}</span><button data-action="add" data-id="${esc(p.id)}">+</button></span><strong>${money(qty*p.price)}</strong></div>`).join('')}</div>`:'<div class="empty-cart"><span>▥</span><strong>Tu venta empieza aquí</strong><p>Escanea el primer producto para armar el pedido.</p></div>'}<div class="cart-footer"><div><span>Total</span><strong>${money(cartTotal())}</strong></div><button class="primary" data-action="checkout" ${lines.length?'':'disabled'}>Cobrar venta <span>→</span></button></div></section></div>`;
  }
  function inventario() {
    const matches=activeProducts().filter(p=>!state.query||`${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(state.query.toLowerCase()));
    const low=activeProducts().filter(p=>!p.needs_details && Number(p.stock)<=Number(p.min_stock)).length;
    return `${heading('Inventario','Productos y existencias guardados en este dispositivo.',`<button class="primary compact" data-action="new-product">+ Nuevo producto</button>`)}<div class="stat-row"><div class="stat"><span>Productos</span><strong>${activeProducts().length}</strong></div><div class="stat"><span>Unidades</span><strong>${activeProducts().reduce((n,p)=>n+Number(p.stock),0)}</strong></div><div class="stat warning"><span>Stock bajo</span><strong>${low}</strong></div></div><section class="panel"><div class="section-title"><h2>Catálogo</h2><button class="text-button" data-action="csv">Exportar CSV</button></div><div class="search-row"><input id="search" type="search" placeholder="Nombre, categoría o código" value="${esc(state.query)}"><button class="secondary" data-action="scan" data-mode="find">⌗ Escanear</button></div><div class="inventory-list">${matches.length?matches.map(p=>`<div class="inventory-item"><span class="item-symbol">▦</span><span class="grow"><strong>${esc(p.name||'Pendiente de completar')}</strong><small>${esc(p.barcode)} · ${esc(p.category||p.unit)}</small></span><span class="stock ${Number(p.stock)<=Number(p.min_stock)?'low':''}">${esc(p.stock)} <small>${esc(p.unit)}</small></span><strong class="inventory-price">${money(p.price)}</strong><button class="icon-btn" data-action="edit" data-id="${esc(p.id)}" aria-label="Editar">✎</button><button class="icon-btn" data-action="stock" data-id="${esc(p.id)}" aria-label="Ajustar stock">±</button></div>`).join(''):'<p class="empty">No se encontraron productos.</p>'}</div></section><section class="panel movement-panel"><div class="section-title"><h2>Últimos movimientos</h2><span>Existencias</span></div>${state.movements.length?state.movements.slice(0,50).map(m=>`<div class="movement-row"><span class="movement-sign ${m.delta<0?'negative':''}">${m.delta>0?'+':''}${esc(m.delta)}</span><span class="grow"><strong>${esc(m.product_name)}</strong><small>${esc(m.reason)} ${m.reference?'· '+esc(m.reference):''}</small></span><span class="movement-after"><strong>${esc(m.after_stock)}</strong><small>${esc(new Date(m.created_at).toLocaleDateString('es-CO'))}</small></span></div>`).join(''):'<p class="empty">Aún no hay movimientos.</p>'}</section>`;
  }
  function ventas() {
    return `${heading('Ventas','Historial guardado en este dispositivo.')}<div class="stat-row"><div class="stat"><span>Ventas</span><strong>${state.sales.length}</strong></div><div class="stat"><span>Total vendido</span><strong class="money-stat">${money(state.sales.reduce((sum,s)=>sum+Number(s.total),0))}</strong></div></div><section class="panel"><div class="section-title"><h2>Recibos</h2><span>Más recientes primero</span></div>${state.sales.length?state.sales.map(s=>`<button class="sale-row" data-action="sale" data-id="${esc(s.id)}"><span class="sale-icon">↗</span><span class="grow"><strong>${esc(s.number)}</strong><small>${esc(new Date(s.created_at).toLocaleString('es-CO'))} · ${esc(s.payment_method)}</small></span><strong>${money(s.total)}</strong><span>›</span></button>`).join(''):'<p class="empty">Aún no hay ventas.</p>'}</section>`;
  }
  function ajustes() {
    const s=state.shop;
    return `${heading('Ajustes','Datos del negocio, impresión y respaldo.')}<div class="settings-grid"><section class="panel"><div class="section-title"><h2>Negocio</h2><span>Solo este dispositivo</span></div><form data-form="shop" class="stack"><label>Nombre<input name="name" value="${esc(s.name)}" maxlength="160" required></label><label>Dirección<input name="address" value="${esc(s.address)}" maxlength="240"></label><label>Teléfono<input name="phone" value="${esc(s.phone)}" maxlength="60"></label><label>Pie del recibo<input name="footer" value="${esc(s.footer)}" maxlength="160"></label><label>Moneda<select name="currency">${['COP','USD','MXN','EUR'].map(c=>`<option ${s.currency===c?'selected':''}>${c}</option>`).join('')}</select></label><button class="primary">Guardar datos</button></form></section><section class="panel"><div class="section-title"><h2>Respaldo local</h2></div><p class="muted">Los datos viven en este navegador. Descarga un respaldo periódicamente y guárdalo fuera del celular. Si borras los datos del sitio o cambias de teléfono, usa el archivo para restaurarlos.</p><button class="secondary full" data-action="backup">Descargar respaldo JSON</button><label class="restore-label">Restaurar respaldo JSON<input id="restore-file" type="file" accept="application/json,.json"></label><div class="divider"></div><h2>Impresión</h2><p class="muted">Abre la impresión del sistema. La compatibilidad de impresoras térmicas Bluetooth depende del teléfono, navegador y modelo de impresora.</p><button class="secondary full" data-action="print-test">Probar recibo</button></section></div>`;
  }
  function modal() {
    const m=state.modal;
    if (!m) return '';
    const close='<button class="icon-btn" data-action="close" aria-label="Cerrar">✕</button>';
    if (m.type==='scanner') return `<div class="overlay"><div class="modal scanner-modal"><div class="modal-head"><div><span class="eyebrow">CÁMARA</span><h2>Escanear código</h2></div>${close}</div><div class="video-wrap"><video id="scanner-video" autoplay muted playsinline></video><div class="scan-frame"></div></div><div class="scan-actions"><p class="muted" data-scan-message>Apunta a las barras y números del producto. Algunos QR solo contienen enlaces.</p><button class="secondary" data-action="torch">Linterna</button></div><form data-form="manual-scan" class="inline-form"><input name="code" placeholder="Código manual" required><button class="primary">Aceptar</button></form></div></div>`;
    if (m.type==='product') { const p=m.product||{};return `<div class="overlay"><div class="modal"><div class="modal-head"><div><span class="eyebrow">CATÁLOGO</span><h2>${p.needs_details?'Completar producto':p.id?'Editar producto':'Nuevo producto'}</h2></div>${close}</div><p class="muted">El código identifica el producto; completa su nombre, precio y existencia para guardarlo en este dispositivo.</p><form data-form="product" class="stack"><input type="hidden" name="id" value="${esc(p.id||'')}"><label>Código de barras<div class="input-button"><input name="barcode" value="${esc(m.barcode||p.barcode||'')}" maxlength="80" placeholder="Escanea o escribe" required><button type="button" class="secondary" data-action="scan" data-mode="product">⌗</button></div></label><label>Nombre<input name="name" value="${esc(p.name||'')}" maxlength="160" required placeholder="Ej. Café 500 g"></label><div class="two-cols"><label>Precio de venta<input name="price" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(p.price??'')}" required></label><label>Costo<input name="cost" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(p.cost??0)}" required></label></div><div class="two-cols"><label>Existencia<input name="stock" type="number" inputmode="decimal" step="0.001" min="0" value="${esc(p.stock??0)}" required></label><label>Stock mínimo<input name="min_stock" type="number" inputmode="decimal" step="0.001" min="0" value="${esc(p.min_stock??0)}" required></label></div><div class="two-cols"><label>Categoría<input name="category" value="${esc(p.category||'')}" maxlength="80"></label><label>Unidad<input name="unit" value="${esc(p.unit||'unidad')}" maxlength="40"></label></div><button class="primary">Guardar producto</button></form>${p.id?`<button class="danger-text" data-action="archive" data-id="${esc(p.id)}">Archivar producto</button>`:''}</div></div>`; }
    if (m.type==='stock') return `<div class="overlay"><div class="modal"><div class="modal-head"><div><span class="eyebrow">MOVIMIENTO</span><h2>Ajustar existencias</h2></div>${close}</div><p class="muted">${esc(m.product.name)} · actual: ${esc(m.product.stock)} ${esc(m.product.unit)}</p><form data-form="stock" class="stack"><input type="hidden" name="id" value="${esc(m.product.id)}"><label>Cantidad a sumar o restar<input name="delta" type="number" step="0.001" inputmode="decimal" required placeholder="Ej. 10 o -2"></label><label>Motivo<input name="reason" maxlength="80" required placeholder="Compra, merma, corrección"></label><button class="primary">Registrar movimiento</button></form></div></div>`;
    if (m.type==='checkout') return `<div class="overlay"><div class="modal"><div class="modal-head"><div><span class="eyebrow">COBRO</span><h2>Confirmar venta</h2></div>${close}</div><div class="checkout-summary">${cartLines().map(({product:p,qty})=>`<div><span>${qty} × ${esc(p.name)}</span><strong>${money(qty*p.price)}</strong></div>`).join('')}<div class="summary-total"><span>Total</span><strong>${money(cartTotal())}</strong></div></div><form data-form="sale" class="stack"><label>Medio de pago<select name="payment"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label><label>Cliente (opcional)<input name="customer" maxlength="120"></label><button class="primary">Guardar venta</button></form></div></div>`;
    if (m.type==='receipt') {const s=m.sale;return `<div class="overlay"><div class="modal"><div class="modal-head"><div><span class="eyebrow">RECIBO</span><h2>${esc(s.number)}</h2></div>${close}</div><div class="receipt-preview"><strong>${esc(state.shop.name)}</strong><small>${esc(new Date(s.created_at).toLocaleString('es-CO'))}</small>${s.items.map(i=>`<div><span>${esc(i.quantity)} × ${esc(i.name)}</span><span>${money(i.total)}</span></div>`).join('')}<div class="summary-total"><span>Total</span><strong>${money(s.total)}</strong></div></div><button class="primary full" data-action="print">Imprimir recibo</button></div></div>`;}
    return '';
  }
  function render() {
    if (!state.shop) return;
    const page=state.view==='inventario'?inventario():state.view==='ventas'?ventas():state.view==='ajustes'?ajustes():caja();
    root.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="logo"><span>▥</span><div><strong>Código de Barras</strong><small>CAJA E INVENTARIO</small></div></div><div class="shop-switch"><span class="shop-avatar">${esc(state.shop.name[0]?.toUpperCase()||'N')}</span><strong>${esc(state.shop.name)}</strong></div><nav>${nav('caja','⌗','Caja')}${nav('inventario','▦','Inventario')}${nav('ventas','↗','Ventas')}${nav('ajustes','⚙','Ajustes')}</nav><div class="sidebar-bottom"><div class="connection"><span></span>Datos en este dispositivo</div></div></aside><div class="main-wrap"><header class="topbar"><div class="top-brand"><span>▥</span><strong>${esc(state.shop.name)}</strong></div><div class="top-actions"><span class="connection"><span></span>Local</span></div></header><main>${page}</main><nav class="bottom-nav">${nav('caja','⌗','Caja')}${nav('inventario','▦','Inventario')}${nav('ventas','↗','Ventas')}${nav('ajustes','⚙','Ajustes')}</nav></div></div>${modal()}${state.toast?`<div class="toast" role="status">${esc(state.toast)}</div>`:''}`;
  }

  function addToCart(id) {
    const product=productById(id);
    if (!product?.active || product.needs_details) return notify('Completa la ficha del producto antes de venderlo.');
    const next=(state.cart[id]||0)+1;
    if (next>Number(product.stock)) return notify('No hay existencias suficientes.');
    state.cart[id]=next;
    state.modal=null;
    render();
  }
  function closeScanner() {
    state.controls?.stop();
    state.controls=null;
    state.torch=false;
  }
  function scanMessage(text) {
    const message=document.querySelector('[data-scan-message]');
    if (message) message.textContent=text;
  }
  function updateScannerSummary() {
    const summary=document.querySelector('[data-scan-cart]');
    if (summary) summary.textContent=`Venta actual: ${cartLines().reduce((sum,line)=>sum+line.qty,0)} unidades · ${money(cartTotal())}`;
  }
  function productCodeFromScan(value) {
    const raw=String(typeof value==='object' && value!==null?value.text:value||'').trim();
    if (!raw) return {error:'No se detectó ningún código.'};
    if (typeof value==='object' && value?.format==='QR_CODE') {
      try {
        const url=new URL(raw);
        if (url.protocol==='https:' || url.protocol==='http:') {
          const gtin=url.pathname.match(/(?:^|\/)01\/(\d{14})(?=\/|$)/)?.[1];
          if (gtin) return {code:gtin.startsWith('0')?gtin.slice(1):gtin};
          return {error:'Este QR contiene un enlace, no el código comercial del producto. Busca las barras y los números de la etiqueta.'};
        }
      } catch { /* Un QR también puede contener un código local, no una URL. */ }
    }
    if (/^(?:https?:\/\/|www\.)/i.test(raw)) return {error:'El enlace leído no es un código de producto. Escanea las barras y números de la etiqueta.'};
    if (raw.length>80 || /[\r\n]/.test(raw)) return {error:'El QR contiene texto, no un código de producto corto. Escanea las barras y números de la etiqueta.'};
    return {code:raw};
  }
  async function openScanner(mode) {
    const previous=state.modal;
    state.scanMode=mode;
    state.modal={type:'scanner',previous};
    const scannerModal=state.modal;
    render();
    if (mode==='sale') {
      const summary=document.createElement('p');
      summary.className='muted';
      summary.dataset.scanCart='';
      document.querySelector('[data-form="manual-scan"]').before(summary);
      updateScannerSummary();
    }
    try {
      let busy=false;
      const controls=await globalThis.BarcodeScanner.start(document.getElementById('scanner-video'),async code=>{
        if (busy || state.modal!==scannerModal) return;
        busy=true;
        try { await handleCode(code,mode,previous); }
        catch (error) { scanMessage(friendly(error)); }
        finally { busy=false; }
      });
      if (state.modal!==scannerModal) controls.stop();
      else state.controls=controls;
    } catch (error) {
      if (state.modal===scannerModal) scanMessage('No se pudo abrir la cámara. Escribe el código manualmente.');
    }
  }
  async function handleCode(value,mode,previous) {
    const result=productCodeFromScan(value);
    if (result.error) {
      if (state.modal?.type==='scanner') scanMessage(result.error);
      else notify(result.error);
      return false;
    }
    const code=result.code;
    const product=activeProducts().find(p=>p.barcode===code);
    if (mode==='sale' && product && !product.needs_details) {
      if (state.modal?.type!=='scanner') { addToCart(product.id); return true; }
      const next=(state.cart[product.id]||0)+1;
      if (next>Number(product.stock)) scanMessage(`No hay existencias suficientes de ${product.name}.`);
      else {
        state.cart[product.id]=next;
        updateScannerSummary();
        scanMessage(`${product.name} agregado a la venta. Sigue escaneando o cierra la cámara.`);
      }
      return false;
    }
    if (mode==='product' && previous?.product?.id) {
      closeScanner();
      state.modal={type:'product',product:previous.product,barcode:code};
      render();
      return true;
    }
    let selected=product;
    if (!selected) {
      const registration=await db.registerBarcode(code);
      selected=registration.product;
      if (!state.products.some(item=>item.id===selected.id)) {
        state.products.push(selected);
        state.products.sort((a,b)=>a.name.localeCompare(b.name,'es'));
      }
      if (registration.created) broadcast();
    }
    if (!selected.active) {
      const message='Este código pertenece a un producto archivado y no está disponible para esta venta.';
      if (state.modal?.type==='scanner') scanMessage(message);
      else notify(message);
      return false;
    }
    closeScanner();
    if (mode==='find' && !selected.needs_details) {
      state.modal=null;
      state.view='inventario';
      state.query=code;
      render();
      return true;
    }
    state.view=mode==='find'?'inventario':state.view;
    state.query='';
    state.modal={type:'product',product:selected,barcode:code,resumeScanMode:mode==='sale'?'sale':null};
    render();
    return true;
  }
  function download(name,text,type) {
    const url=URL.createObjectURL(new Blob([text],{type}));
    const link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportCsv() {
    const rows=[['codigo','nombre','categoria','unidad','precio','costo','existencia','stock_minimo'],...activeProducts().map(p=>[p.barcode,p.name,p.category,p.unit,p.price,p.cost,p.stock,p.min_stock])];
    const csv='\uFEFF'+rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
    download('inventario.csv',csv,'text/csv;charset=utf-8');
  }
  function receiptDocument(sale) {
    const rows=sale.items.map(i=>`<tr><td>${esc(i.quantity)} × ${esc(i.name)}</td><td>${esc(money(i.unit_price))}</td><td>${esc(money(i.total))}</td></tr>`).join('');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo ${esc(sale.number)}</title><style>@page{size:80mm auto;margin:3mm}body{font:12px Arial,sans-serif;width:72mm;margin:0 auto;color:#111}h1{text-align:center;font-size:18px;margin:5px 0}p{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:4px 1px;border-bottom:1px dashed #777}td:not(:first-child){text-align:right;white-space:nowrap}.total{font-size:17px;font-weight:bold;text-align:right}@media screen{body{padding:22px;box-shadow:0 1px 25px #ddd;margin:20px auto}}@media print{button{display:none}}</style></head><body><h1>${esc(state.shop.name)}</h1><p>${esc(state.shop.address)}</p><p>${esc(state.shop.phone)}</p><p>${esc(sale.number)} · ${esc(new Date(sale.created_at).toLocaleString('es-CO'))}</p><table>${rows}</table><div class="total">TOTAL ${esc(money(sale.total))}</div><p>Pago: ${esc(sale.payment_method)}</p><p>${esc(state.shop.footer)}</p><button onclick="window.print()">Imprimir</button></body></html>`;
  }
  function printReceipt() {
    const sale=state.modal?.sale;
    if (!sale) return;
    const target=window.open('','_blank');
    if (!target) return notify('Permite ventanas emergentes para imprimir.');
    target.document.open();target.document.write(receiptDocument(sale));target.document.close();target.focus();
    setTimeout(()=>target.print(),250);
  }
  function broadcast() { channel?.postMessage('changed'); }
  const channel='BroadcastChannel' in globalThis ? new BroadcastChannel('codigo-de-barras-local') : null;
  if (channel) channel.onmessage=()=>reload().catch(error=>notify(friendly(error)));

  root.addEventListener('input',event=>{
    if (event.target.id!=='search') return;
    state.query=event.target.value;
    const position=event.target.selectionStart;
    render();
    const input=document.getElementById('search');
    input?.focus();input?.setSelectionRange(position,position);
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');
    if (!button) return;
    const action=button.dataset.action,id=button.dataset.id;
    try {
      if (action==='view') {closeScanner();state.view=button.dataset.view;state.query='';state.modal=null;render();}
      else if (action==='close') {closeScanner();state.modal=null;render();}
      else if (action==='scan') await openScanner(button.dataset.mode);
      else if (action==='manual') {const code=prompt('Código de barras');if(code)await handleCode(code,button.dataset.mode,null);}
      else if (action==='torch') {
        const track=document.getElementById('scanner-video')?.srcObject?.getVideoTracks()?.[0];
        if (!track?.getCapabilities?.().torch) throw new Error('La linterna no está disponible en este teléfono.');
        state.torch=!state.torch;await track.applyConstraints({advanced:[{torch:state.torch}]});
      }
      else if (action==='add') addToCart(id);
      else if (action==='minus') {state.cart[id]=Math.max(0,(state.cart[id]||0)-1);render();}
      else if (action==='clear-cart') {state.cart={};render();}
      else if (action==='checkout') {state.modal={type:'checkout'};render();}
      else if (action==='new-product') {state.modal={type:'product'};render();}
      else if (action==='edit') {state.modal={type:'product',product:productById(id)};render();}
      else if (action==='stock') {state.modal={type:'stock',product:productById(id)};render();}
      else if (action==='archive') {
        if (!confirm('¿Archivar este producto? Sus ventas anteriores se conservarán.')) return;
        await db.archiveProduct(id);state.modal=null;await reload();broadcast();notify('Producto archivado.');
      }
      else if (action==='sale') {state.modal={type:'receipt',sale:state.sales.find(s=>s.id===id)};render();}
      else if (action==='print') printReceipt();
      else if (action==='print-test') {state.modal={type:'receipt',sale:{id:'prueba',number:'PRUEBA',created_at:new Date().toISOString(),payment_method:'efectivo',total:1000,items:[{name:'Producto de prueba',quantity:1,unit_price:1000,total:1000}]}};render();}
      else if (action==='csv') exportCsv();
      else if (action==='backup') {const backup=await db.exportBackup();download(`respaldo-codigo-barras-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2),'application/json');notify('Respaldo descargado.');}
    } catch (error) {if(state.modal?.type==='scanner')scanMessage(friendly(error));else notify(friendly(error));}
  });
  root.addEventListener('submit',async event=>{
    const form=event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    const submit=event.submitter;
    if (submit) submit.disabled=true;
    try {
      if (form.dataset.form==='manual-scan') await handleCode(data.code,state.scanMode,state.modal?.previous);
      if (form.dataset.form==='product') {
        const resume=state.modal?.resumeScanMode;
        const saved=await db.saveProduct(data);
        state.modal=null;
        state.view=resume==='sale'?'caja':'inventario';
        state.query='';
        await reload();
        broadcast();
        if (resume==='sale') {
          if (Number(saved.stock)>0) state.cart[saved.id]=1;
          await openScanner('sale');
          updateScannerSummary();
          scanMessage(`${saved.name} guardado${Number(saved.stock)>0?' y agregado a la venta':''}. Sigue escaneando.`);
        } else notify('Producto guardado.');
      }
      if (form.dataset.form==='stock') {await db.adjustStock(data.id,data.delta,data.reason);state.modal=null;await reload();broadcast();notify('Movimiento registrado.');}
      if (form.dataset.form==='sale') {const sale=await db.commitSale(state.cart,data.payment,data.customer);state.cart={};state.modal={type:'receipt',sale};await reload();broadcast();notify('Venta guardada y existencias actualizadas.');}
      if (form.dataset.form==='shop') {await db.saveSettings(data);await reload();broadcast();notify('Datos del negocio guardados.');}
    } catch (error) {notify(friendly(error));}
    finally {if(submit?.isConnected)submit.disabled=false;}
  });
  root.addEventListener('change',async event=>{
    if (event.target.id!=='restore-file') return;
    const file=event.target.files?.[0];
    if (!file) return;
    try {
      const backup=JSON.parse(await file.text());
      if (!confirm('Esto reemplazará TODOS los productos, ventas y movimientos de este dispositivo. ¿Ya descargaste un respaldo actual?')) return;
      await db.restoreBackup(backup);state.cart={};await reload();broadcast();notify('Respaldo restaurado.');
    } catch (error) {notify(friendly(error));}
  });

  if ('serviceWorker' in navigator && (location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  db.open().then(reload).catch(error=>{
    root.innerHTML=`<main class="startup"><h1>No se pudo abrir el inventario</h1><p>${esc(friendly(error))}</p><p>Prueba en otro navegador o ejecuta <code>npm run serve</code> y abre <code>http://localhost:5500/</code>.</p></main>`;
  });
})();
