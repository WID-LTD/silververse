require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const CLIENT_PORT = process.env.CLIENT_PORT || 5050;
const API_URL = process.env.API_URL || 'http://localhost:10000';
const ROOT = __dirname;

const apiHost = new URL(API_URL);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
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
    hostname: apiHost.hostname,
    port: apiHost.port || 80,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: apiHost.host },
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

  if (pathname.startsWith('/api/')) {
    return proxyApi(req, res);
  }

  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(ROOT, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Internal Server Error');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
});

server.listen(CLIENT_PORT, () => {
  console.log(`\n🌐 SilverVerse Client`);
  console.log(`   http://localhost:${CLIENT_PORT}`);
  console.log(`   API proxy → ${API_URL}\n`);
});
