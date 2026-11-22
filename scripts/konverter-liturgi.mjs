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
const erRubrikkTekst = (t) => /^(ved |her |her, |eller$|evt\.|ev\.|jfr\.|jf\.|før[,.\s]|etter |under |mens |om\b|\()/i.test(t) && t.length < 160;
const erBibelref = (t) => /^(BIBELREF\s*\|\s*)?(\d?\s?)?[A-ZÆØÅ][a-zæøå]+\.?\s\d+(\s?[,;–-]\s?\d+)*([a-z])?(\s*[.,])?$/.test(trim(t));
const rolleRe = /^([A-Z]{1,4}(?:\/[A-Z]{1,4})*)\s*\|\s?/;
const erLeddTittel = (t) => /^\*?\s?\d+\.\s+\S/.test(t) && t.length < 80;

/** Sidetall fra pdf-eksport («1/ 16», «13 /16»). */
const erSidetall = (t) => /^\d+\s*\/\s*\d+$/.test(t);

/** Opphavsrett: «T 1973 Britt…», «M ©…», «O Tilbokmål1974…», «© Norsk Musikforlag…». */
const erCopyright = (t) => t.startsWith('©')
  || (/^[TMO]\s/.test(t) && /\d{4}|©/.test(t));

/** Salmemerke: «N13   591   Det skjer et under … v.1-3» eller «(N13  638) …». */
function salmeFraLinje(t) {
  let m = t.match(/^N\d{1,2}\s+(\d{1,4})\s+(.+)$/);
  if (m) return { nr: m[1], tittel: m[2] };
  m = t.match(/^(.*?)\s*\(N\d{1,2}\s+(\d{1,4})\)\s*(.*)$/);
  if (m) return { nr: m[2], tittel: trim(trim(m[1] + ' ' + m[3])) || m[1] };
  return null;
}

/** Hoveddel i versaler: «I.SAMLING», «I. SAMLING», «II. ORDET», «DÅP». */
const erVersalHoveddel = (t) => {
  const s = trim(t);
  if (s.length < 2 || s.length > 40) return false;
  if (s !== s.toUpperCase()) return false;
  return /^[IVXLC]+\.\s*[A-ZÆØÅ]/.test(s) || /^[IVXLC]{2,}\s+[A-ZÆØÅ]/.test(s) || /^[A-ZÆØÅ]+$/.test(s);
};
const normaliserVersalHoveddel = (t) =>
  trim(t).replace(/^([IVXLC]+)\.\s*(?=[A-ZÆØÅ])/, '$1. ');

/** Rolle uten/med skille: «L | …», «L  …», «ML/L: …», «Prest:», «Prest   …»,
 *  «Klokker / dåpsfølge  …». «Alle synger» er ikke en rolle. */
const ROLLEORD = new Set(['Alle', 'Prest', 'Liturg', 'Klokker', 'Medliturg', 'Menighet', 'Organist', 'Kirketjener', 'Dåpsfølge', 'Kor', 'Korett']);
function finnRolle(t) {
  const m = t.match(/^([A-ZÆØÅ][A-Za-zæøå]*(?:\s*\/\s*[A-Za-zæøå]+)*)(\s*[|:]|\s+)\s*(.*)$/);
  if (!m) return null;
  const ord = m[1].replace(/\s+/g, '');
  const skille = m[2].trim();
  const rest = m[3] ?? '';
  const erBokstaver = /^[A-ZÆØÅ]{1,4}(\/[A-ZÆØÅ]{1,4})*$/.test(ord);
  // flerdels-roller («Klokker/dåpsfølge») — alle deler må være rolleord
  const erOrdr = ord.split('/').every((d) => ROLLEORD.has(d) || [...ROLLEORD].some((r) => r.toLowerCase() === d.toLowerCase()));
  if (ord === 'I') return null; // «I dåpen …», «I Faderens navn» — ikke rolle
  if (!erBokstaver && !erOrdr) return null;
  if (ord === 'Alle' && /^synger\b/i.test(rest)) return null;
  // ordrroller krever kolon/strek, minst dobbelt mellomrom («Prest   …»,
  // «Klokker  …») eller enkeltmellomrom + stor forbokstav («Prest Ære være …»);
  // enbokstavsroller («L …», «A …») aksepteres med ett mellomrom
  if (!erBokstaver && !/[|:]/.test(skille) && m[2].length < 2 && !/^[A-ZÆØÅ]/.test(rest)) return null;
  return { rolle: ord, rest };
}

/** Bibelreferanse klebet på slutten av en tekstlinje («… liv.Joh3,16»). */
function refPaaSlutt(t) {
  const m = t.match(/([\s.»])([1-3]?\s?[A-ZÆØÅ][a-zæøå]+\.?\s*\d+(?:\s?[,;–-]\s?\d+)*[a-z]?)$/);
  if (!m) return null;
  const ref = trim(m[2]).replace(/^([1-3]?)\s*([A-ZÆØÅ][a-zæøå]+)\.?\s*(\d)/, (a, kap, bok, siffer) => (kap ? kap + ' ' : '') + bok + ' ' + siffer);
  return { foran: trim(t.slice(0, m.index + 1)), ref };
}

/** Leddtittel i ren tekst: kort linje uten avsluttende tegn. Siffer-start
 *  (salmevers «1 Måne og sol …») og refs er aldri titler. */
const erTittelLinje = (t) => t.length >= 2 && t.length <= 60
  && !/^\d/.test(t)
  && !/^(BIBELREF|[a-zæøå]{2,}\.?\s?\d+(?:[,–-]\d+)*)$/i.test(t)
  && !/[.,:;!?»)]$/.test(t);

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
function byggStruktur(avsnitt, advarsler) {
  const seksjoner = [];
  let sec = null;
  let item = null;
  let forrigeTekst = ''; // forrige ikke-tomme linje (for tittprediksjon)
  let forrigeVarTittel = false;
  let settHoveddel = false;

  const nySeksjon = (tittel) => {
    sec = { title: trim(tittel), items: [] };
    seksjoner.push(sec);
    item = null;
    settHoveddel = true;
  };
  const nyttLedd = (heading, type = 'tekst') => {
    if (!sec) nySeksjon('Uten tittel');
    item = { id: uid(), type, heading: heading ?? '', instr: '', text: '', alts: [], selAlt: 0, enabled: true, optional: false, salmeNr: '', salmeTittel: '' };
    sec.items.push(item);
  };
  const leggTilTekst = (linje) => {
    if (!item) nyttLedd('');
    item.text += (item.text ? '\n' : '') + linje;
  };

  for (const p of avsnitt) {
    const t = p.tekst;
    if (!t) { forrigeTekst = ''; continue; }
    const stil = p.stil || '';
    const forste = p.runs[0] ?? { bold: false, italic: false };
    const erRubrikkStil = stil === 'rubrikk' || stil === 'rubrikk1' || (forste.italic && !forste.bold);
    const rubrikk = erRubrikkStil || erRubrikkTekst(t) || /^\(/.test(t);

    // 1) toppmetadata før første hoveddel («Sted: …», «Dåp: Ja», «Gudstjeneste - …»)
    const erStilHoveddel = stil === 'heading1' || stil === 'heading 1' || stil === 'overskrift1' || stil === 'tittel1' || stil === 'tittel 1';
    if (!settHoveddel && !erStilHoveddel && !erVersalHoveddel(t) && /^[A-ZÆØÅ][a-zæøå]+(?:\s+[a-zæøå]+)*\s*[:\-–]/.test(t)) { forrigeTekst = ''; continue; }

    // 2) sidetall («1/ 16») — hopp over
    if (erSidetall(t)) { forrigeTekst = ''; continue; }

    // 3) opphavsrett («T 1973 …», «M ©…», «© Norsk Musikforlag…») → @COPYRIGHT
    if (erCopyright(t)) {
      if (item) item.text += (item.text ? '\n' : '') + '@COPYRIGHT | ' + t;
      forrigeTekst = ''; continue;
    }

    // 4) salme («N13 591 Det skjer … v.1-3», «Velsignelsessang (N13 638) …»)
    const salme = salmeFraLinje(t);
    if (salme) {
      const tittel = trim((salme.tittel ?? '').replace(/\s*v\.?\s?\d+(\s*-\s*\d+)?\s*$/i, ''));
      nyttLedd('', 'salme');
      item.salmeNr = salme.nr;
      item.salmeTittel = tittel || salme.nr;
      forrigeTekst = ''; continue;
    }

    // 5) hoveddel: overskrifts-stiler (docx) eller versal-linjer (pdf)
    if (erStilHoveddel || erVersalHoveddel(t)) {
      // nummererte overskrifter («1 | Mottakelse …») = leddtittler; tittel
      // uten nummer = ny hoveddel
      if (/^\*?\s?\d+/.test(t) && sec && !erVersalHoveddel(t)) {
        nyttLedd(t.replace(/\s*\|\s*/g, ' ').replace(/^\*?\s?/, ''));
        forrigeTekst = ''; continue;
      }
      nySeksjon(erVersalHoveddel(t) && !erStilHoveddel ? normaliserVersalHoveddel(t) : t.replace(/\s*\|\s*/g, ' '));
      forrigeTekst = ''; continue;
    }

    // 6) leddtittel med nummer («2. Hilsen») eller heading-stiler
    if (stil === 'heading2' || stil === 'heading 2' || stil === 'heading3' || stil === 'heading 3' || stil === 'overskrift2' || stil === 'overskrift3' || erLeddTittel(t)) {
      nyttLedd(t.replace(/\s*\|\s*/g, ' ').replace(/^\*?\s?/, ''));
      forrigeTekst = ''; continue;
    }

    // 7) bibelreferanse som egen linje → sist i forrige ledd (før
    //    heading-sjekkene — «1 Pet 1,3»/«neh 9,19-21» starter ellers som tittel)
    const erRefLinje = erBibelref(t) || /^[a-zæøå]{2,}\.?\s?\d+(\s?[,;–-]\s?\d+)*$/.test(t);
    if (erRefLinje) {
      const ref = trim(t.replace(/^BIBELREF\s*\|\s*/i, ''));
      if (item) item.text += '\nBIBELREF | ' + ref;
      forrigeTekst = ''; continue;
    }

    // 8) rubrikker → instr
    if (rubrikk) {
      const linje = '@NOTAT ' + t;
      if (item) {
        item.instr = item.instr ? item.instr + '\n' + linje : linje;
      } else {
        nyttLedd('Rubrikk', 'instruks');
        item.instr = linje;
      }
      forrigeTekst = ''; continue;
    }

    // 9) rolle («L | …», «Prest:», «Klokker / dåpsfølge  …»)
    const rolle = finnRolle(t);
    if (rolle) {
      // etter en «naken» tittel: rollen hører til samme ledd
      if (!item || item.text || item.instr || item.type !== 'tekst') nyttLedd('');
      item.text += (item.text ? '\n' : '') + '{{r}}' + rolle.rolle + ' |{{/r}} ' + rolle.rest;
      forrigeTekst = t; // rollens tekstlinjer fortsetter — neste linje er ikke tittel
      continue;
    }

    // 10) leddtittel i ren tekst: kort linje uten avsluttende tegn, etter
    //     blank/punkt-slutt/annen tittel. «Omkved»/«Refreng» og vers i
    //     salmer er tekst. Ref klebt på tittelen («Evangelium: Matt 6,24-34»)
    //     flyttes ut som BIBELREF.
    const grense = !forrigeTekst || /[.!?»]$/.test(forrigeTekst) || /^Amen\.?$/.test(forrigeTekst) || forrigeVarTittel;
    const erOmkved = /^(omkved|refreng|amen)\.?$/i.test(t);
    if (!erOmkved && item?.type !== 'salme' && !rolleRe.test(t) && grense && erTittelLinje(t)) {
      const tRef = refPaaSlutt(t);
      const tittel = tRef?.foran ? tRef.foran.replace(/[:\s]+$/, '') : t.replace(/\s*\|\s*/g, ' ');
      nyttLedd(tittel);
      if (tRef?.foran && tRef.ref) item.text = 'BIBELREF | ' + tRef.ref;
      forrigeVarTittel = true;
      continue;
    }
    forrigeVarTittel = false;

    // 11) vanlig tekst — bibelref klebet på slutten flyttes ut som BIBELREF
    const ref = refPaaSlutt(t);
    if (ref && ref.foran) {
      leggTilTekst(ref.foran);
      leggTilTekst('BIBELREF | ' + ref.ref);
      forrigeTekst = ref.foran; // grense for neste tittel
    } else {
      leggTilTekst(t);
      forrigeTekst = t;
    }
  }

  // rydd: tomme seksjoner (behold titler som ser ut som struktur)
  const ut = seksjoner.filter((s) => s.items.length || /samling|ordet|nattverd|sendelse|velsign/i.test(s.title));
  if (!ut.length) advarsler.push('Fant ingen innhold å konvertere.');
  return ut;
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
