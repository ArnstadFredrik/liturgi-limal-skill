---
name: limal-konvertering
description: Konverter gudstjenesteliturgi fra docx/pdf til .limal (Liturgi-appen). Bruk når brukeren leverer en docx/pdf-liturgi som skal bli en mal i liturgi-appen.
---

# Konvertering av liturgier til .limal

Konverterer Word/PDF-liturgier til `.limal`-maler for liturgi-appen.
**liturgi-app-repoet er kilden til sannheten** for både formatet og
konverter-logikken — skillen henter alltid siste versjon fra GitHub
ved kjøretid, så aldri stol på lokale kopier.

> **Hovedregel (brukerens ordrede beslutning)**: når brukeren ber om å
> konvertere en mal, skal ALLTID hele skillen kjøres på clean install —
> CLI-utkast → LLM-gjennomgang (steg 3) → strukturkontroll mot kilden
> (steg 3b) → skriverfelle → headless validering (steg 4) → rapport med
> sammendrag. Script-only (CLI + validering uten LLM-gjennomgang) gjøres
> KUN når brukeren eksplisitt ber om det, eller når brukeren selv importerer
> via appens innebygde konverteringsmodal. Et script-utkast skal aldri
> importeres til appens originaler/brukermaler som om det var ferdig.

> **Målform i navn**: målformen skal IKKE stå i malens `name` («… (nynorsk)») —
> appen kategoriserer allerede på målform. Behold målformsmarkeringen i
> FILNAVNET på disk, men sett `name` uten suffiks.

## Steg 1 — hent siste format og script (ALLTID først)

```bash
bash <skill-mappe>/scripts/hent-siste.sh
```

Henter siste utgave til hurtiglageret:

- `~/.cache/liturgi-limal/limal-format.md` — **les denne med `read_file`**
  før konverteringen (kan ha endret seg siden sist)
- `~/.cache/liturgi-limal/konverter.cjs` — konverter-logikken CLI-en kjører
- `~/.cache/liturgi-limal/seeds/*.limal` — referansemaler fra app-repoet

Uten nett faller CLI-en tilbake til en innebygd fallback-kopi
(`scripts/fallback/konverter.cjs`) — da er det ekstra viktig å nevne
til brukeren at konverteringen kan være gjort med eldre logikk.

## Steg 2 — kjør CLI-en for et første utkast

```bash
node <skill-mappe>/scripts/konverter-liturgi.mjs \
     <input.docx|pdf> --navn "Malens navn" \
     [--type gudtjeneste|vigsel|gravferd] [--maalform bokmål] \
     -o ~/Downloads/navn.limal
```

CLI-en henter selv siste konverter-logikk fra liturgi-app-repoet før den
kjører (avslå med `--offline`) og kjører skriverfellen automatisk på
utdatafilen. Skriptet er heuristisk (uten LLM): hoveddeler fra
overskrifts-stiler/nummerering/versaler, `@NOTAT` fra rubrikker,
`BIBELREF |` fra referanselinjer (også klebet på linjeslutt),
`{{r}}ROLLE |{{/r}}` fra rolleprefiks (med og uten `|`, også `:` og
ingen egen avslutning — alt normaliseres til `|` i merket, med
rolle-instruksjonen INN i merket), salmer fra `N13 <nr> Tittel`-linjer,
sidetall strippes, `T/M/O`-/`©`-copyright som `@COPYRIGHT`. Nummererte
leddtittler i ren tekst («4 Samlingsbønn») og seriemønstre («Allmenn
serie 1», språkserier, anten/enten N + eller N) merges som alts-labels.
Kort innledningslinje som slutter på «:» løftes til introAlts.
Kjente svakheter: sangvers uten N13-markør kan bli egne titler,
katalog-seksjoner i vigsel knuses ofte (bygges manuelt i steg 3),
komplekse ledd (se steg 3) må splittes manuelt.

## Steg 3 — LLM-gjennomgang (dette er din jobb)

Les skriptets utdata mot kildedokumentet og rett. **Reglene i denne
seksjonen gjelder for ALLE maltyper** (gudtjeneste, vigsel, gravferd —
og nye typer) med mindre noe er eksplisitt merket som type-spesifikt.
Malformatering og logikk er i stor grad delt; type-spesifikke regler
ligger samlet i egen seksjon lengre ned.

### Generelle regler — format

