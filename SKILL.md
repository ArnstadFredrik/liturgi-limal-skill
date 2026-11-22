---
name: limal-konvertering
description: Konverter gudstjenesteliturgi fra docx/pdf til .limal (Liturgi-appen). Bruk når brukeren leverer en docx/pdf-liturgi som skal bli en mal i liturgi-appen.
---

# Konvertering av liturgier til .limal

Konverterer Word/PDF-liturgier til `.limal`-maler for liturgi-appen.

## Kilder til sannhet (les disse FØRST)

1. **Format og struktur**: `~/05 projects/liturgi-app/docs/limal-format.md`
   — hold alltid denne filen i liturgi-app-repoet oppdatert. Hent den med
   `read_file` før hver konvertering (den kan ha endret seg siden sist).
2. **Referansemaler**: `~/.config/Liturgi/maler/originaler/*.limal` —
   sammenlign med en eksisterende mal for tone, roller og struktur.

## Arbeidsflyt

1. **Les formatet**: `read_file` på `docs/limal-format.md` (over).
2. **Kjør det offline skriptet** for et første utkast:
   ```bash
   node ~/05\ projects/liturgi-limal-skill/scripts/konverter-liturgi.mjs \
        <input.docx|pdf> --navn "Malens navn" \
        [--type gudstjeneste|vigsel|gravferd] [--maalform bokmål] \
        -o ~/Downloads/navn.limal
   ```
   Skriptet er heuristisk (offline, uten LLM): hoveddeler fra
   overskrifts-stiler/nummerering, `@NOTAT` fra rubrikker, `BIBELREF |`
   fra referanselinjer, `{{r}}ROLLE |{{/r}}` fra rolleprefiks, salmer
   fra «Nr. X»-linjer. Dubletter av innhold og variant-gruppering
   («Eller»-rubrikker) er kjente svakheter.
3. **LLM-gjennomgang** (dette er din jobb): les skriptets utdata mot
   kildedokumentet og rett:
   - Roller: `{{r}}L |{{/r}}`, `{{r}}ML/L |{{/r}}` … — sjekk hver linje.
   - Variant-gruppering: tekster skilt med «Eller»-rubrikker skal bli
     `alts[]` på samme ledd (label = gjerne bibelreferansen).
   - `BIBELREF | <ref>` sist i `text` for bibeltekster.
   - `@NOTAT …` for instruksjoner/rubrikker, `@COPYRIGHT | …` for salmeinfo.
   - Leddtitler: `* ` prefiks på valgfrie ledd; behold nummerering.
   - `malForm` og `liturgiType` (`gudstjeneste`/`vigsel`/`gravferd`).
4. **Valider i appen**: Åpne `.limal`-filen (Bibliotek → Maler → importer,
   eller kopier til `~/.config/Liturgi/maler/brukermaler/`) og sjekk
   rendering i redigeringsfanen før du rapporterer ferdig.
5. **Ikke overskriv** brukerens eksisterende maler uten å spørre.

## Nyttige stier

- Offline skript: `scripts/konverter-liturgi.mjs` (dette repoet)
- Formatdok: `~/05 projects/liturgi-app/docs/limal-format.md`
- Referansemaler: `~/.config/Liturgi/maler/originaler/`
- Maler-import i appen: Bibliotek → Maler → importer (eller kopier fil til
  `~/.config/Liturgi/maler/brukermaler/`)
