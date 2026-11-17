import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachLobbyToServer, getLanUrls } from './wsPlugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let lobbyMiddleware = null;

const server = http.createServer((req, res) => {
  if (lobbyMiddleware && (req.url?.startsWith('/api/'))) {
    lobbyMiddleware(req, res);
    return;
  }

  const reqUrl = new URL(req.url || '/', 'http://localhost');
  let filePath = path.join(distDir, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);

  if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

const attached = attachLobbyToServer(server, { getPort: () => port });
lobbyMiddleware = attached.middleware;

server.listen(port, '0.0.0.0', () => {
  console.log(`\nThE InGliSc GaMe PWA + LAN Lobby Server in ascolto:`);
  console.log(`  Locale: http://localhost:${port}`);
  for (const url of getLanUrls(port)) {
    console.log(`  Rete locale: ${url}`);
  }
});
