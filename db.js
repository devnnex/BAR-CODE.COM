(function () {
  'use strict';
  const NAME = 'codigo-de-barras-local';
  const VERSION = 1;
  let connection;

  function open() {
    if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Este navegador no permite IndexedDB.'));
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const products = db.createObjectStore('products', { keyPath: 'id' });
        products.createIndex('barcode', 'barcode', { unique: true });
        db.createObjectStore('sales', { keyPath: 'id' });
        db.createObjectStore('movements', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => { connection = null; reject(request.error); };
      request.onblocked = () => { connection = null; reject(new Error('Cierra otras pestañas de esta aplicación y vuelve a abrirla.')); };
    });
    return connection;
  }

  async function transact(names, mode, start) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result;
      let failure;
      const context = {
        store: name => tx.objectStore(name),
        done: value => { result = value; },
        fail: error => { failure = error instanceof Error ? error : new Error(String(error)); tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('No se pudo guardar el cambio.'));
      tx.onerror = () => { /* onabort informa el error final */ };
      try { start(context); } catch (error) { context.fail(error); }
    });
  }
  function all(name) {
    return transact([name], 'readonly', ({ store, done }) => {
      const request = store(name).getAll();
      request.onsuccess = () => done(request.result);
    });
  }
  const defaultShop = () => ({ key: 'shop', name: 'Mi negocio', address: '', phone: '', footer: '¡Gracias por su compra!', currency: 'COP', invoice_number: 0 });
  function getSettings() {
    return transact(['settings'], 'readonly', ({ store, done }) => {
      const request = store('settings').get('shop');
      request.onsuccess = () => done(request.result || defaultShop());
    });
  }
  function saveSettings(input) {
    return transact(['settings'], 'readwrite', ({ store, done, fail }) => {
      const request = store('settings').get('shop');
      request.onsuccess = () => {
        const previous = request.result || defaultShop();
        const next = {
          ...previous,
          name: String(input.name || '').trim().slice(0, 160),
          address: String(input.address || '').trim().slice(0, 240),
          phone: String(input.phone || '').trim().slice(0, 60),
          footer: String(input.footer || '').trim().slice(0, 160),
          currency: ['COP', 'USD', 'MXN', 'EUR'].includes(input.currency) ? input.currency : 'COP'
        };
        if (!next.name) return fail(new Error('Escribe el nombre del negocio.'));
        store('settings').put(next);
        done(next);
      };
    });
  }
  function requireNumber(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 999999999) throw new Error(`${label} debe ser un número no negativo.`);
    return number;
  }
  function validateProduct(input) {
    const product = {
      id: String(input.id || crypto.randomUUID()),
      barcode: String(input.barcode || '').trim().slice(0, 80),
      name: String(input.name || '').trim().slice(0, 160),
      category: String(input.category || '').trim().slice(0, 80),
      unit: String(input.unit || 'unidad').trim().slice(0, 40) || 'unidad',
      price: requireNumber(input.price, 'El precio'),
      cost: requireNumber(input.cost ?? 0, 'El costo'),
      stock: requireNumber(input.stock ?? 0, 'La existencia'),
      min_stock: requireNumber(input.min_stock ?? 0, 'El stock mínimo'),
      active: true,
      updated_at: new Date().toISOString()
    };
    if (!product.barcode || !product.name) throw new Error('El código de barras y el nombre son obligatorios.');
    return product;
  }
  function saveProduct(input) {
    const product = validateProduct(input);
    return transact(['products', 'movements'], 'readwrite', ({ store, done, fail }) => {
      const request = store('products').get(product.id);
      request.onsuccess = () => {
        try {
          const old = request.result;
          if (old) product.active = old.active;
          store('products').put(product);
          const before = Number(old?.stock || 0);
          if (before !== product.stock) store('movements').add({
            id: crypto.randomUUID(), product_id: product.id, product_name: product.name,
            delta: product.stock - before, before_stock: before, after_stock: product.stock,
            reason: old ? 'EDICIÓN' : 'NUEVO PRODUCTO', created_at: new Date().toISOString()
          });
          done(product);
        } catch (error) { fail(error); }
      };
    });
  }
  function adjustStock(id, deltaValue, reason) {
    const delta = Number(deltaValue);
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 999999999) return Promise.reject(new Error('Cantidad de ajuste inválida.'));
    return transact(['products', 'movements'], 'readwrite', ({ store, done, fail }) => {
      const request = store('products').get(id);
      request.onsuccess = () => {
        const product = request.result;
        if (!product || !product.active) return fail(new Error('El producto ya no está disponible.'));
        const before = Number(product.stock);
        const after = before + delta;
        if (after < 0) return fail(new Error('El ajuste dejaría existencias negativas.'));
        product.stock = after;
        product.updated_at = new Date().toISOString();
        store('products').put(product);
        store('movements').add({ id: crypto.randomUUID(), product_id: id, product_name: product.name,
          delta, before_stock: before, after_stock: after, reason: String(reason || 'AJUSTE').trim().slice(0, 80), created_at: new Date().toISOString() });
        done(product);
      };
    });
  }
  function archiveProduct(id) {
    return transact(['products'], 'readwrite', ({ store, done, fail }) => {
      const request = store('products').get(id);
      request.onsuccess = () => {
        const product = request.result;
        if (!product) return fail(new Error('Producto no encontrado.'));
        product.active = false;
        product.updated_at = new Date().toISOString();
        store('products').put(product);
        done(product);
      };
    });
  }
  function commitSale(cart, payment, customer) {
    const items = Object.entries(cart).filter(([, quantity]) => Number(quantity) > 0);
    if (!items.length) return Promise.reject(new Error('La venta no tiene productos.'));
    if (!['efectivo','transferencia','tarjeta','otro'].includes(payment)) return Promise.reject(new Error('Medio de pago inválido.'));
    if (items.some(([, quantity]) => !Number.isSafeInteger(quantity) || quantity < 1)) return Promise.reject(new Error('Cantidad inválida.'));
    return transact(['products', 'sales', 'movements', 'settings'], 'readwrite', ({ store, done, fail }) => {
      const loaded = new Map();
      let shop;
      let remaining = items.length + 1;
      const settingsRequest = store('settings').get('shop');
      settingsRequest.onsuccess = () => { shop = settingsRequest.result || defaultShop(); ready(); };
      for (const [id] of items) {
        const request = store('products').get(id);
        request.onsuccess = () => { loaded.set(id, request.result); ready(); };
      }
      function ready() {
        remaining -= 1;
        if (remaining !== 0) return;
        try {
          let total = 0;
          const lines = items.map(([id, quantity]) => {
            const product = loaded.get(id);
            if (!product?.active) throw new Error('Un producto ya no está disponible.');
            if (Number(product.stock) < quantity) throw new Error(`Existencias insuficientes para ${product.name}.`);
            const lineTotal = Math.round(Number(product.price) * quantity * 100) / 100;
            total += lineTotal;
            return { product_id: id, barcode: product.barcode, name: product.name, quantity,
              unit_price: Number(product.price), cost: Number(product.cost), total: lineTotal };
          });
          shop.invoice_number = Number(shop.invoice_number || 0) + 1;
          const sale = { id: crypto.randomUUID(), number: `V-${String(shop.invoice_number).padStart(6, '0')}`,
            created_at: new Date().toISOString(), payment_method: payment,
            customer_name: String(customer || '').trim().slice(0, 120), total: Math.round(total * 100) / 100, items: lines };
          for (const line of lines) {
            const product = loaded.get(line.product_id);
            const before = Number(product.stock);
            product.stock = before - line.quantity;
            product.updated_at = sale.created_at;
            store('products').put(product);
            store('movements').add({ id: crypto.randomUUID(), product_id: product.id, product_name: product.name,
              delta: -line.quantity, before_stock: before, after_stock: product.stock,
              reason: 'VENTA', reference: sale.number, created_at: sale.created_at });
          }
          store('settings').put(shop);
          store('sales').add(sale);
          done(sale);
        } catch (error) { fail(error); }
      }
    });
  }
  async function exportBackup() {
    const [settings, products, sales, movements] = await Promise.all([getSettings(), all('products'), all('sales'), all('movements')]);
    return { format: 'codigo-de-barras-local', version: 1, exported_at: new Date().toISOString(), settings, products, sales, movements };
  }
  function restoreBackup(backup) {
    if (backup?.format !== 'codigo-de-barras-local' || backup.version !== 1 || !Array.isArray(backup.products) || !Array.isArray(backup.sales) || !Array.isArray(backup.movements) || !backup.settings) {
      return Promise.reject(new Error('El archivo no es un respaldo válido de esta aplicación.'));
    }
    const barcodes = new Set();
    for (const product of backup.products) {
      if (!product?.id) return Promise.reject(new Error('El respaldo contiene un producto sin identificador.'));
      validateProduct(product);
      if (barcodes.has(product.barcode)) return Promise.reject(new Error('El respaldo tiene códigos repetidos.'));
      barcodes.add(product.barcode);
    }
    return transact(['products','sales','movements','settings'], 'readwrite', ({ store, done }) => {
      for (const name of ['products','sales','movements','settings']) store(name).clear();
      store('settings').put({ ...backup.settings, key: 'shop' });
      backup.products.forEach(item => store('products').put(item));
      backup.sales.forEach(item => store('sales').put(item));
      backup.movements.forEach(item => store('movements').put(item));
      done(true);
    });
  }

  globalThis.LocalDB = { open, all, getSettings, saveSettings, saveProduct, adjustStock, archiveProduct, commitSale, exportBackup, restoreBackup, validateProduct };
})();
