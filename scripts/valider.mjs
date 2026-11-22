#!/usr/bin/env node
// Validerer en .limal-fil strukturelt — uten appen.
// Bruk: node valider.mjs <fil>.limal
import { readFileSync } from 'node:fs';

const fil = process.argv[2];
if (!fil) { console.error('Bruk: node valider.mjs <fil>.limal'); process.exit(2); }

const feil = [];
const advar = [];
let mal;
try {
  mal = JSON.parse(readFileSync(fil, 'utf8'));
} catch (e) {
  console.error('FEIL: ugyldig JSON —', e.message);
  process.exit(1);
}

if (mal.liturgiFormat !== 1) feil.push(`liturgiFormat mangler eller feil: ${mal.liturgiFormat}`);
if (mal.kind !== 'template') feil.push(`kind må være "template": ${mal.kind}`);
const data = mal.data ?? {};
if (!Array.isArray(data.sections)) feil.push('data.sections mangler');

const roler = new Set();
const ider = new Set();
let ledd = 0;
for (const sec of data.sections ?? []) {
  if (typeof sec.title !== 'string') advar.push(`seksjon uten tittel: ${JSON.stringify(sec).slice(0, 60)}`);
  for (const it of sec.items ?? []) {
    ledd++;
    if (!it.id) feil.push(`ledd uten id i «${sec.title}»`);
    else if (ider.has(it.id)) feil.push(`duplikat id: ${it.id}`);
    else ider.add(it.id);
    // alle tekstfelt: text + alts + introAlts + avslutningAlts
    const tekst = it.text ?? '';
    const felt = [tekst,
      ...(it.alts ?? []).map((a) => a.text ?? ''),
      ...(it.introAlts ?? []).map((a) => a.text ?? ''),
      ...(it.avslutningAlts ?? []).map((a) => a.text ?? '')];
    felt.forEach((t, fi) => {
      const navn = fi === 0 ? it.id : `${it.id}[felt ${fi}]`;
      // rollemerker {{r}} … {{/r}} må være balansert
      const apne = (t.match(/\{\{r\}\}/g) ?? []).length;
      const lukk = (t.match(/\{\{\/r\}\}/g) ?? []).length;
      if (apne !== lukk) feil.push(`ulebalanserte rollemerker i ${navn} (${apne}/${lukk})`);
      for (const m of t.matchAll(/\{\{r\}\}(.*?)\|/g)) roler.add(m[1].trim());
      // BIBELREF må være sist i feltet (meny-ledd med flere lesninger er unntak)
      const linjer = t.split('\n');
      const refIdx = linjer.findIndex((l) => l.startsWith('BIBELREF'));
      if (refIdx !== -1 && refIdx !== linjer.length - 1) {
        advar.push(`${navn}: BIBELREF er ikke sist i text (linje ${refIdx + 1} av ${linjer.length})`);
      }
    });
    // alts-struktur
    for (const a of it.alts ?? []) {
      if (!a.label) advar.push(`${it.id}: alternativ uten label`);
    }
    if (it.alts?.length && it.selAlt == null) advar.push(`${it.id}: alts uten selAlt`);
  }
}

console.log(`Fil: ${fil}`);
console.log(`Seksjoner: ${(data.sections ?? []).length} | ledd: ${ledd} | roller: ${[...roler].sort().join(', ') || '(ingen)'}`);
console.log(`malForm: ${data.malForm ?? '(mangler)'} | liturgiType: ${data.liturgiType ?? '(mangler)'}`);
for (const f of feil) console.log('  FEIL: ' + f);
for (const a of advar) console.log('  advarsel: ' + a);
console.log(feil.length ? `${feil.length} feil` : 'OK');
process.exit(feil.length ? 1 : 0);
