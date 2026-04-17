#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool auto|opencode|codex|claude] [--maintenance] [--prompt-file path] [--progress-file path] [max_iterations]

set -e
set -o pipefail

# Parse arguments
TOOL="auto"
MODE="story"
MAX_ITERATIONS=10
CUSTOM_PROMPT_FILE=""
CUSTOM_PROGRESS_FILE=""
RALPH_WORKTREE_ACTIVE="${RALPH_WORKTREE_ACTIVE:-0}"

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

infer_maintenance_name() {
  local prompt_path="$1"
  local progress_path="$2"
  local combined="${prompt_path} ${progress_path}"

  if [[ "$combined" == *"coverage"* ]]; then
    echo "coverage"
    return
  fi

  if [[ "$combined" == *"entropy"* ]]; then
    echo "entropy"
    return
  fi

  if [[ "$combined" == *"lint"* ]]; then
    echo "lint"
    return
  fi

  echo ""
}

map_path_to_worktree() {
  local source_path="$1"
  local source_root="$2"
  local target_root="$3"

  if [[ -z "$source_path" ]]; then
    echo ""
    return
  fi

  if [[ "$source_path" == "$source_root" || "$source_path" == "$source_root"/* ]]; then
    echo "$target_root${source_path#$source_root}"
    return
  fi

  echo "$source_path"
}

ensure_maintenance_worktree() {
  local branch_name="$1"
  local worktree_path="$2"
  local current_branch
  local worktree_status

  if git -C "$REPO_ROOT" worktree list --porcelain | grep -Fqx "worktree $worktree_path"; then
    current_branch="$(git -C "$worktree_path" branch --show-current)"

    if [[ "$current_branch" != "$branch_name" ]]; then
      echo "Error: Maintenance worktree $worktree_path is on branch '$current_branch', expected '$branch_name'."
      exit 1
    fi

    worktree_status="$(git -C "$worktree_path" status --porcelain)"
    if [[ -n "$worktree_status" ]]; then
      echo "Error: Maintenance worktree $worktree_path has uncommitted changes. Commit or clean it before rerunning Ralph."
      exit 1
    fi

    return
  fi

  if [[ -e "$worktree_path" ]]; then
    echo "Error: Worktree path already exists but is not registered: $worktree_path"
    exit 1
  fi

  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch_name"; then
    git -C "$REPO_ROOT" worktree add "$worktree_path" "$branch_name"
    return
  fi

  git -C "$REPO_ROOT" worktree add -b "$branch_name" "$worktree_path" HEAD
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
if [[ "$TOOL" != "auto" && "$TOOL" != "opencode" && "$TOOL" != "codex" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'auto', 'opencode', 'codex', or 'claude'."
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMMON_GIT_DIR="$(git -C "$REPO_ROOT" rev-parse --git-common-dir)"

if [[ "$COMMON_GIT_DIR" = /* ]]; then
  CANONICAL_REPO_ROOT="$(cd "$COMMON_GIT_DIR/.." && pwd)"
else
  CANONICAL_REPO_ROOT="$(cd "$REPO_ROOT/$COMMON_GIT_DIR/.." && pwd)"
fi

PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
DEFAULT_PROMPT_FILE="$SCRIPT_DIR/AGENTS.md"
OPENCODE_PROMPT_FILE="$SCRIPT_DIR/prompt-opencode.md"
DEFAULT_INSTRUCTIONS_FILE="$SCRIPT_DIR/AGENTS.md"
MAINTENANCE_INSTRUCTIONS_FILE="$SCRIPT_DIR/prompts/AGENTS.md"
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
  if [[ ! -f "$CUSTOM_PROMPT_FILE" ]]; then
    echo "Error: Prompt file not found at $CUSTOM_PROMPT_FILE."
    exit 1
  fi

  MAINTENANCE_PROMPT_FILE=$(mktemp)
  cat "$MAINTENANCE_INSTRUCTIONS_FILE" > "$MAINTENANCE_PROMPT_FILE"
  printf '\n\n## Active Maintenance Prompt\n\n' >> "$MAINTENANCE_PROMPT_FILE"
  cat "$CUSTOM_PROMPT_FILE" >> "$MAINTENANCE_PROMPT_FILE"
  trap '[[ -n "$MAINTENANCE_PROMPT_FILE" && -f "$MAINTENANCE_PROMPT_FILE" ]] && rm -f "$MAINTENANCE_PROMPT_FILE"' EXIT

  INSTRUCTIONS_FILE="$MAINTENANCE_PROMPT_FILE"
  ACTIVE_PROGRESS_FILE="${CUSTOM_PROGRESS_FILE:-$SCRIPT_DIR/maintenance-progress.txt}"
fi

if [[ "$MODE" == "maintenance" && "$RALPH_WORKTREE_ACTIVE" != "1" ]]; then
  MAINTENANCE_NAME="$(infer_maintenance_name "$CUSTOM_PROMPT_FILE" "$ACTIVE_PROGRESS_FILE")"

  if [[ -n "$MAINTENANCE_NAME" ]]; then
    WORKTREE_PARENT="$(dirname "$CANONICAL_REPO_ROOT")"
    WORKTREE_PATH="$WORKTREE_PARENT/$(basename "$CANONICAL_REPO_ROOT")-$MAINTENANCE_NAME"
    ensure_maintenance_worktree "$MAINTENANCE_NAME" "$WORKTREE_PATH"

    WORKTREE_PROMPT_FILE="$(map_path_to_worktree "$CUSTOM_PROMPT_FILE" "$REPO_ROOT" "$WORKTREE_PATH")"
    WORKTREE_PROGRESS_FILE="$(map_path_to_worktree "$ACTIVE_PROGRESS_FILE" "$REPO_ROOT" "$WORKTREE_PATH")"

    echo "Using maintenance worktree: $WORKTREE_PATH"
    echo "Using maintenance branch: $MAINTENANCE_NAME"

    cd "$WORKTREE_PATH"

    exec env RALPH_WORKTREE_ACTIVE=1 \
      "$WORKTREE_PATH/scripts/ralph/ralph.sh" \
      --tool "$TOOL" \
      --maintenance \
      --prompt-file "$WORKTREE_PROMPT_FILE" \
      --progress-file "$WORKTREE_PROGRESS_FILE" \
      "$MAX_ITERATIONS"
  fi
fi

if [[ "$MODE" == "maintenance" ]]; then
  CODEX_PROMPT_FILE="$INSTRUCTIONS_FILE"
else
  CODEX_PROMPT_FILE="${CODEX_PROMPT_FILE:-$INSTRUCTIONS_FILE}"
fi

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

find_opencode_bin() {
  if command -v opencode >/dev/null 2>&1; then
    command -v opencode
    return
  fi

  echo ""
}

resolve_tool() {
  if [[ "$TOOL" != "auto" ]]; then
    echo "$TOOL"
    return
  fi

  if [ -n "$(find_opencode_bin)" ]; then
    echo "opencode"
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

  echo ""
}

TOOL="$(resolve_tool)"

if [[ -z "$TOOL" ]]; then
  echo "Error: No supported runner found on PATH. Install OpenCode, Codex CLI, or Claude Code."
  exit 1
fi

if [[ "$TOOL" == "opencode" ]]; then
  export OPENCODE_PERMISSION='{"*": "allow"}'
  export OPENCODE_DISABLE_AUTOCOMPACT=true
fi

if [[ "$TOOL" == "opencode" ]] && [[ -z "$(find_opencode_bin)" ]]; then
  echo "Error: OpenCode runner requested, but no opencode binary was found."
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

if [[ "$TOOL" == "opencode" && "$MODE" == "story" && -z "$CUSTOM_PROMPT_FILE" ]]; then
  PROMPT_FILE="$OPENCODE_PROMPT_FILE"
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
  local template_file

  if [ ! -f "$target_file" ]; then
    template_file="${target_file%.txt}.template.txt"

    if [ -f "$template_file" ]; then
      cp "$template_file" "$target_file"
      return
    fi

    echo "# Ralph Progress Log" > "$target_file"
    echo "Started: $(date)" >> "$target_file"
    echo "---" >> "$target_file"
  fi
}

initialize_maintenance_files() {
  local progress_file="$1"
  local report_file=""

  initialize_progress_file "$progress_file"

  if [[ "$progress_file" == *"coverage-progress.txt" ]]; then
    report_file="${progress_file%-progress.txt}-report.txt"
  fi

  if [[ -n "$report_file" ]]; then
    initialize_progress_file "$report_file"
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
  initialize_maintenance_files "$ACTIVE_PROGRESS_FILE"
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
  if [[ "$TOOL" == "opencode" ]]; then
    cat "$PROMPT_FILE" | opencode run --agent build - 2>&1 | tee /dev/stderr || true
  elif [[ "$TOOL" == "codex" ]]; then
    run_codex 2>&1 | tee /dev/stderr || true
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
