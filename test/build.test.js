'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectDir = path.join(__dirname, '..');
const buildPath = path.join(projectDir, 'build.js');
const workflowPath = path.join(projectDir, '.github', 'workflows', 'pages.yml');
const pagePaths = ['index.html', 'privacy/index.html', 'terms/index.html'];
const contentSecurityPolicy = "default-src 'none'; style-src 'self'; img-src 'self'";
const limitedUseSentence =
  "Magnus Harness's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.";

function childEnv(overrides) {
  const env = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return env;
}

function runBuild(outputDir, contactEmail) {
  return spawnSync(process.execPath, [buildPath, outputDir], {
    env: childEnv({ CONTACT_EMAIL: contactEmail }),
    encoding: 'utf8',
  });
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

let tempRoot;
let siteDir;

function readPage(relativePath, dir = siteDir) {
  return fs.readFileSync(path.join(dir, relativePath), 'utf8');
}

before(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-harness-site-'));
  siteDir = path.join(tempRoot, 'site');
  const result = runBuild(siteDir, 'test@example.invalid');
  assert.equal(result.status, 0, result.stderr);
});

after(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('the build writes the three pages, the stylesheet and .nojekyll', () => {
  for (const relativePath of [...pagePaths, 'style.css', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(siteDir, relativePath)), relativePath);
  }
});

test('the privacy page contains the Limited Use sentence, the policy link, the revoke link and the contact email', () => {
  const html = readPage('privacy/index.html');
  assert.ok(stripTags(html).includes(limitedUseSentence), 'Limited Use sentence missing');
  assert.ok(html.includes('href="https://developers.google.com/terms/api-services-user-data-policy"'));
  assert.ok(html.includes('href="https://myaccount.google.com/permissions"'));
  assert.ok(html.includes('test@example.invalid'));
});

test('the home page links to the privacy policy relatively, and the footer links Privacy and Terms', () => {
  const html = readPage('index.html');
  assert.match(html, /<h1>Magnus Harness<\/h1>/);
  const main = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
  assert.match(main, /<a href="privacy\/">Privacy Policy<\/a>/);
  const footer = html.slice(html.indexOf('<footer'));
  assert.match(footer, /<a href="privacy\/">Privacy Policy<\/a>/);
  assert.match(footer, /<a href="terms\/">Terms of Service<\/a>/);
});

test('the privacy and terms pages link back with ../ paths', () => {
  for (const relativePath of ['privacy/index.html', 'terms/index.html']) {
    const html = readPage(relativePath);
    assert.ok(html.includes('<link rel="stylesheet" href="../style.css">'), relativePath);
    const footer = html.slice(html.indexOf('<footer'));
    assert.match(footer, /<a href="\.\.\/">Home<\/a>/, relativePath);
    assert.match(footer, /<a href="\.\.\/privacy\/">Privacy Policy<\/a>/, relativePath);
    assert.match(footer, /<a href="\.\.\/terms\/">Terms of Service<\/a>/, relativePath);
  }
});

test('no href or src is root-absolute, so the site works under a path prefix', () => {
  for (const relativePath of pagePaths) {
    const html = readPage(relativePath);
    const values = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((match) => match[1]);
    assert.ok(values.length > 0, relativePath);
    for (const value of values) {
      assert.ok(!value.startsWith('/'), `${relativePath}: ${value}`);
    }
  }
});

test('each page carries the Content-Security-Policy and referrer meta tags', () => {
  for (const relativePath of pagePaths) {
    const html = readPage(relativePath);
    assert.ok(
      html.includes(`<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`),
      relativePath
    );
    assert.ok(html.includes('<meta name="referrer" content="no-referrer">'), relativePath);
  }
});

test('the contact email is HTML-escaped', () => {
  const escapedDir = path.join(tempRoot, 'escaped');
  const result = runBuild(escapedDir, 'a<b>"c@example.invalid');
  assert.equal(result.status, 0, result.stderr);
  for (const relativePath of pagePaths) {
    const html = readPage(relativePath, escapedDir);
    assert.ok(html.includes('a&lt;b&gt;&quot;c@example.invalid'), relativePath);
    assert.ok(!html.includes('a<b>'), relativePath);
  }
});

test('the build fails with a clear message when CONTACT_EMAIL is unset or blank', () => {
  for (const contactEmail of [undefined, '', '   ']) {
    const missingDir = path.join(tempRoot, 'missing');
    const result = runBuild(missingDir, contactEmail);
    assert.equal(result.status, 1, JSON.stringify(contactEmail));
    assert.match(result.stderr, /CONTACT_EMAIL is not set/);
    assert.ok(!fs.existsSync(missingDir), 'no output is written');
  }
});

test('the Pages workflow passes the CONTACT_EMAIL repository variable to the build', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /CONTACT_EMAIL: \$\{\{ vars\.CONTACT_EMAIL \}\}/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /path: dist/);
});
