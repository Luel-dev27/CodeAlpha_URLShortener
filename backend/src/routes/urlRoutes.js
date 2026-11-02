const express = require('express');
const { createUrlController } = require('../controllers/urlController');

function createUrlRoutes(urlService, baseUrl) {
  const router = express.Router();
  const controller = createUrlController(urlService, baseUrl);
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:shortCode', controller.get);
  return router;
}

module.exports = { createUrlRoutes };
