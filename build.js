'use strict';

// Writes the static site. Usage: CONTACT_EMAIL=address node build.js [output folder]
// The output folder defaults to dist/ next to this file.

const fs = require('node:fs');
const path = require('node:path');
const { buildPages, escapeHtml } = require('./pages');

const contactEmail = (process.env.CONTACT_EMAIL || '').trim();
if (contactEmail === '') {
  console.error(
    'CONTACT_EMAIL is not set. Set it to the address that answers privacy and support questions, then run the build again. In GitHub Actions, set the repository variable CONTACT_EMAIL.'
  );
  process.exit(1);
}

const outputDir = path.resolve(process.argv[2] || path.join(__dirname, 'dist'));

const files = {
  ...buildPages(escapeHtml(contactEmail)),
  'style.css': fs.readFileSync(path.join(__dirname, 'style.css')),
  '.nojekyll': '',
};

for (const [relativePath, contents] of Object.entries(files)) {
  const target = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

console.log(`Wrote ${Object.keys(files).length} files to ${outputDir}`);
