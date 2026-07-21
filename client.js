require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const CLIENT_PORT = process.env.CLIENT_PORT || 5050;
const API_HOST = 'localhost';
const API_PORT = process.env.PORT || 5000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function proxyApi(req, res) {
  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: API_HOST + ':' + API_PORT },
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'API server unreachable' }));
  });

  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = decodeURIComponent(parsed.pathname);

  // Proxy /api/* to backend
  if (pathname.startsWith('/api/')) {
    return proxyApi(req, res);
  }

  // Serve static files
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // If no extension, try .html
  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html (SPA)
      filePath = path.join(ROOT, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(CLIENT_PORT, () => {
  console.log(`\n🌐 SilverVerse Client`);
  console.log(`   Client running at http://localhost:${CLIENT_PORT}`);
  console.log(`   Home:       http://localhost:${CLIENT_PORT}/index.html`);
  console.log(`   Register:   http://localhost:${CLIENT_PORT}/register.html`);
  console.log(`   E-Ticket:   http://localhost:${CLIENT_PORT}/ticket.html`);
  console.log(`   Receipt:    http://localhost:${CLIENT_PORT}/receipt.html`);
  console.log(`   Check-in:   http://localhost:${CLIENT_PORT}/gate-checkin.html`);
  console.log(`   API proxy:  http://localhost:${CLIENT_PORT}/api/* → http://localhost:${API_PORT}/api/*\n`);
});
