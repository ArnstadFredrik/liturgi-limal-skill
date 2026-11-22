#!/bin/bash
# Kopierer formatspesifikasjonen fra liturgi-app-repoet hit
set -e
KILDE="$HOME/05 projects/liturgi-app/docs/limal-format.md"
maal="$(cd "$(dirname "$0")/.." && pwd)/references/limal-format.md"
mkdir -p "$(dirname "$maal")"
cp "$KILDE" "$maal"
echo "Synkronisert: $KILDE -> $maal"
