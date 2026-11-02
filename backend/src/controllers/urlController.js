const { createUrlSchema } = require('../validators/urlValidator');

function createUrlController(urlService, baseUrl) {
  return {
    create: (req, res, next) => {
      const parsed = createUrlSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid request body', details: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) });
      try {
        const url = urlService.create(parsed.data.url);
        return res.status(201).json({ success: true, data: { ...url, shortUrl: `${baseUrl}/${url.shortCode}` } });
      } catch (error) { return next(error); }
    },
    list: (_req, res, next) => {
      try { return res.json({ success: true, data: urlService.list() }); } catch (error) { return next(error); }
    },
    get: (req, res, next) => {
      try {
        const url = urlService.getByCode(req.params.shortCode);
        if (!url) return res.status(404).json({ success: false, error: 'Short URL not found' });
        return res.json({ success: true, data: url });
      } catch (error) { return next(error); }
    },
    redirect: (req, res, next) => {
      try {
        const originalUrl = urlService.redirect(req.params.shortCode);
        if (!originalUrl) return res.status(404).json({ success: false, error: 'Short URL not found' });
        return res.redirect(302, originalUrl);
      } catch (error) { return next(error); }
    },
  };
}

module.exports = { createUrlController };
