import express from "express";
import { createUrlController } from "../controllers/urlController.js";
import { requireAdmin } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimiter.js";

function createUrlRoutes(urlService, config) {
  const router = express.Router();
  const controller = createUrlController(urlService, config.baseUrl);
  const admin = requireAdmin(config.adminApiKey);
  router.post(
    "/",
    createLimiter(config.rateLimitWindowMs, config.createRateLimitMax),
    controller.create,
  );
  router.get("/", admin, controller.list);
  router.get("/:shortCode", admin, controller.get);
  return router;
}

export { createUrlRoutes };
