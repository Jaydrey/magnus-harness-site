'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const contactEmail = (process.env.CONTACT_EMAIL || '').trim();
if (contactEmail === '') {
  console.error(
    'CONTACT_EMAIL is not set. Set it to the address that answers privacy and support questions, then start the server again.'
  );
  process.exit(1);
}

const port = Number.parseInt(process.env.PORT || '3000', 10);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const email = escapeHtml(contactEmail);
const emailLink = `<a href="mailto:${email}">${email}</a>`;
const userDataPolicyUrl = 'https://developers.google.com/terms/api-services-user-data-policy';
const lastUpdated = '21 October 2026';

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="site-header">
<a class="brand" href="/">Magnus Harness</a>
</header>
<main>
${body}
</main>
<footer class="site-footer">
<nav aria-label="Legal">
<a href="/">Home</a>
<a href="/privacy">Privacy Policy</a>
<a href="/terms">Terms of Service</a>
</nav>
<p>Contact: ${emailLink}</p>
</footer>
</body>
</html>
`;
}

const homePage = layout(
  'Magnus Harness',
  `<h1>Magnus Harness</h1>
<p class="lead">Magnus Harness is a desktop app for macOS. You chat with an AI agent that works on your Mac: it reads and edits files in the folders you choose, runs commands, and uses connected accounts, with a permission setting in each chat that decides which actions ask you first.</p>

<h2>Why Magnus Harness asks for access to your Google data</h2>
<p>You can connect one or more Google accounts in the app's Settings. The agent in a chat can then help with your Google data when you ask it to:</p>
<ul>
<li><strong>Google Calendar</strong>: list your calendars, find events and free time, and create, update, move or delete events and answer invitations.</li>
<li><strong>Gmail</strong>: search and read messages and threads, create drafts, send mail, and label, archive or mark messages as read.</li>
<li><strong>Google Drive</strong>: search and read files, and create, upload and edit files.</li>
<li><strong>Google Photos</strong>: read only the photos you pick in Google's photo picker, upload photos and create albums.</li>
</ul>
<p>Magnus Harness requests this access only so the agent can do these tasks for you. The app on your Mac talks to Google directly. Reads run without asking. The chat's permission setting decides whether the app asks you before each change.</p>
<p>Read the <a href="/privacy">Privacy Policy</a> for what Google data is accessed and how it is used, stored and shared.</p>`
);

const privacyPage = layout(
  'Privacy Policy - Magnus Harness',
  `<h1>Privacy Policy</h1>
<p class="meta">Last updated ${lastUpdated}</p>
<p>This policy explains how the Magnus Harness desktop app for macOS handles Google user data. Contact ${emailLink} with any question about it.</p>

<h2>Google user data the app accesses</h2>
<p>Magnus Harness accesses Google data only for the Google accounts you connect in the app's Settings, and only after you allow access on Google's sign-in screen. It uses these Google APIs:</p>
<ul>
<li><strong>Google Calendar API</strong>: your calendars, events, free time and invitations.</li>
<li><strong>Gmail API</strong>: your messages, threads, drafts and labels.</li>
<li><strong>Google Drive API</strong>: your files. Google Docs, Sheets and Slides are read as text.</li>
<li><strong>Google Photos Picker API</strong>: only the photos you pick in Google's photo picker. The app cannot read your whole photo library. It can also read photos that Magnus Harness itself uploaded.</li>
</ul>

<h2>How the app uses Google user data</h2>
<ul>
<li>The agent in a chat uses your Google data to answer your requests and to do the tasks you ask for, such as finding events, reading mail or opening a file. When several accounts are connected, it can read across all of them and names the account in its answer.</li>
<li>Changes are made only through actions in the chat: creating, updating, moving or deleting events, answering invitations, creating drafts, sending, labelling, archiving or marking mail as read, creating, uploading or editing files, and uploading photos or creating albums. The chat's permission setting decides whether the app asks you before each change.</li>
</ul>

