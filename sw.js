const CACHE='codigo-de-barras-25756cc77c67';
const ASSETS=["./","./index.html","./app.css","./db.js","./app.js","./scanner.bundle.js","./scan-success.wav","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('codigo-de-barras-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});