- **Roller**: `{{r}}ROLLE |{{/r}}` — rollemerket inneholder rolletokenet
  og eventuell rolle-instruksjon, alt opp til røret: «L |» →
  `{{r}}L |{{/r}}`, «L seier |» → `{{r}}L seier |{{/r}}`, «L syng eller
  seier |» → `{{r}}L syng eller seier |{{/r}}`, «A eller L/ML |» →
  `{{r}}A eller L/ML |{{/r}}`, «L/ML seier |» → `{{r}}L/ML seier |{{/r}}`,
  «K reiser seg og syng |» → `{{r}}K reiser seg og syng |{{/r}}`.
  Parentes-formen «(L seier |)» beholder parentesene:
  `({{r}}L seier |{{/r}})`. Roller avslutter med «|» som hovedregel, men
  kan også avslutte med «:» eller (sjelden) ha ingen egen avslutning —
  alle normaliseres til `{{r}}ROLLE |{{/r}}` i malen. Roller SKAL
  formateres OGSÅ inne i alts/introAlts/avslutningAlts — ikke bare i
  leddets hovedtekst. Sjekk hver rollelinje.
- **BIBELREF | <ref>** sist i `text` for bibeltekster. UNNTAK —
  meny-ledd: et ledd som tilbyr FLERE lesningsalternativer kan ha flere
  `BIBELREF |`-linjer (én per alternativ).
- **`@NOTAT …`** for instruksjoner/rubrikker, **`@COPYRIGHT | …`** for
  salmeinfo. `@NOTAT`-prefikset er konvensjon også i `instr` — ikke
  fjern det. «Vis instruksjoner»-bryteren i appen styrer @NOTAT i alle
  tekstfelter (også i alternativtekster).
- **Salme-plassholdere**: ledd som bare markerer «salme her» skal være
  `type: "salme"` med tomme salmeNr/salmeTittel og valgrubrikken i
  `instr` — ikke som tekst-ledd. Sangvers som ble egne titler: slå
  sammen til ett salmeledd.
- **Leddtitler**: `* ` prefiks betyr at **menigheten som hovedregel står**
  under leddet (sitat fra malen: «Et stjernetegn (*) er satt til ledd der
  menigheten som hovedregel står.») — det betyr IKKE at leddet er
  valgfritt. Behold prefikset og nummereringen.
- **Valgfrie ledd markeres med `optional: true`** — aldri avledet av
  `* `-prefikset. Kilden markerer dem med «Her kan følge …» / «kan»-
  formuleringer, eller de er dokumentert i originalen. Kopier ikke
  originalmalens per-ledd optional-mønster blindt — synkroniser det mot
  bm-originalen per normalisert heading (stripp `* ` og ledende nummer,
  lowercase).
- **`malForm` og `liturgiType`** (`gudtjeneste`/`vigsel`/`gravferd`)
  eksplisitt — aldri la filnavnet bestemme alene.
- **WIP/utkast-status bor i malen** (`wip: true`) — ingen db-nøkkel.
- **Seksjonstitler** skal speile originalenes mønster (I. Samling …
  for hovedgudtjeneste; funksjonelle seksjoner for gravferd). Tittelside:
  en første seksjon uten tittel med ≤1 ledd er dokumentets egen
  tittelside og skal bort. Rotete docx-headings («ORDNING FOR»,
  «ELLER», «JORDPÅKASTELSE») ryddes.
- **Unike id-er med malprefiks** (f.eks. `vigsel-2017-bokmal-7`).
- **Målformsvarianter må ha eksplisitt id: `<bm-id>-nynorsk`** — konverteren
  avleder id fra navnet, og med målformen ut av navnet får nn-varianten ellers
  SAMME id som bm-originalen. Id-kollisjon bryter appens seed-integritetssjekk
  (bm/nn-par matches på id) og dedupe, og bm-innholdet overskriver nn-filen
  ved neste app-oppstart.
- **Kildefeil («0g sier» osv.) bevares verbatim** (literal preservation)
  og flagges i rapporten. Wingdings-korset (U+F058) → ✝ (automatisk).
  Sidereferanser («(se s 11)») omskrives til seksjonsnavn; tapte
  hyperlenker behandles som `@NOTAT … (lenke i kildedokumentet)`.

### Generelle regler — varianter og innledning/avslutning

- **Variant-gruppering**: tekster skilt med «Eller»-rubrikker (bm) eller
  «anten/eller» (nn) skal bli `alts[]` på samme ledd. Nummererte
  leddheadinger er aldri varianter (unntak: rene «Enten A»/«Eller B»-par).
