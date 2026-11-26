const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const { DATABASE_URL, ADMIN_PASSWORD, AUTHOR_EMAIL, LIBRARY_FILE, readJson } = require('./config');

let pool = null;
let isConnected = false;

if (DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
      console.error('Neon PostgreSQL client error:', err.message);
    });
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
  }
} else {
  console.log('ℹ️  DATABASE_URL not set. Running with JSON file-based storage.');
}

/* ==========================================================================
   PASSWORD HASHING (Native Node.js Scrypt)
   ========================================================================== */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/* ==========================================================================
   SCHEMA INITIALIZATION & SEEDING (Neon PostgreSQL)
   ========================================================================== */
async function initDb() {
  if (!pool) return false;

  try {
    const client = await pool.connect();
    try {
      // 1. Create tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE,
          password_hash TEXT NOT NULL,
          role VARCHAR(50) DEFAULT 'author',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_login TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS library_items (
          id VARCHAR(100) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          creator VARCHAR(255),
          date VARCHAR(100),
          rating NUMERIC(4, 1),
          is_author_pick BOOLEAN DEFAULT FALSE,
          poster TEXT,
          back TEXT,
          genres JSONB DEFAULT '[]'::jsonb,
          overview TEXT,
          url TEXT,
          full_text TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS suggestions (
          id VARCHAR(100) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          creator VARCHAR(255),
          by_user VARCHAR(255),
          link TEXT,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(128) PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          username VARCHAR(100),
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 2. Seed default author user if empty
      const userCountRes = await client.query('SELECT COUNT(*) FROM users;');
      if (parseInt(userCountRes.rows[0].count, 10) === 0) {
        const hashedPassword = hashPassword(ADMIN_PASSWORD);
        await client.query(
          `INSERT INTO users (username, email, password_hash, role) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (username) DO NOTHING;`,
          ['author', AUTHOR_EMAIL, hashedPassword, 'author']
        );
        console.log('✅ Seeded default author account in Neon PostgreSQL (username: author)');
      }

      // 3. Seed library items from JSON if empty
      const itemCountRes = await client.query('SELECT COUNT(*) FROM library_items;');
      if (parseInt(itemCountRes.rows[0].count, 10) === 0) {
        const initialItems = readJson(LIBRARY_FILE, []);
        for (const it of initialItems) {
          await client.query(
            `INSERT INTO library_items 
             (id, type, title, creator, date, rating, is_author_pick, poster, back, genres, overview, url, full_text)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO NOTHING;`,
            [
              it.id,
              it.type,
              it.title,
              it.creator || '',
              it.date || '',
              it.rating || 9.5,
              Boolean(it.isAuthorPick),
              it.poster || '',
              it.back || it.poster || '',
              JSON.stringify(Array.isArray(it.g) ? it.g : []),
              it.ov || '',
              it.url || '',
              it.fullText || ''
            ]
          );
        }
        console.log(`✅ Seeded ${initialItems.length} vault titles into Neon PostgreSQL`);
      }

      isConnected = true;
      console.log('🐘 Connected to Neon PostgreSQL database successfully.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Neon PostgreSQL connection/initialization error:', err.message);
    isConnected = false;
    return false;
  }
}

/* ==========================================================================
   DATA ACCESS: LIBRARY ITEMS
   ========================================================================== */
async function getLibraryItems() {
  if (pool && isConnected) {
    try {
      const res = await pool.query(
        'SELECT * FROM library_items ORDER BY is_author_pick DESC, created_at DESC;'
      );
      return res.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        creator: row.creator || '',
        date: row.date || '',
        rating: row.rating ? parseFloat(row.rating) : 0,
        isAuthorPick: Boolean(row.is_author_pick),
        poster: row.poster || '',
        back: row.back || '',
        g: Array.isArray(row.genres) ? row.genres : (typeof row.genres === 'string' ? JSON.parse(row.genres) : []),
        ov: row.overview || '',
        url: row.url || '',
        fullText: row.full_text || ''
      }));
    } catch (err) {
      console.error('Error fetching library from PostgreSQL:', err);
    }
  }
  return readJson(LIBRARY_FILE, []);
}

