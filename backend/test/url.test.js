import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

const key = "test-only-admin-key-with-at-least-32-characters";
const auth = { Authorization: `Bearer ${key}` };

async function fixture(t, options = {}) {
  const instance = createApp({
    databasePath: ":memory:",
    baseUrl: "http://localhost:5000",
    adminApiKey: key,
    ...options,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (instance.db.open) instance.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const create = (url) =>
    fetch(`${base}/api/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  return { ...instance, base, create };
}

test("creates a shortened URL and stores it", async (t) => {
  const { create, base } = await fixture(t);
  const response = await create("  https://www.google.com  ");
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.originalUrl, "https://www.google.com");
  assert.match(body.data.shortCode, /^[\w-]{7}$/);
  assert.equal(
    body.data.shortUrl,
    `http://localhost:5000/${body.data.shortCode}`,
  );
  const info = await fetch(`${base}/api/urls/${body.data.shortCode}`, {
    headers: auth,
  }).then((res) => res.json());
  assert.equal(info.data.clicks, 0);
  assert.ok(!Number.isNaN(Date.parse(info.data.createdAt)));
});

test("rejects invalid URLs, credentials, extra fields, and invalid bodies without inserting rows", async (t) => {
  const { create, base, urlService } = await fixture(t);
  for (const value of [
    "not a URL",
    "javascript:alert(1)",
    "ftp://example.com",
    "",
    "https://user:secret@example.com",
    `https://example.com/${"x".repeat(2048)}`,
    null,
    12,
  ]) {
    assert.equal((await create(value)).status, 400);
  }
  for (const body of [{}, { url: "https://example.com", extra: true }]) {
    const res = await fetch(`${base}/api/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 400);
    assert.ok((await res.json()).details.length);
  }
  assert.equal(urlService.list().length, 0);
});

test("redirects to the exact destination and counts each GET, but not HEAD or statistics reads", async (t) => {
  const { create, base } = await fixture(t);
  const destination = "https://example.com/path?q=hello%20world#section";
  const { data } = await (await create(destination)).json();
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${base}/${data.shortCode}`, {
      redirect: "manual",
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), destination);
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  assert.equal(
    (
      await fetch(`${base}/${data.shortCode}`, {
        method: "HEAD",
        redirect: "manual",
      })
    ).status,
    302,
  );
  for (let i = 0; i < 2; i++) {
    const info = await fetch(`${base}/api/urls/${data.shortCode}`, {
      headers: auth,
    }).then((res) => res.json());
    assert.equal(info.data.clicks, 3);
  }
});

test("returns 404 for unknown short codes and unmatched routes", async (t) => {
  const { base } = await fixture(t);
  for (const path of [
    "/no-such-code",
    "/api/urls/no-such-code",
    "/unknown/route",
  ]) {
    const res = await fetch(base + path, { headers: auth, redirect: "manual" });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).success, false);
  }
});

test("protects listing and details while preserving public creation and redirects", async (t) => {
  const { base, create } = await fixture(t);
  const { data } = await (await create("https://private.example/path")).json();
  for (const path of ["/api/urls", `/api/urls/${data.shortCode}`]) {
    for (const headers of [
      {},
      { Authorization: "Bearer wrong" },
      { Authorization: `Basic ${key}` },
    ]) {
      const res = await fetch(base + path, { headers });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.ok(!(await res.text()).includes("private.example"));
    }
  }
  const res = await fetch(`${base}/api/urls`, { headers: auth });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.length, 1);
  assert.equal(
    (await fetch(`${base}/${data.shortCode}`, { redirect: "manual" })).status,
    302,
  );
});

test("administration fails closed when no administrator key is configured", async (t) => {
  const { base, create } = await fixture(t, { adminApiKey: "" });
  assert.equal(
    (await fetch(`${base}/api/urls`, { headers: auth })).status,
    503,
  );
  assert.equal(
    (await fetch(`${base}/api/urls/anything`, { headers: auth })).status,
    503,
  );
  assert.equal((await create("https://example.com")).status, 201);
});

