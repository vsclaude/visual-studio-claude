#!/usr/bin/env bash
# Push every KEY=value in .env to the Cloudflare Worker as a secret.
#
#   scripts/push-secrets.sh             push to the account wrangler is logged in to
#   scripts/push-secrets.sh --dry-run   list the key names only; send nothing
#   scripts/push-secrets.sh path/to/env push a different file
#
# Values go to `wrangler secret put` on stdin, never on the command line and
# never to the terminal, so they do not end up in shell history or `ps`.

set -euo pipefail

cd "$(dirname "$0")/.."

# The config `bun run build` writes; wrangler needs its `name`, and it is not
# at the project root, so every wrangler call is pointed at it.
wrangler_config=".output/server/wrangler.json"
if [[ ! -f "$wrangler_config" ]]; then
  echo "No $wrangler_config — run \`bun run build\` first." >&2
  exit 1
fi

dry_run=0
env_file=".env"
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    *) env_file="$arg" ;;
  esac
done

if [[ ! -f "$env_file" ]]; then
  echo "No such file: $env_file" >&2
  exit 1
fi

pushed=0
skipped=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Drop comments and blank lines, then an optional leading `export `.
  line="${line%%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line#export }"

  if [[ ! "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    echo "skip (not KEY=value): $line" >&2
    skipped=$((skipped + 1))
    continue
  fi

  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  value="${value%"${value##*[![:space:]]}"}"

  # Strip one pair of matching surrounding quotes.
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi

  if [[ -z "$value" ]]; then
    echo "skip (empty): $key" >&2
    skipped=$((skipped + 1))
    continue
  fi

  if [[ "$dry_run" -eq 1 ]]; then
    echo "would push: $key"
  else
    printf '%s' "$value" | bunx wrangler secret put "$key" --config "$wrangler_config" >/dev/null
    echo "pushed: $key"
  fi
  pushed=$((pushed + 1))
done < "$env_file"

if [[ "$dry_run" -eq 1 ]]; then
  echo "dry run: $pushed key(s) would be pushed, $skipped skipped"
else
  echo "done: $pushed key(s) pushed, $skipped skipped"
fi
