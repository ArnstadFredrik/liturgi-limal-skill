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
`@COPYRIGHT`. Nummererte leddtittler i ren tekst («4 Samlingsbønn») og
rollekvalifikatorer («L sier |», «A eller L |», «A (eller L/ML) |»)
håndteres nå; salme-plassholdere typis som salme-ledd; seriemønstre
(«Allmenn serie 1», språkserier) merges som alts-labels. Kjente
svakheter: sangvers uten N13-markør kan bli egne titler, katalog-seksjoner
i vigsel knuses ofte (bygges manuelt i steg 3), «Eller»-varianter med
innhold kan stå igjen som egne ledd.

## Steg 3 — LLM-gjennomgang (dette er din jobb)

Les skriptets utdata mot kildedokumentet og rett:

- Roller: `{{r}}L |{{/r}}`, `{{r}}ML/L |{{/r}}` … — sjekk hver linje.
- Variant-gruppering: tekster skilt med «Eller»-rubrikker skal bli
  `alts[]` på samme ledd (label = gjerne bibelreferansen).
- `BIBELREF | <ref>` sist i `text` for bibeltekster.
- `@NOTAT …` for instruksjoner/rubrikker, `@COPYRIGHT | …` for salmeinfo.
- Leddtitler: `* ` prefiks betyr at **menigheten som hovedregel står**
  under dette leddet (sitat fra malen: «Et stjernetegn (*) er satt til ledd
  der menigheten som hovedregel står.») — det betyr IKKE at leddet er
  valgfritt. Behold prefikset og nummereringen.
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
- **Dåp i hovedgudstjenesten**: hovedmalen har en lenket Dåp-seksjon
  (`__lenket: { malId: …, tittel: … }`, tom `items`). På nynorsk lenkes den
  til nynorsk-dåp-malen — husk å opprette den først.
- **Hovedgudstjenesten bm 2020 som målestokk**: originalen har 27 nummererte
  ledd (1 Forberedelse … 27 Postludium), lenket Dåp-seksjon og kuraterte
  intro/avsl/alt-labels. Konverteringen mister fortsatt noen slike
  strukturtledd (de ender i forrige ledds tekst) — kontroller at ALLE
  nummererte ledd («4 Samlingsbønn», «9 Første lesning», «13 Preken» …)
  finnes som egne ledd med riktig nummerering, og gjenopprett de som mangler.
- **Vigsel- og gravferdsmalene er annerledes bygget enn hovedgudstjenesten**:
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
- **Valgfrie ledd markeres med `optional: true`** — IKKE med `* `-prefikset
  (det betyr at menigheten står, se over). Ekte valgfrie ledd markeres i
  kilden med «Her kan følge …»-innledninger eller er dokumentert i
  originalen (hovedgudstjenesten bm 2020: ledd 21 Prefasjon, 24 Salme og
  27 Postludium har `optional: true` i originalen; de andre `* `-leddene
  har det IKKE). **Vigsel-malene har ingen valgfrie ledd — ikke oppfinn
  dem der.**
- **Vigsel-strukturen i detalj** (2003 og 2017): seksjoner = Bestemmelser (én
  instr-item med hele bestemmelsesteksten; seksjonstittelen er «Bestemmelser»
  og bestemmelsesteksten er ÉTT item — ikke delt opp), deretter én seksjon per nummerert
  ledd med item.heading identisk til seksjonstittelen: 1 Preludium/Inngang,
  2 Inngangsord, 3 Salme, 4 Skriftlesning, 5 Salme, 6 Tale,
  7 Ekteskapsinngåelse, 8 Overrekkelse av ringer, 9 Forbønn,
  10 Musikk/symbolhandlinger (2017: Musikk/symbolfortellinger), 11 Salme,
  12 Velsignelse, 13 Utgang. I 2003-dokumentet står tallene IKKE i
  docx-headingsene — hent dem fra kryssreferanser i brødteksten. I 2017-dokumentet
  står de som «N | Tittel»-headings. Katalog-seksjonen plasseres ETTER ledd
  4 Skriftlesning (mellom 4 og 5), ikke bakerst. Katalog-seksjonen bakerst heter
  «Skriftlesninger ved Vigsels- og forbønnsliturgi (2003/2017)»: første item
  har tittelen + rollelinje «La oss videre høre fra Guds ord.» + instr med
  utvalgsreglene; deretter étt item per lesning med bibelreferansen som
  heading, teksten i `text` (`BIBELREF | <ref>` som SISTE linje) og
  `bokstav`-feltet satt («A», «B», «C» …). Sett
  `data.skriftlesningKilde = <katalog-seksjonens tittel>` (feltet peker på en
  SEKSJONSTITTEL i samme mal).
