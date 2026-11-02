const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let instance;
let server;
let base;

before(async () => {
  instance = createApp({ databasePath: ':memory:', baseUrl: 'http://localhost:5000' });
  server = instance.app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  instance.db.close();
});

test('creates a shortened URL and stores it', async () => {
  const response = await fetch(`${base}/api/urls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://www.google.com' }) });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.originalUrl, 'https://www.google.com');
  assert.match(body.data.shortCode, /^[\w-]{7}$/);
  assert.equal(body.data.shortUrl, `http://localhost:5000/${body.data.shortCode}`);
});

test('rejects invalid URLs and non-http schemes', async () => {
  for (const url of ['not a URL', 'javascript:alert(1)', 'ftp://example.com']) {
    const response = await fetch(`${base}/api/urls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    assert.equal(response.status, 400);
  }
});

test('redirects known codes and increments clicks', async () => {
  const created = await fetch(`${base}/api/urls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/path' }) }).then((res) => res.json());
  const response = await fetch(`${base}/${created.data.shortCode}`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://example.com/path');
  const info = await fetch(`${base}/api/urls/${created.data.shortCode}`).then((res) => res.json());
  assert.equal(info.data.clicks, 1);
});

test('returns 404 for missing URLs', async () => {
  const redirect = await fetch(`${base}/no-such-code`, { redirect: 'manual' });
  const info = await fetch(`${base}/api/urls/no-such-code`);
  assert.equal(redirect.status, 404);
  assert.equal(info.status, 404);
});
