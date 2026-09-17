'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('restore UI clearly communicates selective restore in English and Dutch', () => {
  const html = fs.readFileSync(path.join(root, 'settings', 'index.html'), 'utf8');
  const i18n = fs.readFileSync(path.join(root, 'settings', 'i18n.js'), 'utf8');

  assert.match(html, /6\. Selective restore/);
  assert.match(html, /Wijzigingen selecteren/);

  assert.match(
    i18n,
    /"Check restore plan": "Select changes"/
  );

  assert.match(
    i18n,
    /"Check restore plan": "Wijzigingen selecteren"/
  );

  assert.match(
    i18n,
    /Nothing has been changed yet\. Select only the changes you want to restore below\./
  );

  assert.match(
    i18n,
    /Er is nog niets gewijzigd\. Kies hieronder alleen de wijzigingen die je wilt herstellen\./
  );
});
