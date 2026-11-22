#!/bin/bash
# Synkroniser konverteringslogikken fra liturgi-app-repoet (kilden) til
# dette repoets CLI-skript. Kjør etter hver endring i electron/konverter.cjs.
set -e
APP="$HOME/05 projects/liturgi-app"
KILDE="$APP/electron/konverter.cjs"
CLI="$(cd "$(dirname "$0")/.." && pwd)/scripts/konverter-liturgi.mjs"

python3 - "$KILDE" "$CLI" << 'PYEOF'
import sys
kilde, cli = sys.argv[1], sys.argv[2]
app = open(kilde, encoding='utf-8').read()

h_start = app.index('const erRubrikkTekst')
h_slutt = app.index('// ---------- docx-parsing')
hjelpere = app[h_start:h_slutt]
b_start = app.index('function byggStruktur')
b_slutt = app.index('/** Konverter docx/pdf')
bygg = app[b_start:b_slutt]

s = open(cli, encoding='utf-8').read()
s = s[:s.index('const erRubrikkTekst')] + hjelpere + s[s.index('// ---------- docx-parsing'):]
g2 = s.index('function byggStruktur')
g2s = s.index('// ---------- valgfri variant-gruppering') if '// ---------- valgfri variant-gruppering' in s else s.index('// ---------- hovedflyt')
s = s[:g2] + bygg + s[g2s:]
open(cli, 'w', encoding='utf-8').write(s)
print('konverter-logikk synkronisert fra', kilde)
PYEOF

node --check "$CLI" && echo "CLI-skript: syntax ok"
