#!/bin/bash
# Henter konverter-logikken fra liturgi-app-repoet (GitHub) og oppdaterer
# dette repoets fallback-kopi. CLI-en (konverter-liturgi.mjs) henter normalt
# siste versjon fra GitHub ved kjøring — dette er offline-fallbacken.
set -e
BASE="https://raw.githubusercontent.com/ArnstadFredrik/liturgi-app/main"
MAAL="$(cd "$(dirname "$0")/.." && pwd)/scripts/fallback/konverter.cjs"
curl -fsSL "$BASE/electron/konverter.cjs" -o "$MAAL"
node --check "$MAAL"
echo "Hentet fra GitHub: $BASE/electron/konverter.cjs -> $MAAL"
