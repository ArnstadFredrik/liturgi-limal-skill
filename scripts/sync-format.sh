#!/bin/bash
# Henter formatspesifikasjonen fra liturgi-app-repoet (GitHub) og
# oppdaterer referanse-kopien her. Kjør ved vedlikehold av skill-repoet.
set -e
BASE="https://raw.githubusercontent.com/ArnstadFredrik/liturgi-app/main"
maal="$(cd "$(dirname "$0")/.." && pwd)/references/limal-format.md"
mkdir -p "$(dirname "$maal")"
curl -fsSL "$BASE/docs/limal-format.md" -o "$maal"
echo "Hentet fra GitHub: $BASE/docs/limal-format.md -> $maal"
