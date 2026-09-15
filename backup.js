// Original flow backup/splitting concept: Mike_Nono, Homey Community. See CREDITS.md.
(function (root) {
  'use strict';
  const tr=(typeof module!=='undefined' && module.exports ? require('./i18n') : root.BackupI18n).t;

  function validateFlows(flows) {
    if (!Array.isArray(flows) || !flows.length) throw Error(tr('Geen flows gevonden.'));
    const ids = new Set();
    for (const f of flows) {
      if (!f || !['standard', 'advanced'].includes(f.type) || typeof f.name !== 'string' || !f.name ||
          typeof f.id !== 'string' || !/^[0-9a-fA-F-]{1,80}$/.test(f.id)) throw Error(tr('Ongeldige flowgegevens.'));
      if (f.folderName !== undefined && typeof f.folderName !== 'string') throw Error(tr('Ongeldige mapnaam.'));
      const key = f.type + ':' + f.id;
      if (ids.has(key)) throw Error(tr('Dubbel flow-ID: ') + f.id);
      ids.add(key);
    }
    return flows;
  }

  function buildFlows(folders, standard, advanced) {
    for (const value of [folders, standard, advanced]) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(tr('Homey gaf onvolledige flowgegevens.'));
    }
    const flows = [];
    for (const [type, collection] of [['standard', standard], ['advanced', advanced]]) {
      for (const [id, item] of Object.entries(collection)) {
        const f = JSON.parse(JSON.stringify(item));
        let folderId = f.folder;
        const path = [], seen = new Set();
        while (folderId) {
          if (seen.has(folderId) || !folders[folderId]) throw Error(tr('Een flowmap ontbreekt of bevat een cirkel.'));
          seen.add(folderId);
          const folder = folders[folderId];
          if (typeof folder.name !== 'string') throw Error(tr('Ongeldige flowmap.'));
          path.unshift(folder.name);
          folderId = folder.folder ?? folder.parent ?? folder.parentFolder ?? null;
        }
        flows.push({...f, id: f.id || id, type, folderName: path.join(' / ') || 'Root', folderPath: path});
      }
    }
    return validateFlows(flows);
  }

  function parse(text) {
    text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    if (text.trimStart().startsWith('{')) {
      const data = JSON.parse(text);
      if (data.format === 'homey-flow-backup' && data.version === 1) {
        validateFlows(data.flows); return data;
      }
      if (data.format === 'homey-backup-center' && [2, 3, 4].includes(data.version)) {
        validateFlows(data.flows);
        if (data.version === 3 && (!data.inventory || typeof data.inventory !== 'object')) throw Error(tr('Inventaris ontbreekt.'));
        return data;
      }
      throw Error(tr('Dit is geen ondersteunde Homey-back-up.'));
    }
    if (!text.trimEnd().endsWith('--- EXPORT COMPLETE ---')) throw Error(tr('De tekstexport is niet compleet.'));
    const pattern = /^_\.:\._ START_(ADVANCED_)?FLOW: [^\n]*\n([\s\S]*?)\n_\.:\._ END_(ADVANCED_)?FLOW _\.:\._(?=\n|$)/gm;
    const flows = [];
    for (const match of text.matchAll(pattern)) {
      if (match[1] !== match[3]) throw Error(tr('Flow-afsluiting klopt niet.'));
      const f = JSON.parse(match[2]);
      if (f.type !== (match[1] ? 'advanced' : 'standard')) throw Error(tr('Flowtype klopt niet.'));
      flows.push(f);
    }
    const starts = [...text.matchAll(/^_\.:\._ START_(?:ADVANCED_)?FLOW: /gm)].length;
    if (starts !== flows.length) throw Error(tr('Niet alle flows konden worden gelezen.'));
    for (const type of ['standard', 'advanced']) {
      const declared = [...text.matchAll(new RegExp('^--- FOUND (\\d+) ' + type.toUpperCase() + ' FLOWS ---$', 'gm'))];
      if (declared.length !== 1 || Number(declared[0][1]) !== flows.filter(f => f.type === type).length) throw Error(tr('Het aantal flows klopt niet.'));
    }
    validateFlows(flows);
    return {format: 'homey-flow-backup', version: 1, createdAt: null, flows};
  }

  function filename(flow) {
    const name = flow.name.replace(/[^\p{L}\p{N} ._-]/gu, '_').replace(/^[ .]+|[ .]+$/g, '').slice(0, 50) || 'Flow';
    return name + '_' + flow.id + (flow.type === 'advanced' ? '.homeyadvflow' : '.homeystdflow');
  }

  function backupFilename(date) {
    const stamp = (date || new Date()).toISOString().replace(/[:.]/g, '-');
    return 'Homey_Backup_Center_' + stamp + '.json';
  }

  const api = {buildFlows, parse, validate: validateFlows, filename, backupFilename};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlowBackup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
