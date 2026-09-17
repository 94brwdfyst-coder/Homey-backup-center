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

test('BLL selective restore UI is explicit and safe', () => {
  const ui = fs.readFileSync(path.join(root, 'settings', 'ui.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(root, 'settings', 'i18n.js'), 'utf8');

  // BLL has its own restore category and is rendered with the restore plan.
  assert.match(ui, /function renderBetterLogicSelection\(plan\)/);
  assert.match(
    ui,
    /renderLogicSelection\(plan\);\s*renderBetterLogicSelection\(plan\);/
  );

  // Restore choices are opt-in. Unsupported BLL operations cannot be selected.
  assert.match(ui, /cb\.className='betterLogicRestoreSelect'/);
  assert.match(ui, /cb\.checked=false/);
  assert.match(
    ui,
    /const supported=v\.action==='create' \|\| v\.action==='update';/
  );
  assert.match(ui, /cb\.disabled=!supported/);

  // Only checked BLL variable names become part of the explicit restore selection.
  assert.match(
    ui,
    /function selectedBetterLogicNames\(\).*betterLogicRestoreSelect:checked/
  );
  assert.match(
    ui,
    /betterLogicVariables:selectedBetterLogic/
  );

  // BLL selections count toward restore verification and are checked afterwards.
  assert.match(
    ui,
    /selectedTotal=selectedLogic\.length\+selectedBetterLogic\.length/
  );
  assert.match(
    ui,
    /verify\.betterLogicVariables\?\.operations/
  );
  assert.match(
    ui,
    /failedBetterLogic=selectedBetterLogic\.filter/
  );
  assert.match(
    ui,
    /failedCount=.*failedBetterLogic\.length/
  );

  // Both Dutch and English explain the BLL restore category.
  assert.match(
    i18n,
    /"Better Logic Library-variabelen selecteren voor restore": "Better Logic Library-variabelen selecteren voor restore"/
  );
  assert.match(
    i18n,
    /"Better Logic Library-variabelen selecteren voor restore": "Select Better Logic Library variables to restore"/
  );

  // Unsupported reasons remain visible to the user instead of silently disappearing.
  assert.match(i18n, /"missing-transient": "ontbrekende tijdelijke variabele"/);
  assert.match(i18n, /"missing-transient": "missing transient variable"/);
  assert.match(i18n, /"type-mismatch": "type komt niet overeen"/);
  assert.match(i18n, /"type-mismatch": "type mismatch"/);
});
