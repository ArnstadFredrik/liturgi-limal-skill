# Batch-import fra ressursbanken.kirken.no/liturgi

Oppskrift for å laste ned og organisere liturgisamlingen som .limal-maler.
Rekkefølge og gruppenavn følger ressursbankens bannere.

## Nedlasting

- Direktefiler: `https://ressursbanken.kirken.no/globalassets/...` —
  curl/python **krever User-Agent** (`-A 'Mozilla/5.0'`), ellers 403.
  - python `urllib.request.urlretrieve` gir 403 uten UA; bruk curl med UA.
- `.doc` (gammelt Word-format, f.eks. engelsk ordning): konverter først med
  `textutil -convert docx fil.doc -output fil.docx` (macOS).
- Episerver-lenker (`/episerver/~/link/<id>.aspx`) resolver IKKE til fil via
  curl — hopper over, eller be brukeren laste ned manuelt.
- Serveren kan svare 502 midlertidig — prøv igjen med pause; ikke blokker
  hele batchen på én fil.
- Hopp over: veiledninger, «alminnelige bestemmelser», tekstsamlinger
  (samlingsbønner, forbønner, prefasjoner, tekstrekker) — ikke
  gudtjenesteordninger.

## Konvertering

CLI-en pr fil: `node <skill>/scripts/konverter-liturgi.mjs <fil> --navn
"<navn>" --type <type> --maalform <maalform> -o <ut>.limal`.
`grupperEllerLedd()` håndterer Eller/enten/anten-ellervariantene automatisk.

## Organisering av batchen

1. **Navn uten målform** — målformen vises i egen kolonne; navnet renses
   for «(bokmål)»/«(nynorsk)»/«, nynorsk)»-suffikser. bm- og nn-versjonen av
   samme liturgi får SAMME navn (ulike id-er holder dem fra hverandre).
   **Sett id eksplisitt på nn-varianten: `<bm-id>-nynorsk`** — konverteren
   avleder id fra navnet, så uten dette får nn-filen bm-ens id. Id-kollisjon
   gjør at appens seed-integritetssjekk (matcher på id) skriver bm-innhold
   inn i nn-filen ved neste oppstart, og wip-flagget forsvinner stille.
   Obs: filnavn i `originaler/` beholder da gjerne språkmerket — navnekollisjon
   i filsystemet ellers overskriver originalen.
2. **Kategori** (banner fra ressursbanken, i denne rekkefølgen):
   Hovedgudtjeneste → Gudstjenester i kirkeåret → Andre gudtjenester →
   Nattverd → Dåp og konfirmasjon → Vigsel → Gravferd. Lagres som
   `mal.kategori`; mal-listene har chips-filter + kategori-sortering.
3. **WIP-merking**: hver mal settes `wip: true` + `erOriginal: true` og
   skrives til `~/.config/Liturgi/maler/originaler/`. **WIP-statusen bor i
   malen selv — ingen db-nøkkel.** WIP-originaler skjules HELT fra
   bibliotekets mal-liste (kun Malverktøy i dev viser dem) og ekskluderes
   fra Opprett-modalen; de bekreftes av brukeren i Malverktøy (KUN
   dev-modus, `!isPackaged`). Kopieres/importeres en wip-original som
   brukermal arver den flagget og vises som «Utkast» i biblioteket, med
   Bekreft-knapp der. Prod får dem først når wip-flagget fjernes fra
   seedene i en release. **Si fra til brukeren ved levering at gjennomgang
   krever dev-modus** — i installert app er Malverktøy skjult, så wip-malene
   er usynlige der selv om filene ligger riktig på disk.
4. **Oversettelses-kobling per bm/nn-par**: `mal.oversettelser = [annen-id]`
   på begge sider. nn-versjon av en ETABLERT original: koblingen på bm-siden
   må inn i SEEDEN i `src/lib/data.js` (originalfilen er seed-beskyttet og
   regenereres) + nn-siden i filen. Nye par kobles i begge filene.
   **originaler/ er seed-beskyttet**: filer hvis id matcher en BUILTIN-seed i
   `src/lib/data.js` regenereres fra seed ved hver app-oppstart — endringer i
   slike filer overskrives stille. En ny nn-versjon av en mal som har en
   BUILTIN-seed må derfor Inn I seeden (oppdater seed-objektet: name uten
   målform, `filnavn`-feltet med språkmerket, wip/malForm/oversettelser og
   seksjonene) — ikke bare i filen. Filer uten seed-treff lar seg derimot
   skrive direkte og overlever omstarter.
5. **Optional-synk mot bm-originalen**: nn-malen skal speile bm-malens
   `optional`-mønster per ledd — match på normalisert heading (stripp `* `
   og ledende nummer, lowercase) og kopier bm-verdien. Konverteren setter
   aldri optional fra `* `-prefikset (det betyr at menigheten står).
6. **Etterbehandling**: skriverfelle på ALLE filer (den omdøper også filer
   med feil skrivemåte), og skann alle filene for kernel-fellen med
   kjøretidsmønstre — kernel-skan-testen i appen dekker ikke .limal-filer.
   Valider hver fil med `valider-app.mjs` (0 feil = krav) før rapport.

## Verifisering

- `npm test` + `npm run test:royk` i liturgi-appen, så `npm run app:mac` og
  installer i /Applications før du rapporterer ferdig.
- CDP: tell WIP-merker, sjekk at Opprett-modalen ekskluderer wip-malene,
  og at kategori-filtrene gir forventet radantall.
