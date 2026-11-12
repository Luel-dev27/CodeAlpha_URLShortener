import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createDatabase } from "./config/database.js";
import { loadConfig } from "./config/environment.js";
import { UrlService } from "./services/urlService.js";
import { createUrlRoutes } from "./routes/urlRoutes.js";
import { createUrlController } from "./controllers/urlController.js";
import { createLimiter } from "./middleware/rateLimiter.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

function createApp(options = {}) {
  const config = { ...loadConfig(), ...options };
  const db = options.db || createDatabase(config.databasePath);
  try {
    const app = express();
    const urlService = new UrlService(db, options);
    const controller = createUrlController(urlService, config.baseUrl);
    app.disable("x-powered-by");
    app.use(helmet());
    app.use(cors({ origin: config.allowedOrigins }));
    app.use((_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    });
    app.get("/api/health", (_req, res, next) => {
      try {
        db.prepare("SELECT 1").get();
        res.json({ success: true, status: "ok" });
      } catch (error) {
        next(error);
      }
    });
    app.use(createLimiter(config.rateLimitWindowMs, config.rateLimitMax));
    app.use(express.json({ limit: "10kb" }));
    app.use("/api/urls", createUrlRoutes(urlService, config));
    app.get("/:shortCode", controller.redirect);
    app.use(notFound);
    app.use(errorHandler);
    return { app, db, urlService };
  } catch (error) {
    if (!options.db) db.close();
    throw error;
  }
}

export { createApp };
