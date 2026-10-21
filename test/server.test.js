'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');
const limitedUseSentence =
  "Magnus Harness's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function childEnv(overrides) {
  const env = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return env;
}

async function startServer(contactEmail) {
  const port = await freePort();
  const child = spawn(process.execPath, [serverPath], {
    env: childEnv({ PORT: String(port), CONTACT_EMAIL: contactEmail }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start within 5000 ms')), 5000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early with code ${code}`));
    });
  });
  return { child, base: `http://127.0.0.1:${port}` };
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGTERM');
  });
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

let server;

before(async () => {
  server = await startServer('test@example.invalid');
});

after(async () => {
  await stopServer(server.child);
});

test('each page returns 200 with a utf-8 content type', async () => {
  const expected = {
    '/': 'text/html; charset=utf-8',
    '/privacy': 'text/html; charset=utf-8',
    '/terms': 'text/html; charset=utf-8',
    '/style.css': 'text/css; charset=utf-8',
    '/healthz': 'text/plain; charset=utf-8',
  };
  for (const [route, type] of Object.entries(expected)) {
    const response = await fetch(server.base + route);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('content-type'), type, route);
  }
});

test('healthz returns ok', async () => {
  const response = await fetch(`${server.base}/healthz`);
  assert.equal(await response.text(), 'ok');
});

test('home page names the app, links to the privacy policy, and links Privacy and Terms in the footer', async () => {
  const html = await (await fetch(`${server.base}/`)).text();
  assert.match(html, /<h1>Magnus Harness<\/h1>/);
  assert.match(html, /<a href="\/privacy">/);
  const footer = html.slice(html.indexOf('<footer'));
  assert.match(footer, /<a href="\/privacy">Privacy Policy<\/a>/);
  assert.match(footer, /<a href="\/terms">Terms of Service<\/a>/);
});

test('privacy page contains the Limited Use sentence, the policy link, the revoke link and the contact email', async () => {
  const html = await (await fetch(`${server.base}/privacy`)).text();
  assert.ok(stripTags(html).includes(limitedUseSentence), 'Limited Use sentence missing');
  assert.ok(html.includes('href="https://developers.google.com/terms/api-services-user-data-policy"'));
  assert.ok(html.includes('href="https://myaccount.google.com/permissions"'));
  assert.ok(html.includes('test@example.invalid'));
});

test('every response carries the security headers', async () => {
  for (const route of ['/', '/privacy', '/terms', '/style.css', '/healthz', '/missing']) {
    const response = await fetch(server.base + route);
    assert.equal(
      response.headers.get('content-security-policy'),
      "default-src 'none'; style-src 'self'; img-src 'self'",
      route
    );
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer', route);
  }
});

test('an unknown path returns 404', async () => {
  for (const route of ['/missing', '/privacy/', '/server.js', '/package.json']) {
    const response = await fetch(server.base + route);
    assert.equal(response.status, 404, route);
  }
});

test('the contact email is HTML-escaped', async () => {
  const escaped = await startServer('a<b>"c@example.invalid');
  try {
    for (const route of ['/', '/privacy', '/terms']) {
      const html = await (await fetch(escaped.base + route)).text();
      assert.ok(html.includes('a&lt;b&gt;&quot;c@example.invalid'), route);
      assert.ok(!html.includes('a<b>'), route);
    }
  } finally {
    await stopServer(escaped.child);
  }
});

test('the server refuses to start without CONTACT_EMAIL', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [serverPath], {
    env: childEnv({ PORT: String(port), CONTACT_EMAIL: undefined }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 1);
  assert.match(stderr, /CONTACT_EMAIL is not set/);
});
