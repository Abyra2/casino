const Database = require('better-sqlite3');
const db = new Database('./data.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS sinless (
    user_id TEXT,
    guild_id TEXT,
    status TEXT
  )
`).run();

module.exports = db;
