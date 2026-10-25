import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = ['index.html','app.css','db.js','app.js','scanner.bundle.js','scan-success.wav','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
await build({ entryPoints: [join(root,'scripts/scanner-entry.js')], bundle: true, format: 'iife', globalName: 'BarcodeScanner', minify: true, target: 'es2020', outfile: join(root,'scanner.bundle.js') });
const hash = createHash('sha256');
for (const name of files) hash.update(await readFile(join(root,name)));
const version = hash.digest('hex').slice(0,12);
const assets = ['./',...files.map(name=>`./${name}`)];
const worker = `const CACHE='codigo-de-barras-${version}';\nconst ASSETS=${JSON.stringify(assets)};\nself.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});\nself.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('codigo-de-barras-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});\n`;
await writeFile(join(root,'sw.js'),worker);
const dist = join(root,'dist');
await mkdir(dist,{recursive:true});
for (const name of [...files,'sw.js']) await copyFile(join(root,name),join(dist,name));
console.log(`PWA local lista: ${dist} (${files.length} archivos, caché ${version})`);
