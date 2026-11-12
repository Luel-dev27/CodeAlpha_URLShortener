import { test } from "node:test";
import assert from "node:assert/strict";
import { createLink, listLinks, getLink } from "../src/api.js";

test("API client creates links and attaches credentials only when supplied", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({ success: true, data: { shortCode: "abc1234" } }),
      { status: 200 },
    );
  });
  assert.equal((await createLink("https://example.com")).shortCode, "abc1234");
  await listLinks("test-secret");
  await getLink("a/b", "test-secret");
  assert.equal(calls[0].url, "/api/urls");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    url: "https://example.com",
  });
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-secret");
  assert.equal(calls[2].url, "/api/urls/a%2Fb");
});

test("API client reports validation, authorization, rate limit, network, and invalid-response errors", async (t) => {
  for (const [status, body, expected] of [
    [400, { details: [{ message: "Invalid URL" }] }, "Invalid URL"],
    [401, { error: "A valid administrator key is required" }, "administrator"],
    [429, { error: "Too many requests" }, "Too many"],
  ]) {
    const mock = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(body), { status }),
    );
    await assert.rejects(
      () => listLinks("wrong"),
      (error) => error.status === status && error.message.includes(expected),
    );
    mock.mock.restore();
  }
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    () => createLink("https://example.com"),
    /Could not reach/,
  );
  network.mock.restore();
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Bad gateway</html>", { status: 502 }),
  );
  await assert.rejects(() => listLinks("test"), /unexpected response/);
});
