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

# App-nær steg 4-validering: headless CLI + appens egen renderer (lit.js).
# GitHub raw kan ha CDN-forsinkelse rett etter push — fall tilbake til
# fallback-kopien i dette repoet ved 404.
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
curl -fsSL "$BASE/scripts/skriverfelle.mjs?v=$TS" -o "$CACHE/skriverfelle.mjs" || cp "$SKILL_DIR/scripts/fallback/skriverfelle.mjs" "$CACHE/skriverfelle.mjs"
node --check "$CACHE/skriverfelle.mjs"
if curl -fsSL "$BASE/scripts/valider-app.mjs?v=$TS" -o "$CACHE/valider-app.mjs"; then
  curl -fsSL "$BASE/src/lib/lit.js?v=$TS" -o "$CACHE/lit.js" || cp "$SKILL_DIR/scripts/fallback/lit.js" "$CACHE/lit.js"
else
  echo "  valider-app: raw 404 (CDN-forsinkelse?) — bruker fallback-kopien"
  cp "$SKILL_DIR/scripts/fallback/valider-app.mjs" "$CACHE/valider-app.mjs"
  cp "$SKILL_DIR/scripts/fallback/lit.js" "$CACHE/lit.js"
fi
node --check "$CACHE/valider-app.mjs"

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
echo "  app-validering: $CACHE/valider-app.mjs (steg 4)"
