const path = require('path');
const fs = require('fs');
const { LIBRARY_FILE, FRONTEND_DIR, readJson, writeJson } = require('../config');
const { requireAdmin } = require('../middleware/auth');

const FRONTEND_LIBRARY_FILE = path.join(FRONTEND_DIR, 'data', 'library.json');

function saveLibrary(data) {
  writeJson(LIBRARY_FILE, data);
  try {
    const dir = path.dirname(FRONTEND_LIBRARY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJson(FRONTEND_LIBRARY_FILE, data);
  } catch {}
}

function handleLibraryRoutes(req, res, pathname, body, sendJson) {
  // GET /api/library (Public)
  if (req.method === 'GET' && pathname === '/api/library') {
    const library = readJson(LIBRARY_FILE, []);
    return sendJson(res, 200, library);
  }

  // POST /api/items (Author Only)
  if (req.method === 'POST' && pathname === '/api/items') {
    if (!requireAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Author session required.' });
    }

    const { type, title, creator, date, rating, isAuthorPick, poster, back, g, ov, url, fullText } = body || {};
    if (!title || !title.trim()) {
      return sendJson(res, 400, { error: 'Title is required.' });
    }

    const library = readJson(LIBRARY_FILE, []);
    const newItem = {
      id: (type || 'item') + '_' + Date.now(),
      type: type || 'story',
      title: title.trim(),
      creator: creator ? creator.trim() : 'Author',
      date: date ? String(date).trim() : new Date().getFullYear().toString(),
      rating: parseFloat(rating) || 9.5,
      isAuthorPick: Boolean(isAuthorPick),
      poster: poster || '',
      back: back || poster || '',
      g: Array.isArray(g) ? g : (g ? String(g).split(',').map(s => s.trim()) : ['Featured']),
      ov: ov ? ov.trim() : '',
      url: url ? url.trim() : '',
      fullText: fullText ? fullText.trim() : ''
    };

    library.unshift(newItem);
    saveLibrary(library);

    return sendJson(res, 200, { success: true, item: newItem });
  }

  // DELETE /api/items/:id (Author Only)
  if (req.method === 'DELETE' && pathname.startsWith('/api/items/')) {
    if (!requireAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Author session required.' });
    }

    const id = pathname.replace('/api/items/', '').trim();
    let library = readJson(LIBRARY_FILE, []);
    const initialLen = library.length;
    library = library.filter(it => it.id !== id);

    if (library.length === initialLen) {
      return sendJson(res, 404, { error: 'Item not found.' });
    }

    saveLibrary(library);
    return sendJson(res, 200, { success: true, message: 'Item deleted from Vault.' });
  }

  return false;
}

module.exports = { handleLibraryRoutes };
