import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config/environment.js";
import { createDatabase } from "../src/config/database.js";
import { UrlService } from "../src/services/urlService.js";

test("configuration uses safe defaults and rejects malformed settings", () => {
  assert.equal(loadConfig({}).port, 5000);
  assert.equal(loadConfig({}).baseUrl, "http://localhost:5000");
  assert.equal(
    loadConfig({ PORT: "5001", BASE_URL: "https://links.example/" }).baseUrl,
    "https://links.example",
  );
  for (const env of [
    { PORT: "5000abc" },
    { PORT: "0" },
    { PORT: "65536" },
    { BASE_URL: "ftp://example.com" },
    { BASE_URL: "https://example.com/path" },
    { BASE_URL: "https://user:secret@example.com" },
    { CORS_ORIGINS: "*" },
    { ADMIN_API_KEY: "short" },
    { RATE_LIMIT_WINDOW_MS: "2147483648" },
    { RATE_LIMIT_MAX: "0" },
    { CREATE_RATE_LIMIT_MAX: "NaN" },
  ]) {
    assert.throws(() => loadConfig(env));
  }
});

test("database persists records and constraints across reopen without resetting click counts", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "codealpha-db-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "nested", "urls.sqlite");
  let db = createDatabase(filename);
  try {
    const service = new UrlService(db, { codeGenerator: () => "test123" });
    service.create("https://example.com");
    service.redirect("test123");
    assert.throws(
      () => db.prepare("UPDATE urls SET clicks = -1").run(),
      /CHECK/,
    );
    assert.equal(db.pragma("journal_mode", { simple: true }), "wal");
    assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  } finally {
    db.close();
  }
  db = createDatabase(filename);
  try {
    const link = new UrlService(db).getByCode("test123");
    assert.equal(link.originalUrl, "https://example.com");
    assert.equal(link.clicks, 1);
  } finally {
    db.close();
  }
});

test("database opening errors propagate to the caller", () => {
  assert.throws(() => createDatabase("/dev/null/urls.sqlite"));
});
