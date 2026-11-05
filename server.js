/* ============================================================
   Servidor estático mínimo (sin dependencias)
   Uso local:  node server.js
   Producción: Railway ejecuta `npm start`
   ============================================================ */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok' }));
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    send(res, 400, 'text/plain; charset=utf-8', 'Solicitud inválida');
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.resolve(ROOT, '.' + urlPath);

  // Evitar acceso fuera del directorio del proyecto
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    send(res, 403, 'text/plain; charset=utf-8', 'Acceso denegado');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Respaldo tipo SPA: cualquier ruta desconocida devuelve index.html
      fs.readFile(path.join(ROOT, 'index.html'), (err2, html) => {
        if (err2) {
          send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
          return;
        }
        send(res, 200, MIME['.html'], html);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, MIME[ext] || 'application/octet-stream', data);
  });
});

server.listen(PORT, () => {
  console.log('Servidor de asistencia escuchando en el puerto ' + PORT);
});
