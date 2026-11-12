import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config/environment.js";

let db;
let server;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);
  const timeout = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10000);
  timeout.unref();
  server.close((error) => {
    clearTimeout(timeout);
    try {
      db.close();
    } catch {
      console.error("Database close failed");
      process.exitCode = 1;
    }
    if (error) {
      console.error("HTTP server close failed");
      process.exitCode = 1;
    }
  });
}

try {
  const config = loadConfig();
  const instance = createApp(config);
  db = instance.db;
  server = instance.app.listen(config.port, () =>
    console.log(`URL shortener listening on port ${config.port}`),
  );
  server.on("error", (error) => {
    console.error(`HTTP server failed (${error.code || "unknown error"})`);
    db.close();
    process.exitCode = 1;
  });
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
} catch {
  console.error(
    "Startup failed. Check environment configuration, database path, and filesystem permissions.",
  );
  process.exitCode = 1;
}
