import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";
import { createApp } from "../src/app.js";
import { createLink, listLinks, getLink } from "../frontend/src/api.js";

test("React entry and frontend API client work through the real Vite proxy and Express backend", async (t) => {
  const adminApiKey = "integration-test-only-key-at-least-32-characters";
  const instance = createApp({ databasePath: ":memory:", adminApiKey });
  const backend = instance.app.listen(0, "127.0.0.1");
  await once(backend, "listening");
  let vite;
  t.after(async () => {
    if (vite) await vite.close();
    await new Promise((resolve) => backend.close(resolve));
    instance.db.close();
  });
  const target = `http://127.0.0.1:${backend.address().port}`;
  vite = await createServer({
    configFile: false,
    root: new URL("../frontend", import.meta.url).pathname,
    server: { host: "127.0.0.1", port: 0, proxy: { "/api": target } },
  });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (url, options) =>
    realFetch(new URL(url, origin), options),
  );
  const html = await fetch("/").then((res) => res.text());
  assert.ok(html.includes("CodeAlpha"));
  const component = await fetch("/src/App.jsx");
  assert.equal(component.status, 200);
  assert.ok((await component.text()).includes("Make a short link"));
  const created = await createLink("https://example.com/frontend-integration");
  assert.match(created.shortCode, /^[\w-]{7}$/);
  await assert.rejects(
    () => listLinks(),
    (error) => error.status === 401,
  );
  await assert.rejects(
    () => getLink(created.shortCode, "wrong"),
    (error) => error.status === 401,
  );
  const redirected = await fetch(`${target}/${created.shortCode}`, {
    redirect: "manual",
  });
  assert.equal(redirected.status, 302);
  assert.equal(
    redirected.headers.get("location"),
    "https://example.com/frontend-integration",
  );
  const links = await listLinks(adminApiKey);
  assert.equal(links.length, 1);
  assert.equal((await getLink(created.shortCode, adminApiKey)).clicks, 1);
  await assert.rejects(
    () => createLink("ftp://example.com"),
    (error) => error.status === 400,
  );
});
