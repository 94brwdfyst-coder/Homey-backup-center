'use strict';
const js=require('@eslint/js');
const globals=require('globals');
module.exports=[
 {ignores:['node_modules/**','.homeybuild/**']},
 {files:['**/*.js','**/*.cjs'],languageOptions:{ecmaVersion:2022,sourceType:'commonjs',globals:{...globals.node,...globals.browser}},rules:{...js.configs.recommended.rules,'no-unused-vars':'off','no-redeclare':['error',{builtinGlobals:false}],'no-empty':['error',{allowEmptyCatch:true}]}},
 {files:['lib/network.js'],rules:{'no-control-regex':'off'}},
 {files:['settings/*.js'],languageOptions:{sourceType:'script',globals:{BackupI18n:'readonly',BackupDownload:'readonly',FlowBackup:'readonly',BackupTransfer:'readonly',Homey:'readonly',NetworkUi:'readonly',api:'readonly'}}},
];
