#!/usr/bin/env node
/**
 * konverter-liturgi.mjs — CLI for offline konvertering docx/pdf → .limal.
 *
 * Kjører ALLTI mot siste versjon av konverter-logikken: henter
 * electron/konverter.cjs fra liturgi-app-repoet (kilden til sannheten)
 * til ~/.cache/liturgi-limal/ og kjører derfra. Faller tilbake til
 * scripts/fallback/konverter.cjs hvis nettet er nede (--offline eller
 * fetch-feil) og hurtiglageret er tomt.
 *
 * Bruk:
 *   node konverter-liturgi.mjs <input.docx|pdf> [--navn "Navn"] \
 *        [--type gudstjeneste|vigsel|gravferd] [--maalform bokmål] [-o ut.limal]
 *   [--offline]  — ikke forsøk å hente siste versjon (bruk hurtiglager/fallback)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const her = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CACHE = path.join(os.homedir(), '.cache', 'liturgi-limal');
const RAW = 'https://raw.githubusercontent.com/ArnstadFredrik/liturgi-app/main/electron/konverter.cjs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--navn') opt.navn = args[++i];
  if (args[i] === '--type') opt.type = args[++i];
  if (args[i] === '--maalform') opt.maalform = args[++i];
  if (args[i] === '-o') opt.ut = args[++i];
  if (args[i] === '--offline') opt.offline = true;
}
if (!input) {
  console.error('Bruk: node konverter-liturgi.mjs <input.docx|pdf> [--navn X] [--type T] [--maalform M] [-o ut.limal] [--offline]');
  process.exit(1);
}

// ---------- hent siste konverter-logikk fra kilden ----------
fs.mkdirSync(CACHE, { recursive: true });
const cacheSti = path.join(CACHE, 'konverter.cjs');
const fallbackSti = path.join(her, 'fallback', 'konverter.cjs');

let kodeSti = null;
if (!opt.offline) {
  try {
    execFileSync('curl', ['-fsSL', '--max-time', '20', RAW + '?v=' + Date.now(), '-o', cacheSti], { stdio: 'pipe' });
    execFileSync('node', ['--check', cacheSti], { stdio: 'pipe' });
    kodeSti = cacheSti;
  } catch {
    // ingen nett / feil i siste versjon — fallback under
  }
}
if (!kodeSti && fs.existsSync(cacheSti)) {
  try { execFileSync('node', ['--check', cacheSti], { stdio: 'pipe' }); kodeSti = cacheSti; } catch {}
}
if (!kodeSti && fs.existsSync(fallbackSti)) {
  kodeSti = fallbackSti;
  console.error('NB: bruker innebygd fallback-kopi (kunne ikke hente siste versjon fra liturgi-app).');
}
if (!kodeSti) {
  console.error('Fant verken hurtiglager, fallback eller nett — kan ikke konvertere.');
  process.exit(2);
}

const { konverterLiturgi } = require(kodeSti);

// ---------- konverter ----------
const ext = path.extname(input).toLowerCase();
if (ext !== '.docx' && ext !== '.pdf') {
  console.error('Ustøttet filtype: ' + ext + ' (bruk .docx eller .pdf)');
  process.exit(1);
}
const { mal, advarsler } = konverterLiturgi(input, { navn: opt.navn, type: opt.type, maalform: opt.maalform });

const safeNavn = (n) => n.replace(/[\\/:*?"<>|]+/g, '').trim() || 'mal';
const ut = opt.ut ?? path.join(os.homedir(), 'Downloads', safeNavn(mal.name) + '.limal');
fs.mkdirSync(path.dirname(ut), { recursive: true });
fs.writeFileSync(ut, JSON.stringify({ liturgiFormat: 1, kind: 'template', data: mal }, null, '\t'));

const antLedd = mal.sections.reduce((n, s) => n + s.items.length, 0);
console.log('Konvertert: ' + mal.sections.length + ' hoveddeler, ' + antLedd + ' ledd');
console.log('Skrevet: ' + ut);
console.log('Les formatspesifikasjonen (' + path.join(CACHE, 'limal-format.md') + ' — hentes med scripts/hent-siste.sh) og finpuss roller/variant-grupper før malen regles ferdig.');