- **Et ledd kalt bare «Eller»** betyr at leddet FØR og leddet ETTER (og
  ev. flere «Eller»-ledd) er ALTERNATIVER TIL SAMME ledd — ikke en egen
  gruppe. Slå dem inn i hovedleddet som introAlts/alts og slett
  «Eller»-leddet.
- **Innledning/alternativer/avslutning**: tekst som gjelder ALLE
  varianter → `introAlts` (rendres før); tekst som varierer → `alts[]`;
  tekst som følger alle varianter → `avslutningAlts` (rendres etter).
  Felles «La oss be.», erklæringer og Fadervår hører typisk i intro-/
  avslutning-alts. Står den felles innledningen som EGET ledd før
  variantene (vanlig i kildedokumenter), må den flyttes inn som
  `introAlts` manuelt.
- **Alts-labels**: konverteren bruker A/B/C… — originalene bruker
  beskrivende labels («Nåde være med dere og fred», «Allmenn serie 1, 2,
  fest- og fasteserien»). Sett beskrivende labels der de gir mening.

### Generelle regler — komplekse ledd: splitt etter INNHOLD

Noen kildeledd er for komplekse for én ledd-/alts-struktur — typisk når
variantene ikke bare er «eller»-alternativer (med eller uten innledning
og avslutning), men også inneholder bibellesninger og «kan» (valgfrie)
ledd. Da må det deles opp for å fungere i malstrukturen. Følg
Dåp-HG-bm (brukerens forelegg): del teksten fra docx/pdf i FLERE ledd
etter innhold, med høytlesbare overskrifter:

- **Valgfrie («kan»)-ledd SKAL være egne ledd** — og som en konsekvens
  blir det før og etter dem også egne ledd, for å beholde strukturen.
- **Innledning** («I namnet åt …», «Lat oss takka og be:») → introAlts
  med beskrivende label («Mottaking», «Innledning»). Flere
  innledningsvarianter («…» + «Eller …») = FLERE introAlts.
- **Bibelord** — ledd med mange bibeltekster får eget ledd per bolk: fast
  skriftord = introAlt (label «Skriftord»), valgtekstene = alts med
  referansen som label («Mark 10,13–16», «Tit 3,4–7» …). Rubrikken som
  innleder alternativene («Her kan ein lesa …», «Ved dåp av større born …
  kan … koma i staden:») går i leddets `instr` eller som @NOTAT i
  introAlten — aldri samlet i en felles instr-robotliste.
- **Bønn / Takkebønn** («La oss be» / «La oss takke og be») → eget ledd;
  innledningslinjen er introAlts, bønnevariantene er alts.
- **Instruksjonspar «Ved X:» / «Ved Y:»** som innleder HVER sin variant →
  de FORMULERER alternativenes labels («Ved dåp av born») og følger som
  @NOTAT først i alternativet — aldri som samlet instr-liste i et
  sideliggende «Eller»-ledd.
- **Faste bolker etter alternativene** (Fadervår, Lovprisning, Evt. sang
  i dåpen) = egne ledd etter alternativ-leddet — ikke hengende i samme
  ledds tekst. Innledningslinjen i slike ledd («Lat oss saman be … :») er
  introAlts, ikke innhold.

Konverteren har automatikk for det enkle tilfellet: første alternativ
som er en kort linje som slutter på «:» løftes til introAlts
(«Innledning») i `trekkUtIntroAvslutning()`. Alt annet over er steg
3-arbeid — sjekk alltid mot bm-originalens struktur når den finnes.

### Generelle regler — instruksjoner til alternativer

Instruksjoner som angår et bestemt påfølgende alternativ («Ved dåp av
born:», «Her kan ein lesa følgjande skriftord:», «Ein i dåpsfølgjet, ein
annan medliturg eller liturgen les teksten:» …) løses slik:

1. **Instruksjonen formulerer alternativets NAVN** (`label`) — kort og
   gjenkjennelig, f.eks. `Ved dåp av born`, `Skriftord`, `Dåpsfølge les`.
2. **Selve instruksjonen går som `@NOTAT` først i alternativets egen
   tekst** (`@NOTAT Ved dåp av born: …`), ikke i forrige ledds felles
   instr.

### Generelle regeller — anten/enten N + eller N-serier

Serier inne i ett ledd («anten 1 … eller 2 … eller 3 …», f.eks.
Samlingsbønnen) splittes til `alts[]` på leddet (label = nummeret),
samme mønster som a–g-seriene. Vokt deg for at konverterens
bibelref-klebing har limt «BIBELREF | » foran variantmarkørene — fjern
prefikset.