async function saveLibraryItem(item) {
  if (pool && isConnected) {
    try {
      await pool.query(
        `INSERT INTO library_items 
         (id, type, title, creator, date, rating, is_author_pick, poster, back, genres, overview, url, full_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           type = EXCLUDED.type,
           title = EXCLUDED.title,
           creator = EXCLUDED.creator,
           date = EXCLUDED.date,
           rating = EXCLUDED.rating,
           is_author_pick = EXCLUDED.is_author_pick,
           poster = EXCLUDED.poster,
           back = EXCLUDED.back,
           genres = EXCLUDED.genres,
           overview = EXCLUDED.overview,
           url = EXCLUDED.url,
           full_text = EXCLUDED.full_text;`,
        [
          item.id,
          item.type,
          item.title,
          item.creator || '',
          item.date || '',
          item.rating || 9.5,
          Boolean(item.isAuthorPick),
          item.poster || '',
          item.back || item.poster || '',
          JSON.stringify(Array.isArray(item.g) ? item.g : []),
          item.ov || '',
          item.url || '',
          item.fullText || ''
        ]
      );
      return true;
    } catch (err) {
      console.error('Error saving library item to PostgreSQL:', err);
      return false;
    }
  }
  return false;
}

async function removeLibraryItem(id) {
  if (pool && isConnected) {
    try {
      const res = await pool.query('DELETE FROM library_items WHERE id = $1 RETURNING id;', [id]);
      return res.rowCount > 0;
    } catch (err) {
      console.error('Error deleting library item from PostgreSQL:', err);
      return false;
    }
  }
  return false;
}

/* ==========================================================================
   DATA ACCESS: VISITOR SUGGESTIONS
   ========================================================================== */
async function getSuggestions() {
  if (pool && isConnected) {
    try {
      const res = await pool.query('SELECT * FROM suggestions ORDER BY created_at DESC;');
      return res.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        creator: row.creator || 'Unknown',
        by: row.by_user || 'Anonymous Reader',
        link: row.link || '',
        notes: row.notes || '',
        status: row.status || 'pending',
        createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching suggestions from PostgreSQL:', err);
    }
  }
  return null;
}

async function saveSuggestion(sug) {
  if (pool && isConnected) {
    try {
      await pool.query(
        `INSERT INTO suggestions (id, type, title, creator, by_user, link, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          sug.id,
          sug.type,
          sug.title,
          sug.creator || '',
          sug.by || 'Anonymous Reader',
          sug.link || '',
          sug.notes || '',
          sug.status || 'pending'
        ]
      );
      return true;
    } catch (err) {
      console.error('Error saving suggestion to PostgreSQL:', err);
      return false;
    }
  }
  return false;
}

async function removeSuggestion(id) {
  if (pool && isConnected) {
    try {
      const res = await pool.query('DELETE FROM suggestions WHERE id = $1 RETURNING id;', [id]);
      return res.rowCount > 0;
    } catch (err) {
      console.error('Error deleting suggestion from PostgreSQL:', err);
      return false;
    }
  }
  return false;
}

/* ==========================================================================
   DATA ACCESS: USERS & SESSIONS
   ========================================================================== */
async function findUser(identifier) {
  if (pool && isConnected) {
    try {
      const res = await pool.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1;',
        [identifier]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error('Error finding user in PostgreSQL:', err);
    }
  }
  return null;
}

async function getFirstAuthorUser() {
  if (pool && isConnected) {
    try {
      const res = await pool.query(
        "SELECT * FROM users WHERE role = 'author' OR username = 'author' LIMIT 1;"
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error('Error finding author user in PostgreSQL:', err);
    }
  }
  return null;
}

async function createDbSession(userId, username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  if (pool && isConnected) {
    try {
      await pool.query(
        `INSERT INTO sessions (token, user_id, username, expires_at)
         VALUES ($1, $2, $3, $4);`,
        [token, userId, username, expiresAt]
      );
      return token;
    } catch (err) {
      console.error('Error creating database session:', err);
    }
  }
  return token;
}

async function verifyDbSession(token) {
  if (!token) return false;

  if (pool && isConnected) {
    try {
      const res = await pool.query(
        `SELECT s.*, u.role, u.username 
         FROM sessions s 
         LEFT JOIN users u ON s.user_id = u.id 
         WHERE s.token = $1 AND s.expires_at > NOW();`,
        [token]
      );
      if (res.rows.length > 0) {
        // Refresh expiration
        pool.query(
          "UPDATE sessions SET expires_at = NOW() + INTERVAL '7 days' WHERE token = $1;",
          [token]
        ).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error verifying database session:', err);
    }
  }
  return false;
}

async function destroyDbSession(token) {
  if (!token) return;
  if (pool && isConnected) {
    try {
      await pool.query('DELETE FROM sessions WHERE token = $1;', [token]);
    } catch (err) {
      console.error('Error destroying database session:', err);
    }
  }
}

module.exports = {
  pool,
  isDbConnected: () => isConnected,
  initDb,
  hashPassword,
  verifyPassword,
  getLibraryItems,
  saveLibraryItem,
  removeLibraryItem,
  getSuggestions,
  saveSuggestion,
  removeSuggestion,
  findUser,
  getFirstAuthorUser,
  createDbSession,
  verifyDbSession,
  destroyDbSession
};
