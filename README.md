# liturgi-limal-skill

Skill + verktøy for å konvertere gudstjenesteliturgier fra **docx/pdf** til
**.limal**-maler for [Liturgi-appen](https://github.com/ArnstadFredrik/liturgi-app).

## Viktig: liturgi-app er kilden til sannheten

Formatspesifikasjonen (`docs/limal-format.md`) og konverter-logikken
(`electron/konverter.cjs`) vedlikeholdes i liturgi-app-repoet. Skillen
henter **alltid siste versjon fra GitHub ved kjøretid**:

- `scripts/hent-siste.sh` — laster siste format + script til
  `~/.cache/liturgi-limal/` (LLM-en leser formatdokumentet derfra)
- `scripts/konverter-liturgi.mjs` — CLI som henter siste konverter-logikk
  og kjører den (`--offline` avslår henting og bruker hurtiglager/fallback)
- `scripts/fallback/konverter.cjs` — innebygd kopi for offline bruk

## Vedlikehold av dette repoet

Kopiene her er bare fallback/bootstrap. Etter endringer i liturgi-appen:

```bash
./scripts/sync-format.sh      # oppdater references/limal-format.md
./scripts/sync-konverter.sh   # oppdater scripts/fallback/konverter.cjs
```

## Offline skript

```bash
node scripts/konverter-liturgi.mjs <input.docx|pdf> [--navn "Navn"] \
     [--type gudstjeneste|vigsel|gravferd] [--maalform bokmål] [-o ut.limal]
```

Skriptet lager et førsteutkast (hoveddeler, ledd, roller, `@NOTAT`,
`BIBELREF`, salmer, copyright). Finpuss — variant-gruppering, rolle-sjekk,
`alts`-labeling — gjøres av LLM/appen etterpå, jfr. SKILL.md.
