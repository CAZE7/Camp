#!/usr/bin/env bash
set -euo pipefail

# Skript zur sicheren Stapellöschung der 254 verifiziert gemergten Remote-Branches.
# Basis: docs/merged-branch-candidates.txt
#
# Aufruf:
#   ./scripts/maintenance/cleanup-merged-branches.sh --dry-run
#   ./scripts/maintenance/cleanup-merged-branches.sh --execute

CANDIDATES_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docs/merged-branch-candidates.txt"
MODE="${1:-}"

if [[ "$MODE" != "--execute" && "$MODE" != "--dry-run" ]]; then
  echo "Verwendung: $0 [--dry-run | --execute]"
  echo "  --dry-run: Zeigt alle zu löschenden Remote-Branches an, ohne sie zu löschen."
  echo "  --execute: Führt die Löschung auf 'origin' aus."
  exit 1
fi

if [[ ! -f "$CANDIDATES_FILE" ]]; then
  echo "Fehler: Kandidatendatei $CANDIDATES_FILE nicht gefunden."
  exit 1
fi

BRANCHES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  trimmed=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ -n "$trimmed" && ! "$trimmed" =~ ^# ]]; then
    BRANCHES+=("$trimmed")
  fi
done < "$CANDIDATES_FILE"

echo "Gefundene gemergte Branches zur Bereinigung: ${#BRANCHES[@]}"

if [[ "$MODE" == "--dry-run" ]]; then
  echo "=== DRY RUN (keine Änderungen) ==="
  for branch in "${BRANCHES[@]}"; do
    echo "Würde löschen: origin/$branch"
  done
  echo "=== DRY RUN BEENDET: ${#BRANCHES[@]} Branches aufgelistet ==="
  exit 0
fi

if [[ "$MODE" == "--execute" ]]; then
  echo "=== AUSFÜHRUNG: Lösche ${#BRANCHES[@]} Remote-Branches ==="
  BATCH_SIZE=25
  for ((i=0; i<${#BRANCHES[@]}; i+=BATCH_SIZE)); do
    BATCH=("${BRANCHES[@]:i:BATCH_SIZE}")
    echo "Lösche Batch $((i+1)) bis $((i+${#BATCH[@]})) von ${#BRANCHES[@]}..."
    git push origin --delete "${BATCH[@]}" || true
  done
  echo "✔ Bereinigung abgeschlossen."
fi