- **Rolle `A` finnes i originalene** (hovedgudstjeneste og gravferd bruker den)
  — bruk den fritt når kilden gjør det; rollesettet er ikke lukket.
- **BIBELREF-meny-ledd**: et ledd som tilbyr FLERE lesningsalternativer kan ha
  flere `BIBELREF |`-linjer midt i text (én per alternativ). Konvensjonen
  «BIBELREF sist» gjelder vanlige enkelt-lesningsledd; meny-ledd er unntak.
- **«Her kan følge …» markerer VALGFRIHET**: ledd og alternativer som
  er innledet med «Her kan følge …» er valgfrie — sett `optional: true`
  på dem. Rubrikken selv behandles som `@NOTAT` i
  leddets `instr`.
- **Instruksjoner som angår et bestemt påfølgende alternativ** («Ved dåp av
  born:», «Ved dåp av større born, unge eller vaksne:», «Her kan ein lesa
  følgjande skriftord:», «Ein i dåpsfølgjet, ein annan medliturg eller
  liturgen les teksten:» …) løses slik:
  1. **Instruksjonen formulerer alternativets NAVN** (`label`) — kort og gjenkjennelig,
     f.eks. `Ved dåp av born`, `Skriftord`, `Dåpsfølge les`.
  2. **Selve instruksjonen går som `@NOTAT` først i alternativets egen tekst**
     (`@NOTAT Ved dåp av born: …`), ikke i forrige ledds felles instr.
  «Vis instruksjoner»-bryteren i appen styrer @NOTAT overalt (også i
  alternativtekster), så instruksjonen skjules sammen med de andre.
- **Rolleformer i nynorsk-kildene**: instruksjonen mellom rollen og røret
  inkluderes i rollemerket — «L seier |» → `{{r}}L seier |{{/r}} …`,
  «L syng eller seier |» → `{{r}}L syng eller seier |{{/r}} …`,
  «A eller L/ML |» → `{{r}}A eller L/ML |{{/r}} …`, «L/ML seier |» →
  `{{r}}L/ML seier |{{/r}} …`, «K reiser seg og syng |» →
  `{{r}}K reiser seg og syng |{{/r}} …`. Parentes-formen «(L seier |)»
  beholder parentesene: `({{r}}L seier |{{/r}})`. Roller SKAL formateres
  OGSÅ inne i alternativer (alts/introAlts/avslutningAlts) — ikke bare i
  leddets hovedtekst.
- **Roller avslutter med «|» som hovedregel**, men kan også avslutte
  med «:» eller (sjelden) ha ingen egen avslutning — alle normaliseres
  til `{{r}}ROLLE |{{/r}}` i malen.
- **Anten/enten N + eller N-serier inne i ett ledd** (f.eks. Samlingsbønnen
  i HG-nn med «anten 1 … eller 2 … eller 3 …») skal splittes til `alts[]`
  på leddet (label = nummeret), samme mønster som a–g-seriene. Voko for
  at konverterens bibelref-klebe-rule kan ha klebet «BIBELREF | » foran
  variantmarkørene — fjern den prefiksen.
- **Kildefeil («0g sier» osv.) bevares verbatim** (literal preservation) og
  flagges i rapporten.
