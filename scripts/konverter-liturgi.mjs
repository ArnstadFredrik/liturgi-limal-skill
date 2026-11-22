#!/usr/bin/env node
/**
 * konverter-liturgi.mjs — offline konvertering docx/pdf → .limal
 *
 * Bruk:
 *   node konverter-liturgi.mjs <input.docx|input.pdf> [--navn "Navn"] \
 *        [--type gudstjeneste|vigsel|gravferd] [--maalform bokmål] [-o ut.limal]
 *
 * Krever (macOS): unzip (docx), pdftotext (pdf). Ingen node-avhengigheter.
 *
 * Heuristikken er beskrevet i docs/limal-format.md i liturgi-app-repoet
 * (oppdateres der — denne filen leser ikke formatet dynamisk).
 * Resultatet skal alltid kontrolleres/finpusses i appen etter konvertering.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------- argumenter ----------
const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--navn') opt.navn = args[++i];
  if (args[i] === '--type') opt.type = args[++i];
  if (args[i] === '--maalform') opt.maalform = args[++i];
  if (args[i] === '-o') opt.ut = args[++i];
}
if (!input) {
  console.error('Bruk: node konverter-liturgi.mjs <input.docx|input.pdf> [--navn X] [--type T] [--maalform M] [-o ut.limal]');
  process.exit(1);
}
const ext = path.extname(input).toLowerCase();

// ---------- hjelpere ----------
let idTeller = 0;
const uid = (prefiks = 'i') => prefiks + '-' + Date.now().toString(36) + '-' + (idTeller++);
const trim = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const DEKOD = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
const dekodXml = (s) => s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => DEKOD[m] ?? m);

/**滚 rubrikk? */
const erRubrikkTekst = (t) => /^(ved |her |her, |eller$|evt\.|ev\.|jfr\.|jf\.|klokke|før|etter|under|mens|om\b)/i.test(t) && t.length < 160;
/** bibelreferanse? («Joh 3,16», «Mark 10,13–16», «1 Pet 1,3», «Rom 6,3-8») */
const erBibelref = (t) => /^(BIBELREF\s*\|\s*)?(\d?\s?)?[A-ZÆØÅ][a-zæøå]+\.?\s\d+(\s?[,;–-]\s?\d+)*([a-z])?(\s*[.,])?$/.test(trim(t));
/** rolleprefiks? («L | tekst», «ML/L | …») */
const rolleRe = /^([A-Z]{1,4}(?:\/[A-Z]{1,4})*)\s*\|\s?/;
/** hoveddel-tittel? («I. Samling», «1 Mottakelse til dåp», ROMERTALL/VERSAL-titler) */
const erHoveddelTittel = (t) => /^(?:[IVXLC]+\.\s+\S|[0-9]+\s{1,2}\S)/.test(t)
  || (t === t.toUpperCase() && t.length >= 3 && /[A-ZÆØÅ]/.test(t) && t.split(/\s+/).length <= 6);
/** leddtittel? («2 Hilsen», «3. Takkebønn», «* 5 Forsakelsen …») */
const erLeddTittel = (t) => /^\*?\s?\d+\.?\s+\S/.test(t) && t.length < 80;

// ---------- docx-parsing (unzip + XML) ----------
function lesDocx(fil) {
  const xml = execFileSync('unzip', ['-p', fil, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  // avsnitt
  const avsnitt = [];
  const pRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = pRe.exec(xml)) !== null) {
    const p = m[0];
    const stil = (p.match(/<w:pStyle w:val="([^"]+)"/) ?? [])[1] ?? '';
    // tabellceller og slikt er allerede egne <w:p> — ok
    const runs = [];
    const rRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let rm;
    while ((rm = rRe.exec(p)) !== null) {
      const r = rm[1];
      const tekst = (r.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, '')).join('');
      if (!tekst) continue;
      const bold = /<w:b\/>|<w:b /.test(r) && !/<w:b w:val="0"/.test(r);
      const italic = /<w:i\/>|<w:i /.test(r) && !/<w:i w:val="0"/.test(r);
      const farge = (r.match(/<w:color w:val="([0-9A-Fa-f]{6})"/) ?? [])[1] ?? null;
      runs.push({ tekst: dekodXml(tekst), bold, italic, farge });
    }
    if (!runs.length && !/<w:pStyle/.test(p)) continue;
    avsnitt.push({ stil, runs, tekst: trim(runs.map((r) => r.tekst).join('')) });
  }
  return avsnitt;
}

