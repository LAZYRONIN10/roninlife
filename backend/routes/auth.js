const { authenticateUser, verifyToken, destroySession, getBearerToken } = require('../middleware/auth');

async function handleAuthRoutes(req, res, pathname, body, sendJson) {
  // POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const { password, username, identifier } = body || {};
    const id = username || identifier || '';
    const result = await authenticateUser(id, password);
    if (!result.success) {
      return sendJson(res, 401, { success: false, error: result.error || 'Incorrect author credentials.' });
    }
    return sendJson(res, 200, {
      success: true,
      token: result.token,
      user: result.user,
      message: 'Author session authenticated successfully.'
    });
  }

  // GET /api/auth/verify
  if (req.method === 'GET' && pathname === '/api/auth/verify') {
    const token = getBearerToken(req);
    const isAdmin = await verifyToken(token);
    return sendJson(res, 200, { isAdmin });
  }

  // POST /api/auth/logout
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getBearerToken(req);
    await destroySession(token);
    return sendJson(res, 200, { success: true });
  }

  return false;
}

module.exports = { handleAuthRoutes };