### Type-spesifikke regler

**Hovedgudtjeneste (bm 2020 som målestokk):**

- Originalen har 27 nummererte ledd (1 Forberedelse … 27 Postludium),
  lenket Dåp-seksjon og kuraterte intro/avsl/alt-labels. Kontroller at
  ALLE nummererte ledd finnes som egne ledd med riktig nummerering, og
  gjenopprett de som mangler.
- Lenket Dåp: `__lenket: { malId: "dop-i-hovedgudstjenesten-2017"
  (bokmål) / "dåp-i-hovedgudstjenesten-2017-nynorsk" (nynorsk — følg
  målformen!), tittel: "Dåp" }`, plassert rett etter «I. Samling».
- Nattverden — kildens bønneserier (a–g) skal IKKE flatet ut i én
  alts-gruppe: originalen deler serien over PARALLELE ledd (Prefasjon
  alts: 19 kirkeårsvarianter — KILDEDOKUMENTET har bare 8, ikke oppfinn
  ekstra; Sanctus alts: 2; Epiklese alts: 7; VERBA alts: 7; Avslutning
  alts: 7), og felles tekster (Prefasjonsdialog, Troens mysterium,
  Fadervår) er egne ledd uten alts.
- `* `-leddene (2, 3, 12, 14, 21, 22, 24, 25, 26, 27) = menigheten står;
  kun 21 Prefasjon, 24 Salme og 27 Postludium har `optional: true`.

**Vigsel (2003 og 2017):**

- Seksjoner = Bestemmelser (ÉN instr-item med hele bestemmelsesteksten —
  ikke delt opp), deretter én seksjon per nummerert ledd: 1 Preludium/
  Inngang … 13 Utgang. I 2003 står tallene ikke i docx-headingsene —
  hent dem fra kryssreferanser. I 2017 står de som «N | Tittel»-headings,
  normaliseres til «N Tittel».
- Katalog-seksjonen plasseres ETTER ledd 4 Skriftlesning (mellom 4 og 5).
  Første item har katalog-tittelen + rollelinje + instr med
  utvalgsreglene; deretter étt item per lesning med bibelreferansen som
  heading, teksten i `text` (`BIBELREF | <ref>` som SISTE linje) og
  `bokstav`-feltet («A», «B», «C» …). Sett
  `data.skriftlesningKilde = <katalog-seksjonens tittel>`.
- Vigsel-malene har ingen valgfrie ledd — ikke oppfinn dem der.

**Gravferd (2003):**

- Funksjonelle seksjoner: «Inngang og minneord» (ledd 1–8), «Tale»
  (ledd 9–14 PLUS «15 Postludium»), «Jordpåkastelse» × 2 — delGruppe
  «gravferd» (holder-leddet «Gravferd» + ledd 16–22) og «bisettelse»
  (holder-leddet «Bisettelse» + ledd 19–23). Holder-ledd er korte
  innledningsledd uten nummer. delGrupper-katalogen på mal-data heter
  «gravferd» og «bisettelse». En «Alminnelige bestemmelser»-seksjon
  først (bestemmelsene som én instr-item) er godkjent — seksjoner skal
  IKKE splittes ytterligere.
- Skriftlesningstekstgrupper (I, II, III, «Ved barns gravferd») som egne
  ledd i «Skriftlesninger»-seksjonen, hver med alts[] per tekst (label =
  tema eller bibelref). «Ved barns gravferd»: `* `-markeringen betyr at
  menigheten står (ikke valgfrihet).

**Nynorsk (egen målform):**

- Nynorsk «anten/eller» = bokmål «enten/eller». Skrivemåten i
  innledninger/avslutninger avviker fra bokmålet — ikke kopier
  bokmålstekster, kontroller mot nynorsk-kilden.
- Rolle-vokabular i kildene: `L`, `ML`, `M`, `A`, `P`, `I`/`II`, `B`,
  fulle navn (`Brudgommen:`, `Klokker / gjestende prest:`). Rollelinje =
  `ROLLE | tekst`, `ROLLE: tekst` eller `ROLLE  tekst` (dobbel
  mellomrom). **Enbokstav-ord + mellomrom + små forbokstav («Å leve
  sammen …») er setningsstart, ikke rolle.**

### Referanse-materiale

