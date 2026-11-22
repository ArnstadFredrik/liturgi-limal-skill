#!/bin/bash
# Hent SISTE formatspesifikasjon og konverter-script fra liturgi-app-repoet
# (kilden til sannheten) til hurtiglageret. LLM-en som kjører skillen skal
# lese formatdokumentet herfra — aldri en gammel kopi.
set -e
CACHE="$HOME/.cache/liturgi-limal"
mkdir -p "$CACHE"
BASE="https://raw.githubusercontent.com/ArnstadFredrik/liturgi-app/main"

TS=$(date +%s)
curl -fsSL "$BASE/docs/limal-format.md?v=$TS" -o "$CACHE/limal-format.md"
curl -fsSL "$BASE/electron/konverter.cjs?v=$TS" -o "$CACHE/konverter.cjs"
node --check "$CACHE/konverter.cjs"

echo "Oppdatert fra liturgi-app (kilden):"
echo "  format: $CACHE/limal-format.md"
echo "  script: $CACHE/konverter.cjs"
