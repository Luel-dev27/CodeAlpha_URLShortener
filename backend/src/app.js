const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createDatabase } = require('./config/database');
const { UrlService } = require('./services/urlService');
const { createUrlRoutes } = require('./routes/urlRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp(options = {}) {
  const db = options.db || createDatabase(options.databasePath);
  const baseUrl = (options.baseUrl || process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
  const app = express();
  const urlService = new UrlService(db, options);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));
  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
  app.use('/api/urls', createUrlRoutes(urlService, baseUrl));
  app.get('/:shortCode', (req, res, next) => {
    try {
      const originalUrl = urlService.redirect(req.params.shortCode);
      if (!originalUrl) return res.status(404).json({ success: false, error: 'Short URL not found' });
      return res.redirect(302, originalUrl);
    } catch (error) { return next(error); }
  });
  app.use(notFound);
  app.use(errorHandler);
  return { app, db, urlService };
}

module.exports = { createApp };
