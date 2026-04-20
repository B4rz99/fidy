#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
PYTHON_BIN=${PYTHON_BIN:-python3}
VENV_DIR="$ROOT_DIR/.cache/lizard"
REQUIREMENTS_FILE="$ROOT_DIR/scripts/lizard-requirements.txt"
REPORT_DIR="$ROOT_DIR/.context/reports/lizard/strict"
SUMMARY_SCRIPT="$ROOT_DIR/scripts/summarize_lizard.py"
REQUIREMENTS_HASH_FILE="$VENV_DIR/.requirements.sha256"
LEDGER_PATH="$ROOT_DIR/plans/lizard-complexity-debt.json"
STRICT_CCN=5
STRICT_NLOC=30
STRICT_PARAMS=3
WRITE_LEDGER=false

if [ "${1:-}" = "--write-ledger" ]; then
  WRITE_LEDGER=true
  shift
fi

if [ "$#" -eq 0 ]; then
  set -- apps/mobile apps/landing packages
fi

mkdir -p "$REPORT_DIR"

ensure_lizard() {
  if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    echo "python3 is required to run Lizard." >&2
    exit 1
  fi

  if [ ! -x "$VENV_DIR/bin/python" ]; then
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  fi

  required_hash=$(shasum -a 256 "$REQUIREMENTS_FILE" | awk '{print $1}')
  current_hash=""
  if [ -f "$REQUIREMENTS_HASH_FILE" ]; then
    current_hash=$(cat "$REQUIREMENTS_HASH_FILE")
  fi

  if [ "$required_hash" != "$current_hash" ] || ! "$VENV_DIR/bin/python" -c "import lizard" >/dev/null 2>&1; then
    "$VENV_DIR/bin/python" -m pip install --quiet --disable-pip-version-check -r "$REQUIREMENTS_FILE"
    printf '%s' "$required_hash" > "$REQUIREMENTS_HASH_FILE"
  fi
}

ensure_lizard

LIZARD_BIN="$VENV_DIR/bin/lizard"
VERSION=$("$LIZARD_BIN" --version)
TEXT_REPORT="$REPORT_DIR/strict.txt"
CSV_REPORT="$REPORT_DIR/strict.csv"
WARNINGS_REPORT="$REPORT_DIR/strict-warnings.txt"
SUMMARY_MARKDOWN="$REPORT_DIR/strict-summary.md"
SUMMARY_JSON="$REPORT_DIR/strict-summary.json"

STRICT_ARGS="
  -l javascript
  -l typescript
  -C $STRICT_CCN
  -L $STRICT_NLOC
  -a $STRICT_PARAMS
"

# The hard gate is enforced by the checked-in debt ledger. Lizard's own exit code
# is ignored here so we can always emit reports before comparing against the ledger.
"$LIZARD_BIN" $STRICT_ARGS "$@" > "$TEXT_REPORT" || true
"$LIZARD_BIN" $STRICT_ARGS --csv "$@" > "$CSV_REPORT" || true
"$LIZARD_BIN" $STRICT_ARGS -w "$@" > "$WARNINGS_REPORT" || true

"$VENV_DIR/bin/python" "$SUMMARY_SCRIPT" \
  --csv "$CSV_REPORT" \
  --markdown "$SUMMARY_MARKDOWN" \
  --json "$SUMMARY_JSON" \
  --version "$VERSION" \
  --ccn-threshold "$STRICT_CCN" \
  --nloc-threshold "$STRICT_NLOC" \
  --parameter-threshold "$STRICT_PARAMS" \
  $(printf '%s\n' "$@" | sed 's/^/--target /')

if [ "$WRITE_LEDGER" = true ]; then
  bun scripts/check-lizard-complexity.ts --csv "$CSV_REPORT" --ledger "$LEDGER_PATH" --write-ledger
  printf 'Lizard strict debt ledger written to %s\n' "$LEDGER_PATH"
else
  bun scripts/check-lizard-complexity.ts --csv "$CSV_REPORT" --ledger "$LEDGER_PATH"
fi

printf 'Lizard strict report written to %s\n' "$REPORT_DIR"