- **Seed-maler er FORMAT-referanse**: etter steg 1 ligger appens
  seed-maler i `~/.cache/liturgi-limal/seeds/`. Åpne aldri seedet for
  SAMME liturgi du konverterer (det forringer testen) — bruk en annen
  liturgi som strukturmal.
- Heuristikker og feller i skriptet:
  `references/docx-pdf-heuristikker.md` — les før du endrer
  konverter-logikken eller tolker skriptets utdata.
- Ressursbanken svarer ofte 502 på docx-nedlasting — vent og prøv igjen
  (opptil 5×); identiske kopier ligger ofte i `~/.hermes/attachments/`.

### Steg 3b — strukturkontroll mot kilden (obligatorisk før rapport)

Rapporten skal alltid inneholde et **sammendrag av**:

- **leddtitler med `* `** (menigheten som hovedregel står under leddet) —
  listet opp med leddnummer,
- **hvor instruksjonene ble plassert** (leddets `instr` vs alternativets
  `label` + `@NOTAT` i alt-teksten), spesielt de som angår et bestemt
  alternativ («Ved dåp av born:» osv.).

Før du skriver rapporten må du SELV kontrollere den genererte malen mot
kildedokumentet, programmert — ikke bare øynemål:

1. **Kilddump**: les docx-en (python3 + zipfile + regex over
   `word/document.xml`, ta med avsnittstil for hvert avsnitt) eller
   pdf-en (`pdftotext -layout`). Lagre dumpen til fil
   (f.eks. `kilde-dump.txt`).
2. **Dekningssjekk**: gå gjennom HVER kildeparagraf og kontroller at
   meningsinnholdet finnes i .limalen (i text/instr/alts/introAlts/
   avslutningAlts/heading/label). Rapporter dekningsprosent (f.eks.
   «307/307 avsnitt») og LIST alle avvik med begrunnelse (tittelside,
   sidetall, rubrikker som ble til alts-labels, klebde rolleprefiks osv.
   er gyldige unntak — men de skal være begrunnet). Match uten
   Rolle-prefiks: kilden kan ha «L |tekst»/«L|tekst» klebet sammen, mens
   malen har `{{r}}L |{{/r}} tekst` — stripp et ledende
   `ROLLE |`-prefiks fra kildeparagrafen og match på nytt før du
   rapporterer avsnittet som udekket, ellers får du falske avvik for
   hver rollelinje.
3. **Struktursjekk**: alle nummererte ledd i kilden finnes som ledd med
   riktig nummer og tittel; seksjonsinndelingen følger liturgitypen;
   rollemerker balansert i ALLE tekstfelt; BIBELREF sist i felt
   (meny-ledd unntak).
4. **Verktøy**: kjør `node <skill-katalog>/scripts/valider.mjs
   <fil>.limal` — 0 feil er krav; advarsler skal være begrunnet.
5. **Retting**: funnene fra 2–4 rettes i .limal-filen FØR levering —
   kontrollen skal ikke bare dokumentere feil, men få dem rettet.

### Skriverfelle-sjekk (obligatorisk på ALLE leveransefiler)

Skriveverktøy kan miste s-en i «gud(s)tjeneste»-familien
(«gudtjeneste», «gudteneste», «hovedgudtjeneste», «hovudgudeneste» …).
Kildedokumentene er verifisert rene, så en automatisk rett er trygg:

```bash
node ~/.cache/liturgi-limal/skriverfelle.mjs <fil.limal> <RAPPORT.md>
```

- Retter innholdet i .limal-filer (alle tekstfelter, også mal-navn) og
  rapporter, og OMDØPER filer hvis filnavnet inneholder feilen.
- `konverter-liturgi.mjs` kjører den automatisk på utdatafilen.
- Kjør den på nytt ETTER hver manuelle redigering av filer, og som siste
  trinn før levering. Kontroller etterpå at filnavnet har korrekt
  skrivemåte («hovedgud·s·tjeneste»).

## Steg 4 — app-nær validering (headless)

`hent-siste.sh` henter `~/.cache/liturgi-limal/valider-app.mjs` + appens
egen renderer (`lit.js`). Kjør den på den ferdige malen:

```bash
node ~/.cache/liturgi-limal/valider-app.mjs <fil>.limal \
     --seeds ~/.cache/liturgi-limal/seeds
```

Dette gjentar det appen sjekker ved import/åpning av en mal — headless:

- parse + påkrevde felt, unike id-er, rollemerker balansert i ALLE
  tekstfelter (text/instr/alts/introAlts/avslutningAlts)
