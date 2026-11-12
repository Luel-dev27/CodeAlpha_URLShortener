import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

async function start(t, overrides = {}) {
  const reservation = net.createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      BASE_URL: `http://localhost:${port}`,
      DATABASE_PATH: ":memory:",
      ADMIN_API_KEY: "",
      ...overrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });
  const exit = once(child, "exit");
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  return { child, port, exit, output: () => output };
}

test(
  "server loads configuration, starts, and shuts down cleanly on SIGTERM",
  { timeout: 10000 },
  async (t) => {
    const instance = await start(t);
    await new Promise((resolve, reject) => {
      const inspect = () => {
        if (instance.output().includes("listening on port")) resolve();
      };
      instance.child.stdout.on("data", inspect);
      instance.child.once("exit", () =>
        reject(new Error("Server exited before readiness")),
      );
      inspect();
    });
    assert.equal(
      (await fetch(`http://127.0.0.1:${instance.port}/api/health`)).status,
      200,
    );
    instance.child.kill("SIGTERM");
    const [code, signal] = await instance.exit;
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.ok(instance.output().includes("shutting down"));
  },
);

test(
  "server rejects invalid configuration before listening",
  { timeout: 10000 },
  async (t) => {
    const instance = await start(t, { PORT: "5000abc" });
    const [code] = await instance.exit;
    assert.equal(code, 1);
    assert.ok(instance.output().includes("Startup failed"));
  },
);

test(
  "server exits cleanly with failure when its port is already occupied",
  { timeout: 10000 },
  async (t) => {
    const occupied = net.createServer();
    occupied.listen(0, "0.0.0.0");
    await once(occupied, "listening");
    t.after(() => new Promise((resolve) => occupied.close(resolve)));
    const instance = await start(t, { PORT: String(occupied.address().port) });
    const [code] = await instance.exit;
    assert.equal(code, 1);
    assert.ok(instance.output().includes("EADDRINUSE"));
  },
);
