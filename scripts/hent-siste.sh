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

# Seed-maler (referanse-maler fra repoet — gjør agenten uavhengig av
# lokal mal-installasjon). Hentes pr fil via GitHub contents-API-et.
SEEDS="$CACHE/seeds"
mkdir -p "$SEEDS"
if curl -fsSL "https://api.github.com/repos/ArnstadFredrik/liturgi-app/contents/seeds?v=$TS" -o "$CACHE/seeds-manifest.json"; then
  ANT=0
  for FIL in $(python3 -c "import json,sys; [print(f[\"name\"]) for f in json.load(open(sys.argv[1])) if f[\"name\"].endswith('.limal')]" "$CACHE/seeds-manifest.json"); do
    if curl -fsSL "$BASE/seeds/$FIL?v=$TS" -o "$SEEDS/$FIL"; then ANT=$((ANT+1)); fi
  done
  echo "  seeds: $SEEDS ($ANT filer)"
else
  echo "  seeds: kunne ikke hente liste (nett?) — hopper over"
fi

echo "Oppdatert fra liturgi-app (kilden):"
echo "  format: $CACHE/limal-format.md"
echo "  script: $CACHE/konverter.cjs"
