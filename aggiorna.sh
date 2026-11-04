#!/usr/bin/env bash
# Aggiorna il repository della raccolta (webapp-github) partendo dalla libreria
# ~/PROGETTTI_SINGOLI_AZURE/webapp, che resta la copia "master" di ogni app.
#
# L'elenco delle app è UNO solo: le righe «cartella: '...'» dell'elenco APP in index.html.
# Per aggiungere un'app: scrivi la sua voce in index.html, poi lancia  bash aggiorna.sh
#
# Cosa fa:
#   1. copia ogni app da webapp/<cartella>/ a qui, sostituendo la copia precedente
#      (esclusi file di sistema, backup, configurazioni per app e qualsiasi backend);
#   2. si ferma se trova file da server (.php, .sql, cartella api/, config.php):
#      non devono MAI finire su GitHub (contengono le password del database);
#   3. rigenera staticwebapp.config.json, l'unica configurazione Azure del sito;
#   4. avvisa se qui ci sono cartelle che non stanno nell'elenco.
# staticwebapp.config.json è generato da qui: non modificarlo a mano.
# Dopo: prova in locale, poi  git add -A && git commit -m "..." && git push
set -euo pipefail
QUI="$(cd "$(dirname "$0")" && pwd)"
LIBRERIA="$(dirname "$QUI")/webapp"

APP=()
while IFS= read -r riga; do APP+=("$riga"); done < <(
  sed -n "s/^[[:space:]{]*cartella:[[:space:]]*'\([^']*\)'.*/\1/p" "$QUI/index.html")
if [ "${#APP[@]}" -eq 0 ]; then
  echo "✗ Nessuna app trovata nell'elenco APP di index.html" >&2
  exit 1
fi

for nome in "${APP[@]}"; do
  if [ ! -f "$LIBRERIA/$nome/index.html" ]; then
    echo "✗ $nome: manca $LIBRERIA/$nome/index.html" >&2
    exit 1
  fi
  rsync -a --delete --delete-excluded \
    --exclude '.DS_Store' --exclude 'Thumbs.db' --exclude '.git/' --exclude 'node_modules/' \
    --exclude 'staticwebapp.config.json' --exclude 'serve.json' \
    --exclude 'backup/' --exclude '*-copia-*.json' \
    --exclude 'api/' --exclude '*.php' --exclude '*.sql' \
    "$LIBRERIA/$nome/" "$QUI/$nome/"
  echo "✓ $nome: $(find "$QUI/$nome" -type f | wc -l | tr -d ' ') file, $(du -sh "$QUI/$nome" | cut -f1)"
done

# Controllo di sicurezza: niente backend né credenziali nel repository
pericolosi=$(find "$QUI" -path "$QUI/.git" -prune -o \( -name '*.php' -o -name '*.sql' -o -name 'config.php' -o -type d -name api \) -print)
if [ -n "$pericolosi" ]; then
  echo "✗ Trovati file da server che non devono andare su GitHub:" >&2
  echo "$pericolosi" >&2
  exit 1
fi

# Cartelle presenti qui ma non nell'elenco (non vengono cancellate: decidi tu)
for d in "$QUI"/*/; do
  d=$(basename "$d")
  [[ " ${APP[*]} " == *" $d "* ]] || echo "⚠ $d: cartella non presente nell'elenco APP di index.html"
done

# Configurazione Azure Static Web Apps (una sola, nella radice: quelle delle singole app
# avrebbero rimandato gli indirizzi sconosciuti all'indice della raccolta)
python3 -I - "$QUI/staticwebapp.config.json" "${APP[@]}" <<'PY'
import json, sys
import os
destinazione, app = sys.argv[1], sys.argv[2:]
radice = os.path.dirname(destinazione)
# Tutti i service worker, anche quelli annidati (es. scrivo_parole/lettere/): mai in cache HTTP
sw = sorted(
    "/" + os.path.relpath(os.path.join(cartella, "service-worker.js"), radice).replace(os.sep, "/")
    for nome in app
    for cartella, _, file in os.walk(os.path.join(radice, nome))
    if "service-worker.js" in file
)
config = {
    "routes": [
        {"route": percorso, "headers": {"Cache-Control": "no-cache"}}
        for percorso in sw
    ] + [
        {"route": "/aggiorna.sh", "statusCode": 404},
        {"route": "/serve.json", "statusCode": 404},
    ],
    "responseOverrides": {"404": {"rewrite": "/404.html", "statusCode": 404}},
    "mimeTypes": {
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".onnx": "application/octet-stream",
    },
}
with open(destinazione, "w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=4)
    f.write("\n")
# Per la prova in locale con  npx serve :
# - niente URL "puliti" (i service worker mettono in cache i nomi .html veri);
# - barra finale sulle cartelle (senza, i link relativi di /scrivo_parole finirebbero fuori cartella);
# - una cartella apre il suo index.html (con cleanUrls false serve mostrerebbe l'elenco dei file).
#   Le regole valgono solo per nomi senza punto, altrimenti serve le riapplicherebbe a .../index.html
serve = {
    "cleanUrls": False,
    "trailingSlash": True,
    "rewrites": [
        {"source": "/:a([^./]+)/:b([^./]+)", "destination": "/:a/:b/index.html"},
        {"source": "/:a([^./]+)", "destination": "/:a/index.html"},
        {"source": "/", "destination": "/index.html"},
    ],
}
with open(os.path.join(radice, "serve.json"), "w", encoding="utf-8") as f:
    json.dump(serve, f, indent=4)
    f.write("\n")
PY
echo "✓ staticwebapp.config.json e serve.json rigenerati (${#APP[@]} app)"

find "$QUI" -name .DS_Store -delete
echo
echo "Peso delle app: $(du -shc "${APP[@]/#/$QUI/}" | tail -1 | cut -f1)"
echo "Prova in locale:  cd \"$QUI\" && npx serve   (oppure python3 -m http.server 8080)"