- **rendering gjennom appens egen litHtml** — fanger feilformede
  rollemerker/notater som ville sett rare ut i redigeringsvisningen
- app-regler: selAlt/selIntro/selAvsl i grensene, `type: "salme"`-felt,
  delGruppe ∈ delGrupper, skriftlesningKilde → seksjonen finnes,
  bokstavsekvens A,B,C… i katalogen, **__lenket-malId finnes blant
  seed-malene** (avslå --seeds for å hoppe over seed-sjekken; målforms-
  varianter som «-nynorsk» følger appens originaler, ikke seed-listen —
  kontroller at malen finnes i appen)

Krav: 0 feil før levering. Advarsler skal være begrunnet i rapporten.
Visuell sjekk (farger, høyder, faktisk import) gjøres av brukeren ved
import — oppgi i rapporten at dette gjenstår. Ikke overskriv brukerens
eksisterende maler uten å spørre.

## Nyttige stier

- Hurtiglager (siste format + script): `~/.cache/liturgi-limal/`
- Kilden: `github.com/ArnstadFredrik/liturgi-app`
  (`docs/limal-format.md` + `electron/konverter.cjs`)
- **Seed-maler** i `~/.cache/liturgi-limal/seeds/`. Les dem ALDRI fra
  `~/.config/Liturgi/maler/originaler/` som eneste kilde (finnes bare
  lokalt). Rediger ALDRI filer i `originaler/` — de regenereres mot
  seed ved oppstart. Skal du redigere en mal, kopier den til
  `brukermaler/` (eller egen sti) først.
- Maler-import i appen: Bibliotek → Maler → importer (eller kopier fil
  til `~/.config/Liturgi/maler/brukermaler/`). Appen har også samme
  konvertering innebygd: KonverterModal på Maler-siden →
  `mal:konverter-fil`-IPC → `electron/konverter.cjs` → `.limal` i
  `brukermaler/`. Drag-and-drop krever `webUtils.getPathForFile` i
  preloaden (`File.path` er fjernet i Electron 32+).
- Konverter-logikken bor kun i liturgi-app-repoet — skill-repoets
  `scripts/fallback/konverter.cjs` er bare offline-fallback. Etter
  endringer: `scripts/sync-konverter.sh` i skill-repoet + commit/push,
  og synkroniser profilkopien av ALLE skript
  (`~/.hermes/profiles/default/skills/limal-konvertering/scripts/`).
- E2E-test av in-app-konvertering skriver til brukerens EKTE
  `brukermaler/`-mappe (styres ikke av `LITURGI_DB_DIR`) — flytt
  testfilen til `~/.Trash` etterpå (python `shutil.move` kan få
  PermissionError: bruk osascript/Finder). Verifiser aldri mot
  brukerens eksisterende malnavn.
- Kernel-fellen («gudtjeneste» mister «s» i alt agenten SKRIVER — også
  commit-meldinger og CDP-eval-strenger): bygg mønstre og nøkler med
  `chr(115)`/`String.fromCharCode`, skann med kjøretidsmønstre (aldri
  grep — kollasjon), rett commit-meldinger pre-push med
  `git commit --amend` (etter push kreves force-with-lease — spør
  brukeren). Bash-skript: ASCII-variabelnavn kun. **Filstier med
  «gud(s)tjeneste»-ord i shell-kommandoer rammes også** — en bokstavelig
  sti som `maler/originaler/Dåp i hovedgudtjenesten …` mister s-en og gir
  stille ENOENT eller «ren»-svar fra skriverfellen; lokalisér filer med
  python (glob/listdir + `chr(115)`-konkatenering) og send stien videre
  derfra.
- Synk av repo-kopier (ved vedlikehold av skill-repoet):
  `scripts/sync-format.sh` + `scripts/sync-konverter.sh`
- Test-syklus for skill-forbedring (brukerstyrt): samme mal konverteres
  i runder av ferske subagenter (blank kontekst, skill-klone fra repo,
  ingen cache; én subagent per mal per runde, parallelt i én
  delegate_task-kjøring); resultatet sammenlignes med originalen på TALL
  (seksjons-/ledd-/alts-tellere + valider + appens Diff-modul), og
  skillen revideres mellom hver runde. Full orkestrator-prosedyre:
  `references/treningsrunder.md`. Batch-import av flere liturgier til
  appen: `references/ressursbanken-batchimport.md`.
