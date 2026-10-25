import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const allowed = new Set(['index.html','app.css','db.js','app.js','scanner.bundle.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','sw.js']);
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png' };
const port = Number(process.env.PORT || 5500);
createServer(async (request,response) => {
  const name = decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html';
  if (!allowed.has(name)) { response.writeHead(404);response.end('No encontrado');return; }
  try { const body = await readFile(join(root,name));response.writeHead(200,{'Content-Type':mime[extname(name)]||'application/octet-stream','Cache-Control':'no-cache'});response.end(body); }
  catch { response.writeHead(404);response.end('No encontrado'); }
}).listen(port,'127.0.0.1',()=>console.log(`Abre http://localhost:${port}/`));
