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

### Språkspesifikke mønstre (lærdom fra nynorsk-importen)

- **Nynorsk «anten/eller» = bokmål «enten/eller»** — heading som starter med
  `enten`/`anten`/`eller` er en variant av forrige ledd. `grupperEllerLedd` i
  konverteren håndterer dette; kontroller at variantene ble gruppert som
  `alts[]` (labels A/B/C…) og ikke ligger igjen som egne ledd.
- **Seksjonstitler** skal speile originalenes mønster: `I. Samling`,
  `II. Ordet`, `III. Nattverd`, `IV. Sendelse`. Kilde-dokumenter kan ha dem
  uten nummerering («Samling», «sending») — normaliser manuelt.
- **Tittelside**: en første seksjon uten tittel med ≤1 ledd er dokumentets
  egen tittelside og skal bort (konverteren fjerner den automatisk).
- **Dåp i hovedgudtjenesten**: hovedmalen har en lenket Dåp-seksjon
  (`__lenket: { malId: …, tittel: … }`, tom `items`). På nynorsk lenkes den
  til nynorsk-dåp-malen — husk å opprette den først.
- **Hovedgudtjenesten bm 2020 som målestokk**: originalen har 27 nummererte
  ledd (1 Forberedelse … 27 Postludium), lenket Dåp-seksjon og kuraterte
  intro/avsl/alt-labels. Konverteringen mister fortsatt noen slike
  strukturtledd (de ender i forrige ledds tekst) — kontroller at ALLE
  nummererte ledd («4 Samlingsbønn», «9 Første lesning», «13 Preken» …)
  finnes som egne ledd med riktig nummerering, og gjenopprett de som mangler.
- **Vigsel- og gravferdsmalene er annerledes bygget enn hovedgudtjenesten**:
  vigsel bruker én seksjon per nummerert ledd (1 Preludium … 13 Utgang) og har
  en egen skriftlesningskatalog-seksjon (som `skriftlesningKilde` peker på);
  gravferd har skriftlesningstekstgrupper (I, II, …) som egne ledd. Del/valider
  seksjonene mot dette — konverteren lager store seksjoner fra docx-headingene.
- **Seksjonstitler fra docx-headinger kan være rotete** («ORDNING FOR»,
  «ELLER», versaler som «JORDPÅKASTELSE») — rydd dem og bruk nummerert
  mønster der det passer.
- **Enten A / Eller B-par** i gravferd/vigsel hører til det nø ummererte leddet
  de følger — `grupperEllerLedd` grupper dem nå inn der (unntaket for
  nummererte baser gjelder bare den bare «Eller»-formen).
- **Alts-labels**: konverteren bruker A/B/C… — originalene bruker
  beskrivende labels (f.eks. «Nåde være med dere og fred», «Allmenn serie 1,
  2, fest- og fasteserien»). Beskrivende labels må settes manuelt i dev.
- **WIP/utkast-status bor i malen** (`wip: true`) — ingen db-nøkkel. Originalmaler
  med wip bekreftes i Malverktøy (dev) og skjules fra biblioteket; brukermaler
  med wip omtales som «utkast» og bekreftes i bibliotekets mal-liste.
- **Innledning/avslutning på alternativgrupper**: deler alle alternativene
  første- og/eller sistelinje («La oss be.» / «Amen.»), løfter
  `trekkUtIntroAvslutning` dem ut som `introAlts`/`avslutningAlts`. Står den
  felles innledningen som EGET ledd før variantene (vanlig i kildedokumenter),
  må den flyttes inn som `introAlts` manuelt i dev.
- Nynorsk er en egen målform: skrivemåten i innledninger/avslutninger avviker
  fra bokmålet — ikke kopier bokmålstekster, kontroller mot nynorsk-kilden.

## Steg 4 — valider i appen

Åpne `.limal`-filen (Bibliotek → Maler → importer, eller kopier til
`~/.config/Liturgi/maler/brukermaler/`) og sjekk rendering i
redigeringsfanen før du rapporterer ferdig. Ikke overskriv brukerens
eksisterende maler uten å spørre.

## Nyttige stier

- Hurtiglager (siste format + script): `~/.cache/liturgi-limal/`
- Kilden: `github.com/ArnstadFredrik/liturgi-app`
  (`docs/limal-format.md` + `electron/konverter.cjs`)
- **Referansemaler / seed-maler**: etter `hent-siste.sh` ligger appens
  seed-maler i `~/.cache/liturgi-limal/seeds/` (alle originalmaler som
  `.limal`, hentet fra liturgi-app-repoet). Bruk dem som struktur-/format-
  referanse når du skal finpusse en konvertert mal — også på maskiner uten
  appen installert. **Les dem aldri fra `~/.config/Liturgi/maler/originaler/`
  som eneste kilde** (finnes bare lokalt, og skal kun leses).
  Rediger ALDRI filer i `originaler/` — de er generert fra seed-malene i
  liturgi-app-repoet og blir verifisert/regenerert mot seed ved oppstart;
  endringer du gjør her blir uansett overskrevet. Skal du redigere en mal,
  kopier den til `brukermaler/` (eller egen sti) først.**
- Maler-import i appen: Bibliotek → Maler → importer (eller kopier fil til
  `~/.config/Liturgi/maler/brukermaler/`)
- Synk av repo-kopier (ved vedlikehold av skill-repoet):
  `scripts/sync-format.sh` + `scripts/sync-konverter.sh`
