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
- **Enten A / Eller B-par** i gravferd/vigsel hører til det nummererte leddet
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


### Dokumentasjonsgap fra konverteringstestene (runde 1, 2026-11-22)

Les dette før du konverterer — det dekker hullene test-agentene rapporterte:

- **Rolle-vokabular i ressursbank-dokumentene**: `L` (liturg), `ML` (medliturg),
  `M` (menighet), `A` (assisterende/prest), `P` (prest), `I`/`II` (lesere/kor),
  `B` (brudgom), samt fulle navn (`Brudgommen:`, `Bruden:`,
  `Klokker / gjestende prest:`). Rollelinje = `ROLLE | tekst`, `ROLLE: tekst`
  eller `ROLLE  tekst` (dobbel mellomrom). **Enbokstav-ord + mellomrom +
  små forbokstav («Å leve sammen …») er setningsstart, ikke rolle.**
- **Innledning/alternativer/avslutning**: tekst som gjelder ALLE varianter →
  `introAlts` (rendres før leddteksten); tekst som varierer mellom variantene
  → `alts[]` (erstatter leddteksten); tekst som følger alle varianter →
  `avslutningAlts` (rendres etter). Felles «La oss be.», erklæringer og
  Fadervår hører typisk i intro-/avslutning-alts.
- **Valgfrie ledd** markeres `* ` før headingen. Hovedgudtjenesten bm 2020 har
  10 valgfrie ledd: 2, 3, 12, 14, 21, 22, 24, 25, 26, 27. **Vigsel-malene har
  ingen valgfrie ledd — ikke oppfinn dem der.**
- **Vigsel-strukturen i detalj** (2003 og 2017): seksjoner = Bestemmelser (én
  instr-item med hele bestemmelsesteksten), deretter én seksjon per nummerert
  ledd med item.heading identisk til seksjonstittelen: 1 Preludium/Inngang,
  2 Inngangsord, 3 Salme, 4 Skriftlesning, 5 Salme, 6 Tale,
  7 Ekteskapsinngåelse, 8 Overrekkelse av ringer, 9 Forbønn,
  10 Musikk/symbolhandlinger (2017: Musikk/symbolfortellinger), 11 Salme,
  12 Velsignelse, 13 Utgang. Tallene står IKKE i docx-headingsene — hent dem
  fra kryssreferanser i brødteksten. Katalog-seksjonen bakerst heter
  «Skriftlesninger ved Vigsels- og forbønnsliturgi (2003/2017)»: første item
  har tittelen + rollelinje «La oss videre høre fra Guds ord.» + instr med
  utvalgsreglene; deretter étt item per lesning med bibelreferansen som
  heading, teksten i `text` (`BIBELREF | <ref>` som SISTE linje) og
  `bokstav`-feltet satt («A», «B», «C» …). Sett
  `data.skriftlesningKilde = <katalog-seksjonens tittel>` (feltet peker på en
  SEKSJONSTITTEL i samme mal).
- **Gravferdsstrukturen i detalj** (2003): seksjoner med
  `delGruppe: "ved graven"` / `"i krematorium"` (+ `delGrupper`-katalogen på
  mal-data). Skriftlesningstekstgrupper (I, II, III, «Ved barns gravferd») som
  egne ledd i en «Skriftlesninger»-seksjon, hver med alts[] per tekst (label =
  tema eller bibelref).
- **Wingdings-korset** (U+F058 i docx-runs) konverteres automatisk til ✝.
- **Sidereferanser i kilden** («(se s 11 i dokumentet)») omskrives til
  seksjonsnavn («(se seksjonen Skriftlesninger)»).
- **Tapte hyperlenker** («finner du her») beholdes med
  `@NOTAT … (lenke i kildedokumentet)` og flagges i rapporten.
- **Seed-maler er FORMAT-referanse**: åpne aldri seedet for SAMME liturgi du
  konverterer (det forringer testen) — bruk en annen liturgi som strukturmal.
- **Validering uten appen**: kjør
  `node <skill-katalog>/scripts/valider.mjs <fil>.limal` — sjekker JSON,
  påkrevde felt, unike id-er, rollemerke-balanse, `BIBELREF` sist i text,
  `liturgiFormat: 1` og kind=template. App-validering (steg 4) skjer når
  malen importeres av brukeren — oppgi i rapporten at steg 4 ikke er kjørt.

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
