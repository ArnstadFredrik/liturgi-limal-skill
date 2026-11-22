---
name: limal-konvertering
description: Konverter gudstjenesteliturgi fra docx/pdf til .limal (Liturgi-appen). Bruk når brukeren leverer en docx/pdf-liturgi som skal bli en mal i liturgi-appen.
---

# Konvertering av liturgier til .limal

Konverterer Word/PDF-liturgier til `.limal`-maler for liturgi-appen.
**liturgi-app-repoet er kilden til sannheten** for både formatet og
konverter-logikken — skillen henter alltid siste versjon fra GitHub
ved kjøretid, så aldri stol på lokale kopier.

## Steg 1 — hent siste format og script (ALLTID først)

```bash
bash <skill-mappe>/scripts/hent-siste.sh
```

Henter siste utgave til hurtiglageret:

- `~/.cache/liturgi-limal/limal-format.md` — **les denne med `read_file`**
  før konverteringen (kan ha endret seg siden sist)
- `~/.cache/liturgi-limal/konverter.cjs` — konverter-logikken CLI-en kjører

Uten nett faller CLI-en tilbake til en innebygd fallback-kopi
(`scripts/fallback/konverter.cjs`) — da er det ekstra viktig å nevne
til brukeren at konverteringen kan være gjort med eldre logikk.

## Steg 2 — kjør CLI-en for et første utkast

```bash
node <skill-mappe>/scripts/konverter-liturgi.mjs \
     <input.docx|pdf> --navn "Malens navn" \
     [--type gudstjeneste|vigsel|gravferd] [--maalform bokmål] \
     -o ~/Downloads/navn.limal
```

CLI-en henter selv siste konverter-logikk fra liturgi-app-repoet før den
kjører (avslå med `--offline`). Skriptet er heuristisk (uten LLM):
hoveddeler fra overskrifts-stiler/nummerering/versaler, `@NOTAT` fra
rubrikker, `BIBELREF |` fra referanselinjer (også klebet på linjeslutt),
`{{r}}ROLLE |{{/r}}` fra rolleprefiks (med og uten `|`), salmer fra
`N13 <nr> Tittel`-linjer, sidetall strippes, `T/M/O`-/`©`-copyright som
`@COPYRIGHT`. Kjente svakheter: sangvers uten N13-markør kan bli egne
titler, «Eller»-variantgruppering må gjøres manuelt.

## Steg 3 — LLM-gjennomgang (dette er din jobb)

Les skriptets utdata mot kildedokumentet og rett:

- Roller: `{{r}}L |{{/r}}`, `{{r}}ML/L |{{/r}}` … — sjekk hver linje.
- Variant-gruppering: tekster skilt med «Eller»-rubrikker skal bli
  `alts[]` på samme ledd (label = gjerne bibelreferansen).
- `BIBELREF | <ref>` sist i `text` for bibeltekster.
- `@NOTAT …` for instruksjoner/rubrikker, `@COPYRIGHT | …` for salmeinfo.
- Leddtitler: `* ` prefiks på valgfrie ledd; behold nummerering.
- Sangvers som ble egne titler: slå sammen til ett salmeledd.
- `malForm` og `liturgiType` (`gudstjeneste`/`vigsel`/`gravferd`).

## Steg 4 — valider i appen

Åpne `.limal`-filen (Bibliotek → Maler → importer, eller kopier til
`~/.config/Liturgi/maler/brukermaler/`) og sjekk rendering i
redigeringsfanen før du rapporterer ferdig. Ikke overskriv brukerens
eksisterende maler uten å spørre.

## Nyttige stier

- Hurtiglager (siste format + script): `~/.cache/liturgi-limal/`
- Kilden: `github.com/ArnstadFredrik/liturgi-app`
  (`docs/limal-format.md` + `electron/konverter.cjs`)
- **Referansemaler: `~/.config/Liturgi/maler/originaler/` — SKAL KUN LESES.
  Rediger ALDRI filer her. De er generert fra seed-malene i
  liturgi-app-repoet og blir verifisert/regenerert mot seed ved oppstart;
  endringer du gjør her blir uansett overskrevet. Skal du redigere en mal,
  kopier den til `brukermaler/` (eller egen sti) først.**
- Maler-import i appen: Bibliotek → Maler → importer (eller kopier fil til
  `~/.config/Liturgi/maler/brukermaler/`)
- Synk av repo-kopier (ved vedlikehold av skill-repoet):
  `scripts/sync-format.sh` + `scripts/sync-konverter.sh`
