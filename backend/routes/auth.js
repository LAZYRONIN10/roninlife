const { safePasswordCheck, createSession, verifyToken, destroySession, getBearerToken } = require('../middleware/auth');

function handleAuthRoutes(req, res, pathname, body, sendJson) {
  // POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const { password } = body || {};
    if (!password || !safePasswordCheck(password)) {
      return sendJson(res, 401, { success: false, error: 'Incorrect author password.' });
    }
    const token = createSession();
    return sendJson(res, 200, {
      success: true,
      token,
      message: 'Author session authenticated successfully.'
    });
  }

  // GET /api/auth/verify
  if (req.method === 'GET' && pathname === '/api/auth/verify') {
    const token = getBearerToken(req);
    const isAdmin = verifyToken(token);
    return sendJson(res, 200, { isAdmin });
  }

  // POST /api/auth/logout
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getBearerToken(req);
    destroySession(token);
    return sendJson(res, 200, { success: true });
  }

  return false;
}

module.exports = { handleAuthRoutes };
