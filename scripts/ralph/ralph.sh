#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool auto|codex|amp|claude] [--maintenance] [--prompt-file path] [--progress-file path] [max_iterations]

set -e
set -o pipefail

# Parse arguments
TOOL="auto"
MODE="story"
MAX_ITERATIONS=10
CUSTOM_PROMPT_FILE=""
CUSTOM_PROGRESS_FILE=""

resolve_path() {
  local input_path="$1"

  if [[ -z "$input_path" ]]; then
    echo ""
  elif [[ "$input_path" = /* ]]; then
    echo "$input_path"
  else
    echo "$PWD/$input_path"
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    --maintenance)
      MODE="maintenance"
      shift
      ;;
    --prompt-file)
      CUSTOM_PROMPT_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --prompt-file=*)
      CUSTOM_PROMPT_FILE="$(resolve_path "${1#*=}")"
      shift
      ;;
    --progress-file)
      CUSTOM_PROGRESS_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --progress-file=*)
      CUSTOM_PROGRESS_FILE="$(resolve_path "${1#*=}")"
      shift
      ;;
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "auto" && "$TOOL" != "codex" && "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'auto', 'codex', 'amp', or 'claude'."
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
DEFAULT_PROMPT_FILE="$SCRIPT_DIR/prompt.md"
DEFAULT_INSTRUCTIONS_FILE="$SCRIPT_DIR/AGENTS.md"
PROMPT_FILE="${CUSTOM_PROMPT_FILE:-$DEFAULT_PROMPT_FILE}"
INSTRUCTIONS_FILE="$DEFAULT_INSTRUCTIONS_FILE"
ACTIVE_PROGRESS_FILE="$PROGRESS_FILE"
CODEX_CMD="${CODEX_CMD:-}"
CODEX_BIN="${CODEX_BIN:-}"

if [[ "$MODE" == "maintenance" ]]; then
  if [[ -z "$CUSTOM_PROMPT_FILE" ]]; then
    echo "Error: Maintenance mode requires --prompt-file."
    exit 1
  fi

  INSTRUCTIONS_FILE="$CUSTOM_PROMPT_FILE"
  ACTIVE_PROGRESS_FILE="${CUSTOM_PROGRESS_FILE:-$SCRIPT_DIR/maintenance-progress.txt}"
fi

CODEX_PROMPT_FILE="${CODEX_PROMPT_FILE:-$INSTRUCTIONS_FILE}"

find_codex_bin() {
  if [ -n "$CODEX_BIN" ] && [ -x "$CODEX_BIN" ]; then
    echo "$CODEX_BIN"
    return
  fi

  if command -v codex >/dev/null 2>&1; then
    command -v codex
    return
  fi

  if [ -x "/Applications/Codex.app/Contents/Resources/codex" ]; then
    echo "/Applications/Codex.app/Contents/Resources/codex"
    return
  fi

  echo ""
}

resolve_tool() {
  if [[ "$TOOL" != "auto" ]]; then
    echo "$TOOL"
    return
  fi

  if [ -n "$(find_codex_bin)" ]; then
    echo "codex"
    return
  fi

  if command -v claude >/dev/null 2>&1; then
    echo "claude"
    return
  fi

  if command -v amp >/dev/null 2>&1; then
    echo "amp"
    return
  fi

  echo ""
}

TOOL="$(resolve_tool)"

if [[ -z "$TOOL" ]]; then
  echo "Error: No supported runner found on PATH. Install Codex CLI, Claude Code, or Amp."
  exit 1
fi

if [[ "$TOOL" == "codex" ]]; then
  CODEX_BIN="$(find_codex_bin)"
  if [[ -z "$CODEX_BIN" ]]; then
    echo "Error: Codex runner requested, but no Codex binary was found."
    echo "Set CODEX_BIN or install Codex CLI, or use the macOS app bundle path."
    exit 1
  fi
fi

if [[ "$TOOL" == "amp" && ! -f "$PROMPT_FILE" ]]; then
  PROMPT_FILE="$INSTRUCTIONS_FILE"
fi

check_prd_completion() {
  local remaining_stories

  if [ ! -f "$PRD_FILE" ]; then
    echo "Warning: Missing PRD file at $PRD_FILE. Treating run as incomplete."
    return 1
  fi

  if ! remaining_stories="$(jq '.userStories[]? | select(.passes == false) | { id, title }' "$PRD_FILE" 2>/dev/null)"; then
    echo "Warning: Unable to parse $PRD_FILE. Treating run as incomplete."
    return 1
  fi

  [ -z "$remaining_stories" ]
}

run_codex() {
  if [ ! -f "$CODEX_PROMPT_FILE" ]; then
    echo "Error: Missing Codex prompt file at $CODEX_PROMPT_FILE."
    return 1
  fi

  if [ -n "$CODEX_CMD" ]; then
    cat "$CODEX_PROMPT_FILE" | bash -lc "$CODEX_CMD"
    return
  fi

  cat "$CODEX_PROMPT_FILE" | "$CODEX_BIN" exec - \
    --dangerously-bypass-approvals-and-sandbox \
    --color never \
    -C "$REPO_ROOT"
}

initialize_progress_file() {
  local target_file="$1"

  if [ ! -f "$target_file" ]; then
    echo "# Ralph Progress Log" > "$target_file"
    echo "Started: $(date)" >> "$target_file"
    echo "---" >> "$target_file"
  fi
}

if [[ "$MODE" == "story" ]]; then
  # Archive previous run if branch changed
  if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
    
    if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
      # Archive the previous run
      DATE=$(date +%Y-%m-%d-%H%M%S)
      # Strip "ralph/" prefix from branch name for folder
      FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
      ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

      # Guard against multiple archives for the same branch in the same second.
      if [ -e "$ARCHIVE_FOLDER" ]; then
        SUFFIX=1
        while [ -e "${ARCHIVE_FOLDER}-${SUFFIX}" ]; do
          SUFFIX=$((SUFFIX + 1))
        done
        ARCHIVE_FOLDER="${ARCHIVE_FOLDER}-${SUFFIX}"
      fi

      echo "Archiving previous run: $LAST_BRANCH"
      mkdir -p "$ARCHIVE_FOLDER"
      [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
      echo "   Archived to: $ARCHIVE_FOLDER"

      # Reset progress file for new run
      echo "# Ralph Progress Log" > "$PROGRESS_FILE"
      echo "Started: $(date)" >> "$PROGRESS_FILE"
      echo "---" >> "$PROGRESS_FILE"
    fi
  fi

  # Track current branch
  if [ -f "$PRD_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    if [ -n "$CURRENT_BRANCH" ]; then
      echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
    fi
  fi

  initialize_progress_file "$PROGRESS_FILE"

  if check_prd_completion; then
    echo "Ralph has no remaining tasks. All stories already pass in $PRD_FILE."
    exit 0
  fi
else
  initialize_progress_file "$ACTIVE_PROGRESS_FILE"
fi

echo "Starting Ralph - Mode: $MODE - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"

if [ "$MAX_ITERATIONS" -le 0 ]; then
  echo "Nothing to do: max iterations is $MAX_ITERATIONS."
  exit 0
fi

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  # Run the selected tool with the ralph prompt
  if [[ "$TOOL" == "codex" ]]; then
    run_codex 2>&1 | tee /dev/stderr || true
  elif [[ "$TOOL" == "amp" ]]; then
    cat "$PROMPT_FILE" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr || true
  else
    # Claude Code: use --dangerously-skip-permissions for autonomous operation, --print for output
    claude --dangerously-skip-permissions --print < "$INSTRUCTIONS_FILE" 2>&1 | tee /dev/stderr || true
  fi
  
  # Check PRD completion after each iteration.
  if [[ "$MODE" == "story" ]] && check_prd_completion; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    echo "Branch is ready for the full-branch finalization step (for example, /opening-mr)."
    exit 0
  fi
  
  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
if [[ "$MODE" == "story" ]]; then
  echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
else
  echo "Ralph reached max iterations ($MAX_ITERATIONS) in maintenance mode."
fi
echo "Check $ACTIVE_PROGRESS_FILE for status."
exit 1