- **Gravferdsstrukturen i detalj** (2003): seksjoner med
  `delGruppe: "ved graven"` / `"i krematorium"` (+ `delGrupper`-katalogen på
  mal-data). Skriftlesningstekstgrupper (I, II, III, «Ved barns gravferd») som
  egne ledd i en «Skriftlesninger»-seksjon, hver med alts[] per tekst (label =
  tema eller bibelref). Originalens seksjonstitler er
  funksjonelle: «Inngang og minneord», «Skriftlesninger», «Tale»,
  «Jordpåkastelse» og «Jordpåkastelse» (delGruppe-navnene i originalen
  er «gravferd» og «bisettelse» — IKKE «ved graven»/«i krematorium»).
  Eksakt fordeling i originalen:
  «Inngang og minneord» = ledd 1–8; «Tale» = ledd 9–14 PLUS
  «15 Postludium» (ja — den ligger i Tale-seksjonen); første
  «Jordpåkastelse» (delGruppe «gravferd») = holder-leddet «Gravferd» +
  ledd 16–22; andre «Jordpåkastelse» (delGruppe «bisettelse») =
  holder-leddet «Bisettelse» + ledd 19–23 («23 Postludium»). Holder-ledd
  («Gravferd»/«Bisettelse») er korte innledningsledd uten nummer. En
  «Alminnelige bestemmelser»-seksjon først (bestemmelsene som én
  instr-item) er godkjent i tillegg — seksjoner skal IKKE splittes
  ytterligere.
- **Rollemerket er BARE rolletokenet** — eksempel: kildelinjen
  «L synger eller sier: Herren være med dere» blir
  `{{r}}L |{{/r}} synger eller sier: Herren være med dere` (kvalifikatoren
  STÅR I TEKSTEN rett etter merket).  (`{{r}}L |{{/r}}`) — kvalifikasjoner
  («synger eller sier», «vendt mot menigheten») holdes UTENFOR r-merket, i
  tekststart eller `@NOTAT`. Ikke lag roller som «L synger eller sier».
- **«Ved barns gravferd»** i gravferdsmalen: `* `-markeringen betyr her at
  menigheten står (ikke valgfrihet)
  med tre lesningstekster i sekvens.
- **Item-former** (`type: "instruks"`, fulle rollenavn, «Kort»/«Lang»-labels)
  kan leses fra et seed av en ANNEN liturgi som FORMAT-referanse.
- **Vigsel 2017**: heading-stilte «N | Tittel»-normaliseres til «N Tittel»
  (så vel som seksjonstittel). Katalogens første item skal ha
  katalog-seksjonens tittel som heading.
- **Unike id-er med malprefiks** (f.eks. `vigsel-2017-bokmal-7`) — kollidærer
  ikke med seed-id-er.
- **Lenket Dåp i hovedgudstjenesten bm**: `__lenket: { malId:
  "dop-i-hovedgudstjenesten-2017" (bokmål) / "dåp-i-hovedgudstjenesten-2017-nynorsk" (nynorsk — følg målformen!), tittel: "Dåp" }`, plassert rett etter
  «I. Samling».
- **@NOTAT-prefikset er konvensjon også i `instr`** (konverteren skriver det;
  appen viser instr som notat uansett) — ikke fjern det.
- **Skriverfellen («gudtjeneste» uten s)**: sjekk filnavn, rapport og
  .limal-fil for «gudtjeneste»-uten-s-mønsteret og rett til «gud·s·tjeneste»
  før levering. Filnavnet skal være «hovedgud·s·tjeneste» med s.
- **Nattverddelen i hovedgudstjenesten — kildens bønneserier (a–g)
  IKKE flattet ut i én alts-gruppe**: originalen deler serien over PARALLELE
  ledd, ett ledd per serie-trinn, der hvert trinn får seriens varianter som
  alts. III. Nattverd i originalen: 20 Forberedelse av måltidet, Prefasjonsdialog
  (felles tekst), * 21 Prefasjon (alts: 19 — kirkeårsvarianter: Advent, Jul, Åpenbaringstiden, Faste, Påske … IKKE nattverdbønne-serien; KILDEDOKUMENTET har bare 8 varianter — originalens 19 er manuelt arbeidet, ikke oppfinn ekstra), Sanctus (alts: 2), Epiklese
  (alts: 7), Innstiftelsesordene VERBA (alts: 7), Troens mysterium (felles),
  Avslutning (alts: 7), Fadervår, * 22 Fredshilsen PAX, Du Guds Lam AGNUS DEI
  (alts: 2), Invitasjon og utdeling, 23 Måltidets avslutning – Takkebønn
  (alts: 4). Felles tekster (dialog, Troens mysterium) er egne ledd uten alts.
