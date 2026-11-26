const crypto = require('crypto');
const { ADMIN_PASSWORD } = require('../config');
const {
  isDbConnected,
  findUser,
  getFirstAuthorUser,
  verifyPassword,
  createDbSession,
  verifyDbSession,
  destroyDbSession
} = require('../db');

// In-memory active session tokens for offline / file-based fallback
const activeSessions = new Map();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
}
setInterval(cleanExpiredSessions, 60 * 60 * 1000).unref();

// Constant-time password check (offline / fallback)
function safePasswordCheck(input, expected = ADMIN_PASSWORD) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const bufA = Buffer.from(input, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createLocalSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  activeSessions.set(token, { expiresAt });
  return token;
}

/* ==========================================================================
   AUTHENTICATION LOGIC (Neon PostgreSQL + Local Fallback)
   ========================================================================== */
async function authenticateUser(identifier, password) {
  if (!password) return { success: false, error: 'Password is required' };

  // 1. Try Neon PostgreSQL user authentication
  if (isDbConnected()) {
    let user = null;
    if (identifier && identifier.trim()) {
      user = await findUser(identifier.trim());
    } else {
      user = await getFirstAuthorUser();
    }

    if (user && user.password_hash) {
      const match = verifyPassword(password, user.password_hash);
      if (match) {
        const token = await createDbSession(user.id, user.username);
        return {
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        };
      }
    }

    // Also support direct ADMIN_PASSWORD from .env
    if (safePasswordCheck(password, ADMIN_PASSWORD)) {
      const author = (await getFirstAuthorUser()) || { id: 1, username: 'author' };
      const token = await createDbSession(author.id, author.username);
      return {
        success: true,
        token,
        user: { id: author.id, username: author.username, role: 'author' }
      };
    }

    return { success: false, error: 'Incorrect author credentials.' };
  }

  // 2. Standalone / Offline fallback
  if (safePasswordCheck(password, ADMIN_PASSWORD)) {
    const token = createLocalSession();
    return {
      success: true,
      token,
      user: { username: 'author', role: 'author' }
    };
  }

  return { success: false, error: 'Incorrect author password.' };
}

async function verifyToken(token) {
  if (!token) return false;

  // 1. Check Neon PostgreSQL
  if (isDbConnected()) {
    const isValid = await verifyDbSession(token);
    if (isValid) return true;
  }

  // 2. Check local fallback sessions
  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    return false;
  }
  session.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return true;
}

async function destroySession(token) {
  if (!token) return;
  if (isDbConnected()) {
    await destroyDbSession(token);
  }
  activeSessions.delete(token);
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function requireAdmin(req) {
  const token = getBearerToken(req);
  return await verifyToken(token);
}

module.exports = {
  safePasswordCheck,
  authenticateUser,
  verifyToken,
  destroySession,
  getBearerToken,
  requireAdmin
};
