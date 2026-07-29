#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
let raw = fs.readFileSync(configPath, 'utf8');

if (process.env.TAURI_UPDATER_PUBKEY) {
    raw = raw.replace(/__TAURI_UPDATER_PUBKEY__/g, process.env.TAURI_UPDATER_PUBKEY);
}

fs.writeFileSync(configPath, raw);
