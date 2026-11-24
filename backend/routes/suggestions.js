const { SUGGESTIONS_FILE, readJson, writeJson } = require('../config');
const { requireAdmin } = require('../middleware/auth');

function handleSuggestionRoutes(req, res, pathname, body, sendJson) {
  // POST /api/suggestions (Public Visitor)
  if (req.method === 'POST' && pathname === '/api/suggestions') {
    const { type, title, creator, by, link, notes } = body || {};

    if (!title || !title.trim()) {
      return sendJson(res, 400, { error: 'Title is required.' });
    }

    const suggestions = readJson(SUGGESTIONS_FILE, []);
    const newSuggestion = {
      id: 'sug_' + Date.now(),
      type: type || 'Book',
      title: title.trim(),
      creator: creator ? creator.trim() : 'Unknown',
      by: by ? by.trim() : 'Anonymous Reader',
      link: link ? link.trim() : '',
      notes: notes ? notes.trim() : '',
      createdAt: new Date().toISOString()
    };

    suggestions.unshift(newSuggestion);
    writeJson(SUGGESTIONS_FILE, suggestions);

    return sendJson(res, 200, { success: true, message: 'Suggestion saved for the author!', suggestion: newSuggestion });
  }

  // GET /api/suggestions (Author Only)
  if (req.method === 'GET' && pathname === '/api/suggestions') {
    if (!requireAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Author session required.' });
    }
    const suggestions = readJson(SUGGESTIONS_FILE, []);
    return sendJson(res, 200, suggestions);
  }

  // DELETE /api/suggestions/:id (Author Only)
  if (req.method === 'DELETE' && pathname.startsWith('/api/suggestions/')) {
    if (!requireAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Author session required.' });
    }

    const id = pathname.replace('/api/suggestions/', '').trim();
    let suggestions = readJson(SUGGESTIONS_FILE, []);
    suggestions = suggestions.filter(s => s.id !== id);
    writeJson(SUGGESTIONS_FILE, suggestions);

    return sendJson(res, 200, { success: true, message: 'Suggestion dismissed.' });
  }

  return false;
}

module.exports = { handleSuggestionRoutes };
