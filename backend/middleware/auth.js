const crypto = require('crypto');
const { ADMIN_PASSWORD } = require('../config');

// In-memory active session tokens: token -> { expiresAt }
const activeSessions = new Map();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
}
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

// Constant-time password check
function safePasswordCheck(input, expected = ADMIN_PASSWORD) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const bufA = Buffer.from(input, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  activeSessions.set(token, { expiresAt });
  return token;
}

function verifyToken(token) {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    return false;
  }
  // Refresh expiration on activity
  session.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return true;
}

function destroySession(token) {
  if (token) activeSessions.delete(token);
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

function requireAdmin(req) {
  const token = getBearerToken(req);
  return verifyToken(token);
}

module.exports = {
  safePasswordCheck,
  createSession,
  verifyToken,
  destroySession,
  getBearerToken,
  requireAdmin
};
