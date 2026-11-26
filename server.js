const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const { PORT, FRONTEND_DIR } = require('./backend/config');
const { initDb, isDbConnected } = require('./backend/db');
const { handleAuthRoutes } = require('./backend/routes/auth');
const { handleLibraryRoutes } = require('./backend/routes/library');
const { handleSuggestionRoutes } = require('./backend/routes/suggestions');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, data) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload too large (Max 15MB)'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStaticFile(res, filePath) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      setCors(res);
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }
  } catch {}

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('File Not Found');
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await parseJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request payload' });
    }
  }

  /* ========================================================================
     API ROUTES DISPATCHER
     ======================================================================== */
  if (pathname.startsWith('/api/auth')) {
    if (await handleAuthRoutes(req, res, pathname, body, sendJson)) return;
    return sendJson(res, 404, { error: 'Auth endpoint not found' });
  }

  if (pathname.startsWith('/api/library') || pathname.startsWith('/api/items')) {
    if (await handleLibraryRoutes(req, res, pathname, body, sendJson)) return;
    return sendJson(res, 404, { error: 'Library endpoint not found' });
  }

  if (pathname.startsWith('/api/suggestions')) {
    if (await handleSuggestionRoutes(req, res, pathname, body, sendJson)) return;
    return sendJson(res, 404, { error: 'Suggestion endpoint not found' });
  }

  /* ========================================================================
     FRONTEND ROUTES (Clean Page Separation)
     ======================================================================== */
  // Public Visitor View
  if (pathname === '/' || pathname === '/index.html') {
    return serveStaticFile(res, path.join(FRONTEND_DIR, 'index.html'));
  }

  // Dedicated Author Admin Portal
  if (pathname === '/admin' || pathname === '/admin.html') {
    return serveStaticFile(res, path.join(FRONTEND_DIR, 'admin.html'));
  }

  // Static Assets: CSS, JS, Images
  const safeRelative = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const candidatePath = path.join(FRONTEND_DIR, safeRelative);
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return serveStaticFile(res, candidatePath);
  }

  // Fallback to index.html
  return serveStaticFile(res, path.join(FRONTEND_DIR, 'index.html'));
});

async function startServer() {
  await initDb();
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  RONINLIFE FULL-STACK ARCHITECTURE READY`);
    console.log(`  Public Visitor Showcase : http://localhost:${PORT}`);
    console.log(`  Author Admin Dashboard  : http://localhost:${PORT}/admin`);
    console.log(`  Database Engine         : ${isDbConnected() ? 'Neon PostgreSQL' : 'Local JSON Fallback'}`);
    console.log(`=======================================================`);
  });
}

startServer();

module.exports = server;
