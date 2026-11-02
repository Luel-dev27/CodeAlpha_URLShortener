const { nanoid } = require('nanoid');

class UrlService {
  constructor(db, options = {}) {
    this.db = db;
    this.codeGenerator = options.codeGenerator || (() => nanoid(7));
    this.insert = db.prepare('INSERT INTO urls (original_url, short_code) VALUES (?, ?)');
    this.findByCode = db.prepare('SELECT original_url AS originalUrl, short_code AS shortCode, created_at AS createdAt, clicks FROM urls WHERE short_code = ?');
    this.incrementClicks = db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?');
    this.findAll = db.prepare('SELECT original_url AS originalUrl, short_code AS shortCode, created_at AS createdAt, clicks FROM urls ORDER BY id DESC');
  }

  create(originalUrl) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shortCode = this.codeGenerator();
      try {
        this.insert.run(originalUrl, shortCode);
        return { originalUrl, shortCode };
      } catch (error) {
        if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE' || !String(error.message).includes('short_code')) throw error;
      }
    }
    const error = new Error('Could not generate a unique short code');
    error.status = 503;
    throw error;
  }

  getByCode(shortCode) { return this.findByCode.get(shortCode); }

  redirect(shortCode) {
    const url = this.getByCode(shortCode);
    if (!url) return undefined;
    this.incrementClicks.run(shortCode);
    return url.originalUrl;
  }

  list() { return this.findAll.all(); }
}

module.exports = { UrlService };
