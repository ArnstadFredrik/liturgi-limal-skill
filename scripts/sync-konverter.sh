#!/bin/bash
# Synkroniser konverter-logikken fra liturgi-app-repoet (kilden) til dette
# repoets fallback-kopi. CLI-en (konverter-liturgi.mjs) henter normalt
# siste versjon fra GitHub ved kjøring — dette er offline-fallbacken.
set -e
KILDE="$HOME/05 projects/liturgi-app/electron/konverter.cjs"
MAAL="$(cd "$(dirname "$0")/.." && pwd)/scripts/fallback/konverter.cjs"
cp "$KILDE" "$MAAL"
node --check "$MAAL"
echo "fallback-kopi synkronisert: $KILDE -> $MAAL"