test("lists newest links first", async (t) => {
  const { base, create } = await fixture(t);
  await create("https://example.com/first");
  await create("https://example.com/second");
  const { data } = await fetch(`${base}/api/urls`, { headers: auth }).then(
    (res) => res.json(),
  );
  assert.deepEqual(
    data.map((row) => row.originalUrl),
    ["https://example.com/second", "https://example.com/first"],
  );
});

test("retries duplicate short codes and preserves the existing mapping", async (t) => {
  const codes = ["same123", "same123", "new1234"];
  const { create, urlService } = await fixture(t, {
    codeGenerator: () => codes.shift(),
  });
  assert.equal((await create("https://example.com/one")).status, 201);
  const response = await create("https://example.com/two");
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.shortCode, "new1234");
  assert.equal(
    urlService.getByCode("same123").originalUrl,
    "https://example.com/one",
  );
});

test("returns 503 after five duplicate-code attempts without changing data", async (t) => {
  let calls = 0;
  const { create, urlService } = await fixture(t, {
    codeGenerator: () => {
      calls++;
      return "same123";
    },
  });
  await create("https://example.com/one");
  const res = await create("https://example.com/two");
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), {
    success: false,
    error: "Internal server error",
  });
  assert.equal(calls, 6);
  assert.equal(urlService.list().length, 1);
});

test("returns safe errors for database failures and rolls back failed redirect updates", async (t) => {
  const { create, base, db, urlService } = await fixture(t);
  const { data } = await (await create("https://example.com")).json();
  db.exec(
    "CREATE TRIGGER fail_click BEFORE UPDATE ON urls BEGIN SELECT RAISE(ABORT, 'test internal detail'); END",
  );
  const redirect = await fetch(`${base}/${data.shortCode}`, {
    redirect: "manual",
  });
  assert.equal(redirect.status, 500);
  assert.deepEqual(await redirect.json(), {
    success: false,
    error: "Internal server error",
  });
  assert.equal(urlService.getByCode(data.shortCode).clicks, 0);
  db.close();
  for (const res of [
    await create("https://example.com/two"),
    await fetch(`${base}/api/urls`, { headers: auth }),
    await fetch(`${base}/api/health`),
  ]) {
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      success: false,
      error: "Internal server error",
    });
  }
});

test("rate limits creation with a retry header and a JSON response", async (t) => {
  const { create } = await fixture(t, { createRateLimitMax: 2 });
  assert.equal((await create("https://example.com/1")).status, 201);
  assert.equal((await create("https://example.com/2")).status, 201);
  const res = await create("https://example.com/3");
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) > 0);
  assert.equal((await res.json()).success, false);
});

test("rate limits general requests while health remains available", async (t) => {
  const { base } = await fixture(t, { rateLimitMax: 2 });
  for (let i = 0; i < 2; i++)
    assert.equal((await fetch(`${base}/api/urls`)).status, 401);
  assert.equal(
    (await fetch(`${base}/api/urls`, { headers: auth })).status,
    429,
  );
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});

test("returns meaningful malformed JSON and oversized-body errors", async (t) => {
  const { base } = await fixture(t);
  for (const [body, status, message] of [
    ["{", 400, "Malformed JSON"],
    [JSON.stringify({ url: "a".repeat(11000) }), 413, "10 KB"],
  ]) {
    const res = await fetch(`${base}/api/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    assert.equal(res.status, status);
    assert.ok((await res.json()).error.includes(message));
  }
});

test("sets security headers and allows only configured browser origins", async (t) => {
  const { base } = await fixture(t, {
    allowedOrigins: ["http://localhost:5173"],
  });
  const allowed = await fetch(`${base}/api/health`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:5173",
  );
  assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");
  assert.equal(allowed.headers.get("x-powered-by"), null);
  const blocked = await fetch(`${base}/api/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
  const preflight = await fetch(`${base}/api/urls`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.status, 204);
});

test("concurrent redirect requests do not lose click increments", async (t) => {
  const { create, base, urlService } = await fixture(t);
  const { data } = await (
    await create("https://example.com/concurrent")
  ).json();
  const responses = await Promise.all(
    Array.from({ length: 20 }, () =>
      fetch(`${base}/${data.shortCode}`, { redirect: "manual" }),
    ),
  );
  assert.ok(responses.every((response) => response.status === 302));
  assert.equal(urlService.getByCode(data.shortCode).clicks, 20);
});
