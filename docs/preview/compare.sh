#!/usr/bin/env bash
# Build two versions of zebramed.bio and show them side by side, scroll-synced.
#
#   docs/preview/compare.sh                         refactor/2026-10 | restyle/2026-10
#   docs/preview/compare.sh main restyle/2026-10    any two branches, tags or commits
#   docs/preview/compare.sh . restyle/2026-10       "." = this working tree, rebuilt as you save
#   docs/preview/compare.sh --prod                  as the public site (pending items hidden)
#   docs/preview/compare.sh --clean                 remove the worktrees and builds it made
#
# Committed versions are checked out into git worktrees under
# ~/.cache/zebramed-compare, so your own checkout is never touched.
# Opens http://127.0.0.1:4000 (PORT=... to change; it also uses PORT+1 and
# PORT+2; NO_OPEN=1 to skip the browser). Ctrl+C stops everything.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HERE="$ROOT/docs/preview"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/zebramed-compare"
PORT="${PORT:-4000}"
JEKYLL_ENV_NAME=development
REFS=()

for arg in "$@"; do
  case "$arg" in
    --prod) JEKYLL_ENV_NAME=production ;;
    --clean)
      for wt in "$CACHE"/wt-*; do
        [ -d "$wt" ] && git -C "$ROOT" worktree remove --force "$wt"
      done
      git -C "$ROOT" worktree prune
      rm -rf -- "${CACHE:?}"
      echo "Removed $CACHE"
      exit 0 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
    *) REFS+=("$arg") ;;
  esac
done
LEFT="${REFS[0]:-refactor/2026-10}"
RIGHT="${REFS[1]:-restyle/2026-10}"

# bundle/jekyll from the user gem directory, as in the README's serve command
if command -v ruby >/dev/null; then
  GEM_BIN="$(ruby -e 'print Gem.user_dir')/bin"
  [ -d "$GEM_BIN" ] && PATH="$GEM_BIN:$PATH"
fi
export RUBYOPT="-W0"   # silences Ruby's stdlib deprecation notices from Jekyll

mkdir -p "$CACHE"
WATCHERS=()
trap '[ ${#WATCHERS[@]} -eq 0 ] || kill "${WATCHERS[@]}" 2>/dev/null' EXIT

# side ref -> prints the folder Jekyll should build from
source_for() {
  local side=$1 ref=$2 wt="$CACHE/wt-$1"
  if [ "$ref" = "." ]; then echo "$ROOT"; return; fi
  if ! git -C "$ROOT" rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
    echo "Unknown branch or commit: $ref" >&2; exit 1
  fi
  if [ -d "$wt" ]; then
    git -C "$wt" checkout --quiet --force --detach "$ref"
  else
    git -C "$ROOT" worktree add --quiet --force --detach "$wt" "$ref" >/dev/null
  fi
  echo "$wt"
}

describe() {
  if [ "$1" = "." ]; then
    echo "working tree on $(git -C "$ROOT" branch --show-current), uncommitted changes included"
  else
    git -C "$ROOT" log -1 --format='%h %s' "$1"
  fi
}

build() {  # side ref
  local side=$1 ref=$2 src dest="$CACHE/site-$1"
  src="$(source_for "$side" "$ref")"
  echo "Building $side: $ref ($JEKYLL_ENV_NAME)"
  (cd "$ROOT" && JEKYLL_ENV=$JEKYLL_ENV_NAME bundle exec jekyll build --quiet --source "$src" --destination "$dest")
  if [ "$ref" = "." ]; then
    (cd "$ROOT" && JEKYLL_ENV=$JEKYLL_ENV_NAME bundle exec jekyll build --quiet --watch --source "$src" --destination "$dest" >/dev/null 2>&1) &
    WATCHERS+=($!)
  fi
}

build left "$LEFT"
build right "$RIGHT"

name_for() { if [ "$1" = "." ]; then echo "working tree"; else echo "$1"; fi; }
OPEN_FLAG=()
[ -n "${NO_OPEN:-}" ] && OPEN_FLAG=(--no-open)

python3 "$HERE/compare/server.py" \
  --left "$CACHE/site-left" --right "$CACHE/site-right" \
  --left-name "$(name_for "$LEFT")" --right-name "$(name_for "$RIGHT")" \
  --left-ref "$(describe "$LEFT")" --right-ref "$(describe "$RIGHT")" \
  --port "$PORT" "${OPEN_FLAG[@]}"