<h2>How Google user data is stored</h2>
<ul>
<li>The app on your Mac calls Google directly. Magnus Harness has no server, so your Google data does not pass through or get stored on any server run for Magnus Harness.</li>
<li>The sign-in tokens Google gives the app are stored on your Mac in the app's database, with a copy in the macOS Keychain. They are never written to logs or shown in chat tool results.</li>
<li>Google data the agent reads becomes part of that chat, which the app keeps on your Mac with your other chats.</li>
</ul>

<h2>How Google user data is shared</h2>
<ul>
<li>Magnus Harness chats run on the AI model account you connect in the app, such as your Claude account with Anthropic. When the agent reads Google data in a chat, that data is sent to that AI model service as part of the chat, under your own account, so the model can answer you. That service's own terms and privacy policy apply to it.</li>
<li>The developer of Magnus Harness does not receive your Google data, because the app has no server.</li>
<li>Apart from that AI model service, your Google data leaves the app only through actions the agent takes in the chat, such as sending an email or sharing a file. The chat's permission setting decides whether the app asks you before each such action.</li>
</ul>

<h2>Limited Use</h2>
<p>Magnus Harness's use and transfer of information received from Google APIs to any other app will adhere to the <a href="${userDataPolicyUrl}">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

<h2>How to remove access</h2>
<ul>
<li>In the app, open Settings, Google, and choose Disconnect on the account. The app revokes its access at Google and deletes the account's tokens from your Mac.</li>
<li>At any time you can also remove Magnus Harness's access from your Google Account at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</li>
</ul>

<h2>Contact</h2>
<p>Questions about this policy or about your data: ${emailLink}.</p>`
);

const termsPage = layout(
  'Terms of Service - Magnus Harness',
  `<h1>Terms of Service</h1>
<p class="meta">Last updated ${lastUpdated}</p>
<p>These terms apply when you use the Magnus Harness desktop app for macOS.</p>

<h2>The app</h2>
<p>Magnus Harness is provided as it is, without any warranty, and may change or stop working at any time.</p>

<h2>Your responsibility</h2>
<ul>
<li>You choose which folders, accounts and Google accounts the app can use, and which permission setting each chat runs in.</li>
<li>You are responsible for the actions you allow the agent to take, such as sending mail, changing calendar events or editing files. Check what an action will do before you allow it.</li>
<li>AI model answers can be wrong. Check important results yourself.</li>
</ul>

<h2>Other services</h2>
<p>Your use of Google services through the app is also subject to Google's terms. Your use of the AI model service you connect, such as Anthropic's Claude, is subject to that service's terms.</p>

<h2>Privacy</h2>
<p>The <a href="/privacy">Privacy Policy</a> explains how the app handles Google user data.</p>

<h2>Contact</h2>
<p>Questions about these terms: ${emailLink}.</p>`
);

const stylesheet = fs.readFileSync(path.join(__dirname, 'style.css'));

const routes = {
  '/': { type: 'text/html; charset=utf-8', body: homePage },
  '/privacy': { type: 'text/html; charset=utf-8', body: privacyPage },
  '/terms': { type: 'text/html; charset=utf-8', body: termsPage },
  '/style.css': { type: 'text/css; charset=utf-8', body: stylesheet },
  '/healthz': { type: 'text/plain; charset=utf-8', body: 'ok' },
};

const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function send(req, res, status, type, body, extraHeaders = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  res.writeHead(status, {
    ...securityHeaders,
    ...extraHeaders,
    'Content-Type': type,
    'Content-Length': buffer.length,
  });
  res.end(req.method === 'HEAD' ? undefined : buffer);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(req, res, 405, 'text/plain; charset=utf-8', 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const route = Object.prototype.hasOwnProperty.call(routes, pathname) ? routes[pathname] : null;
  if (route === null) {
    send(req, res, 404, 'text/plain; charset=utf-8', 'Not found');
    return;
  }
  send(req, res, 200, route.type, route.body);
});

server.listen(port, () => {
  console.log(`Magnus Harness site listening on port ${server.address().port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
