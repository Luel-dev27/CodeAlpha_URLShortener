// Optional real-browser checks using an existing Firefox + geckodriver installation.
// No browser download or system installation is performed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import net from "node:net";
import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";
import { createApp } from "../src/app.js";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await pause(100);
  }
  throw new Error(`Timed out: ${label}`);
}

test(
  "Firefox: create, copy, open, authorize statistics, lock, errors, and responsive layout",
  { timeout: 90000 },
  async (t) => {
    const key = "browser-test-only-admin-key-at-least-32-characters";
    const backendReservation = net.createServer();
    backendReservation.listen(0, "127.0.0.1");
    await once(backendReservation, "listening");
    const backendPort = backendReservation.address().port;
    await new Promise((resolve) => backendReservation.close(resolve));
    const instance = createApp({
      databasePath: ":memory:",
      adminApiKey: key,
      baseUrl: `http://127.0.0.1:${backendPort}`,
    });
    const backend = instance.app.listen(backendPort, "127.0.0.1");
    await once(backend, "listening");
    let vite, driver, session, driverOrigin;
    t.after(async () => {
      if (session)
        await fetch(`${driverOrigin}/session/${session}`, {
          method: "DELETE",
        }).catch(() => {});
      if (driver && driver.exitCode === null) driver.kill("SIGTERM");
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
    const reserve = net.createServer();
    reserve.listen(0, "127.0.0.1");
    await once(reserve, "listening");
    const driverPort = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
    driverOrigin = `http://127.0.0.1:${driverPort}`;
    driver = spawn(
      process.env.GECKODRIVER_PATH || "geckodriver",
      ["--host", "127.0.0.1", "--port", String(driverPort), "--log", "error"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let driverError;
    driver.on("error", (error) => {
      driverError = error;
    });
    await until(async () => {
      if (driverError) throw driverError;
      try {
        return (await fetch(`${driverOrigin}/status`)).ok;
      } catch {
        return false;
      }
    }, "geckodriver readiness");
    async function command(path, method = "GET", data) {
      const response = await fetch(`${driverOrigin}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      const { value } = await response.json();
      if (!response.ok)
        throw new Error(
          `WebDriver ${path}: ${value?.message || response.status}`,
        );
      return value;
    }
    const created = await command("/session", "POST", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          "moz:firefoxOptions": { args: ["-headless"] },
        },
      },
    });
    session = created.sessionId;
    const route = (suffix) => `/session/${session}${suffix}`;
    const execute = (script, args = []) =>
      command(route("/execute/sync"), "POST", { script, args });
    const find = async (selector) =>
      (
        await command(route("/element"), "POST", {
          using: "css selector",
          value: selector,
        })
      )["element-6066-11e4-a52e-4f735466cecf"];
    const click = async (selector) =>
      command(route(`/element/${await find(selector)}/click`), "POST", {});
    const type = async (selector, text) =>
      command(route(`/element/${await find(selector)}/value`), "POST", {
        text,
      });
    await command(route("/url"), "POST", { url: origin });
    await until(
      () => execute('return !!document.querySelector("#url")'),
      "React mounted",
    );
    const destination = `${target}/api/health?source=browser`;
    await type("#url", destination);
    await click("form button");
    await until(
      () => execute('return !!document.querySelector(".short-link")'),
      "short link created",
    );
    const shortUrl = await execute(
      'return document.querySelector(".short-link").href',
    );
    assert.match(shortUrl, /\/[\w-]{7}$/);

    // A deterministic clipboard double checks the UI's success and fallback branches.
    await execute(
      'Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { window.testCopied = value; } } });',
    );
    await click(".result-actions button");
    await until(
      () =>
        execute(
          'return document.body.textContent.includes("Link copied to clipboard")',
        ),
      "copy confirmation",
    );
    assert.equal(await execute("return window.testCopied"), shortUrl);
    await execute(
      'Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } });',
    );
    await click(".result-actions button");
    await until(
      () =>
        execute('return document.body.textContent.includes("Select and copy")'),
      "clipboard fallback",
    );

    const originalHandle = await command(route("/window"));
    await click(".result-actions a");
    const handles = await until(async () => {
      const values = await command(route("/window/handles"));
      return values.length === 2 ? values : false;
    }, "destination tab");
    await command(route("/window"), "POST", {
      handle: handles.find((handle) => handle !== originalHandle),
    });
    await until(
      async () => (await command(route("/url"))) === destination,
      "short-link redirect",
    );
    await command(route("/window"), "POST", { handle: originalHandle });
    assert.equal(instance.urlService.list()[0].clicks, 1);

    await click(".admin-heading button");
    await type("#admin-key", "wrong-key");
    await click(".admin-content form button");
    await until(
      () =>
        execute(
          'return document.body.textContent.includes("valid administrator key")',
        ),
      "authorization error",
    );
    assert.equal(
      await execute('return !!document.querySelector("table")'),
      false,
    );
    await type("#admin-key", key);
    await click(".admin-content form button");
    await until(
      () => execute('return !!document.querySelector("tbody tr")'),
      "authorized statistics",
    );
    assert.equal(
      await execute(
        'return document.querySelector("tbody tr td:nth-child(2)").textContent',
      ),
      "1",
    );
    await click("tbody button");
    await until(
      () => execute('return !!document.querySelector(".detail")'),
      "link details",
    );
    assert.ok(
      (
        await execute('return document.querySelector(".detail").textContent')
      ).includes("Redirect requests: 1"),
    );
    await click(".admin-content .result-actions button:nth-child(2)");
    assert.equal(
      await execute('return !!document.querySelector("table")'),
      false,
    );
    assert.equal(
      await execute('return document.querySelector("#admin-key").value'),
      "",
    );

    await execute('document.querySelector("#url").value = ""');
    await type("#url", "ftp://example.com");
    await click("form button");
    await until(
      () =>
        execute(
          'return document.body.textContent.includes("URL must use http or https")',
        ),
      "validation error",
    );
    await command(route("/window/rect"), "POST", { width: 390, height: 844 });
    assert.equal(
      await execute(
        "return document.documentElement.scrollWidth <= window.innerWidth",
      ),
      true,
    );
    const screenshot = await command(route("/screenshot"));
    writeFileSync(
      "/tmp/codealpha-mobile.png",
      Buffer.from(screenshot, "base64"),
    );
    await command(route("/window/rect"), "POST", { width: 1280, height: 960 });
    writeFileSync(
      "/tmp/codealpha-desktop.png",
      Buffer.from(await command(route("/screenshot")), "base64"),
    );
  },
);