- **Salme-plassholdere**: ledd som bare markerer «salme her» (ingen
  konkret salme i kilden) skal være `type: "salme"` med tomme
  salmeNr/salmeTittel og valgrubrikken (f.eks. «Salmen velges …») i
  `instr` — ikke som tekst-ledd.
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


### Steg 3b — strukturkontroll mot kilden (obligatorisk før rapport)

Rapporten skal alltid inneholde et **sammendrag av**:
- **leddtitler med `* `** (menigheten som hovedregel står under leddet) — listet opp med leddnummer,
- **hvor instruksjonene ble plassert** (leddets `instr` vs alternativets egen `instr`/`@NOTAT`), spesielt de som angår et bestemt alternativ («Ved dåp av born:» osv.).

Før du skriver rapporten må du SELV kontrollere den genererte malen mot
kildedokumentet, programmert — ikke bare øynemål:

1. **Kilddump**: les docx-en (python3 + zipfile + regex over
   `word/document.xml`, ta med avsnittstil for hvert avsnitt) eller pdf-en
   (`pdftotext -layout`). Lagre dumpen til fil (f.eks. `kilde-dump.txt`).
2. **Dekningssjekk**: gå gjennom HVER kildeparagraf og kontroller at
   meningsinnholdet finnes i .limalen (i text/instr/alts/introAlts/
   avslutningAlts). Rapporter dekningsprosent (f.eks. «307/307 avsnitt») og
   LISTE alle avvik med begrunnelse (tittelside, sidetall, dupliserte
   rubrikker osv. er gyldige unntak — men de skal være begrunnet).
3. **Struktursjekk**: alle nummererte ledd i kilden finnes som ledd med
   riktig nummer og tittel; seksjonsinndelingen følger liturgitypen
   (hg: I–IV + valgfrie `*`-ledd; vigsel: én seksjon per ledd 1–13 +
   katalog-seksjon mellom ledd 4 og 5; gravferd: funksjonelle seksjoner +
   delGruppe); rollemerker balansert i ALLE tekstfelt; BIBELREF sist i
   felt (meny-ledd unntak).
4. **Verktøy**: kjør `node <skill-katalog>/scripts/valider.mjs <fil>.limal`
   — 0 feil er krav; advarsler skal være begrunnet i rapporten.
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

## Komplekse ledd: splitt etter INNHOLD (dåp-i-HG-mønsteret)

Noen kildeledd er for komplekse for én ledd-/alts-struktur. Følg
Dåp-HG-bm (brukerens forelegg): del teksten fra docx/pdf i FLERE ledd etter
innhold, med høytlesbare overskrifter, og bruk introAlts/alts/avslutningAlts
innad i hvert ledd:

- **Innledning** («I namnet åt …», «Lat oss takka og be:») → introAlts med
  beskrivende label («Mottaking», «Innledning»). Flere innledningsvarianter
  («… » + «Eller …») = FLERE introAlts.
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
- **Et ledd kalt bare «Eller»** betyr at leddet FØR og leddet ETTER (og ev.
  flere «Eller»-ledd) er ALTERNATIVER TIL SAMME ledd — ikke en egen gruppe.
  Slå dem inn i hovedleddet som introAlts/alts og slett «Eller»-leddet.
- **Faste bolker etter alternativene** (Fadervår, Lovprisning, Evt. sang i
  dåpen) = egne ledd etter alternativ-leddet — ikke hengende i samme ledds
  tekst. Innledningslinjen i slike ledd («Lat oss saman be … :») er
  introAlts, ikke innhold.

Konverteren får nå automatikk for det enkle tilfellet: første alternativ
som er en kort linje som slutter på «:» løftes til introAlts
(«Innledning») i `trekkUtIntroAvslutning()`. Alt annet over er steg
3-arbeid — sjekk alltid mot bm-originalens struktur når den finnes.

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
  bokstavsekvens A,B,C… i katalogen, `optional` konsistent med `* `-
  heading, **__lenket-malId finnes blant seed-malene** (avslå --seeds
  for å hoppe over seed-sjekken)

Krav: 0 feil før levering. Advarsler skal være begrunnet i rapporten.
Visuell sjekk (farger, høyder, faktisk import) gjøres av brukeren ved
import — oppgi i rapporten at dette gjenstår. Ikke overskriv brukerens
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
