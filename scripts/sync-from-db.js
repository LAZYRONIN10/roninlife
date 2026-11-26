const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { DATABASE_URL, FRONTEND_DIR, LIBRARY_FILE } = require('../backend/config');

async function sync() {
  const dbUrl = process.env.DATABASE_URL || DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.');
    console.log('👉 Paste your Neon connection string in .env (DATABASE_URL=...) and run this command again.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to Neon PostgreSQL...');
    const res = await pool.query('SELECT * FROM library_items ORDER BY is_author_pick DESC, created_at DESC;');
    const items = res.rows.map(row => ({
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

    const jsonContent = JSON.stringify(items, null, 2);
    fs.writeFileSync(LIBRARY_FILE, jsonContent, 'utf8');
    const frontendLib = path.join(FRONTEND_DIR, 'data', 'library.json');
    if (fs.existsSync(path.dirname(frontendLib))) {
      fs.writeFileSync(frontendLib, jsonContent, 'utf8');
    }

    console.log(`✅ Successfully synced ${items.length} items from Neon to local library.json!`);
  } catch (err) {
    console.error('❌ Error syncing from database:', err.message);
  } finally {
    await pool.end();
  }
}

sync();