// ---------- pdf-parsing (pdftotext) ----------
// Førstevalg: pdftotext (poppler). Fallback: macOS PDFKit via JXA (osascript) —
// følger med operativsystemet, ingen ekstra installasjon.
const PDFKIT_JXA = 'ObjC.import("PDFKit"); function run(argv){ const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0])); if (doc.isNil()) return ""; const n = doc.pageCount; let ut = []; for (let i=0;i<n;i++){ const s = doc.pageAtIndex(i).string; ut.push(s ? ObjC.unwrap(s) : ""); } return ut.join("\\n"); }';

function lesPdf(fil) {
  let txt = null;
  try {
    txt = execFileSync('pdftotext', ['-layout', fil, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    txt = execFileSync('osascript', ['-l', 'JavaScript', '-e', PDFKIT_JXA, fil], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  }
  return txt.split('\n').map((l) => ({ stil: '', runs: [{ tekst: l, bold: false, italic: false, farge: null }], tekst: trim(l) }))
    .filter((p) => p.tekst.length > 0);
}

// ---------- heuristisk strukturbygging ----------
function byggStruktur(avsnitt) {
  const seksjoner = [];
  let sec = null;
  let item = null;

  const nySeksjon = (tittel) => {
    if (process.env.KONV_DEBUG) console.error('  => NYSEKSJON: ' + tittel);
    sec = { title: trim(tittel), items: [] };
    seksjoner.push(sec);
    item = null;
  };
  const nyttLedd = (heading, type = 'tekst') => {
    if (process.env.KONV_DEBUG) console.error('  => NYTLEDD: ' + heading);
    if (!sec) nySeksjon('Uten tittel');
    item = { id: uid(), type, heading: heading ?? '', instr: '', text: '', alts: [], selAlt: 0, enabled: true, optional: false, salmeNr: '', salmeTittel: '' };
    sec.items.push(item);
  };

  for (const p of avsnitt) {
    const t = p.tekst;
    if (!t) continue;
    const stil = (p.stil || '').toLowerCase().replace(/\s+/g, '');
    const forste = p.runs[0] ?? { bold: false, italic: false, farge: null };
    const erRubrikkStil = stil === 'rubrikk' || (forste.italic && !forste.bold) || erRubrikkTekst(t);
    if (process.env.KONV_DEBUG) console.error('[' + stil + '] ' + t.slice(0, 45) + '  =>  ' + (erRubrikkStil ? 'RUBRIKK' : 'annet'));

    // bibelreferanse → legg på forrige ledd (før heading-sjekkene —
    // «1 Pet 1,3» starter med siffer og ville ellers blitt en tittel)
    if (erBibelref(t)) {
      const ref = trim(t.replace(/^BIBELREF\s*\|\s*/i, ''));
      if (item) item.text += '\nBIBELREF | ' + ref;
      continue;
    }
    // hoveddel?
    if (stil === 'heading1' || stil === 'heading 1' || stil === 'overskrift1' || stil === 'tittel1' || stil === 'tittel 1' || erHoveddelTittel(t)) {
      // nummererte overskrifter («1 | Mottakelse …») = leddtittler; tittel
      // uten nummer = ny hoveddel
      if (/^\*?\s?\d+/.test(t) && sec) {
        nyttLedd(t.replace(/\s*\|\s*/g, ' ').replace(/^\*?\s?/, ''));
        continue;
      }
      nySeksjon(t.replace(/\s*\|\s*/g, ' '));
      continue;
    }
    // leddtittel?
    if (stil === 'heading2' || stil === 'heading 2' || stil === 'heading3' || stil === 'heading 3' || stil === 'overskrift2' || stil === 'overskrift3' || erLeddTittel(t)) {
      nyttLedd(t.replace(/\s*\|\s*/g, ' ').replace(/^\*?\s?/, ''));
      continue;
    }
    // rubrikk → instr
    if (erRubrikkStil) {
      const linje = '@NOTAT ' + t;
      if (item) {
        item.instr = item.instr ? item.instr + '\n' + linje : linje;
      } else {
        nyttLedd('Rubrikk', 'instruks');
        item.instr = linje;
      }
      continue;
    }
    // salmer («Nr. 504», «504 Vi er barn …»)
    const salme = t.match(/^(?:Nr\.?\s*)?(\d{1,4})\s+([A-ZÆØÅ].{2,60})$/);
    if (salme && !rolleRe.test(t)) {
      nyttLedd('', 'salme');
      item.salmeNr = salme[1];
      item.salmeTittel = salme[2];
      continue;
    }
    // vanlig tekst (ev. rolleprefiks)
    if (!item) nyttLedd('');
    const rm = t.match(rolleRe);
    if (rm && !item.text) {
      item.text += '{{r}}' + rm[1] + ' |{{/r}} ' + t.slice(rm[0].length);
    } else if (rm && item.text) {
      item.text += '\n{{r}}' + rm[1] + ' |{{/r}} ' + t.slice(rm[0].length);
    } else {
      item.text += (item.text ? '\n' : '') + t;
    }
  }
  // rydd: tomme seksjoner/items
  return seksjoner.filter((s) => s.items.length || /samling|ordet|nattverd|sendelse|velsign/i.test(s.title));
}

// ---------- valgfri variant-gruppering («Eller»-rubrikker blir alts) ----------
// NB: enkel heuristikk — «Eller»-rubrikk rett etter et tekstledd starter et
// nytt alternativ av forrige ledd. Finpusses av LLM/app etterpå.
function grupperEller(seksjoner) {
  for (const sec of seksjoner) {
    const items = sec.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.instr && /^@NOTAT Eller\b/im.test(it.instr) && i > 0) {
        const forrige = items[i - 1];
        if (forrige && forrige.type === 'tekst' && it.text) {
          forrige.alts.push({ label: trim(it.heading) || 'Alternativ', text: it.text });
          items.splice(i, 1);
          i--;
        }
      }
    }
  }
}

// ---------- hovedflyt ----------
const avsnitt = ext === '.docx' ? lesDocx(input) : ext === '.pdf' ? lesPdf(input) : (() => { console.error('Ustøttet filtype: ' + ext); process.exit(1); })();
const seksjoner = byggStruktur(avsnitt);
// grupperEller(seksjoner); // slå av: «Eller»-varianter får være egne ledd (slås sammen i appen/LLM)

const navn = opt.navn ?? path.basename(input, path.extname(input));
const mal = {
  id: navn.toLowerCase().replace(/[^a-z0-9æøåÆØÅ]+/g, '-').replace(/^-|-$/g, '') || uid('mal'),
  name: navn,
  malForm: opt.maalform ?? 'bokmål',
  liturgiType: opt.type ?? (/vigsel/i.test(navn) ? 'vigsel' : /gravferd|bisettelse/i.test(navn) ? 'gravferd' : 'gudstjeneste'),
  kanGudstjeneste: true,
  sections: seksjoner,
  visInstr: true,
  visRoles: true,
  visSalmeinfo: true
};

const ut = opt.ut ?? path.join(os.homedir(), 'Downloads', safeNavn(navn) + '.limal');
function safeNavn(n) { return n.replace(/[\\/:*?"<>|]+/g, '').trim() || 'mal'; }
fs.mkdirSync(path.dirname(ut), { recursive: true });
fs.writeFileSync(ut, JSON.stringify({ liturgiFormat: 1, kind: 'template', data: mal }, null, '\t'));

const antLedd = seksjoner.reduce((n, s) => n + s.items.length, 0);
console.log('Konvertert: ' + seksjoner.length + ' hoveddeler, ' + antLedd + ' ledd');
console.log('Skrevet: ' + ut);
console.log('Kontroller resultatet i appen (Bibliotek → Maler → importer) og finpuss roller/variant-grupper.');
