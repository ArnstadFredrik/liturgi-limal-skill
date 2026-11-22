# liturgi-limal-skill

Skill + verktøy for å konvertere gudstjenesteliturgier fra **docx/pdf** til
**.limal**-maler for [Liturgi-appen](../liturgi-app).

## Innhold

- `SKILL.md` — arbeidsflyten for LLM-styrt konvertering
- `scripts/konverter-liturgi.mjs` — offline konverteringsskript (ingen
  LLM, ingen node-avhengigheter; krever `unzip` for docx og `pdftotext`
  for pdf)
- `references/` — kopier av formatspesifikasjonen (synkroniseres fra
  liturgi-app-repoet)

## Formatspesifikasjonen

Kilden til sannheten for `.limal`-formatet ligger i liturgi-app-repoet:
`~/05 projects/liturgi-app/docs/limal-format.md`. Oppdateringer av
formatet gjøres DER; kjør `sync-format.sh` for å kopiere siste utgave
hit.

## Offline skript

```bash
node scripts/konverter-liturgi.mjs <input.docx|pdf> [--navn "Navn"] \
     [--type gudstjeneste|vigsel|gravferd] [--maalform bokmål] [-o ut.limal]
```

Skriptet lager et førsteutkast (hoveddeler, ledd, roller, `@NOTAT`,
`BIBELREF`, salmer). Finpuss — variant-gruppering, rolle-sjekk,
`alts`-labeling — gjøres av LLM/appen etterpå, jfr. SKILL.md.
