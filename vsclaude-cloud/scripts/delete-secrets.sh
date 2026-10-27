#!/usr/bin/env bash
# Delete every secret the Cloudflare Worker has — the clean slate before
# `scripts/push-secrets.sh` pushes `.env` again.
#
#   scripts/delete-secrets.sh             delete, after typing the Worker's name
#   scripts/delete-secrets.sh --dry-run   list the secret names only; delete nothing
#   scripts/delete-secrets.sh --yes       delete without asking
#
# The live Worker has no secrets from the first delete until the push: sign-in,
# payments and the webhooks fail in between. Push straight after.

set -euo pipefail

cd "$(dirname "$0")/.."

# The config `bun run build` writes; wrangler needs its `name`.
wrangler_config=".output/server/wrangler.json"
if [[ ! -f "$wrangler_config" ]]; then
  echo "No $wrangler_config — run \`bun run build\` first." >&2
  exit 1
fi

dry_run=0
assume_yes=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --yes) assume_yes=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

worker=$(node -p "require('./$wrangler_config').name")

# `secret list` prints JSON by default: [{ "name": "…", "type": "secret_text" }].
names=$(
  bunx wrangler secret list --config "$wrangler_config" 2>/dev/null |
    node -e '
      let input = ""
      process.stdin.on("data", (chunk) => (input += chunk))
      process.stdin.on("end", () => {
        const start = input.indexOf("[")
        const secrets = start < 0 ? [] : JSON.parse(input.slice(start))
        for (const { name } of secrets) console.log(name)
      })
    '
)

if [[ -z "$names" ]]; then
  echo "The Worker $worker has no secrets."
  exit 0
fi

count=$(printf '%s\n' "$names" | wc -l | tr -d ' ')
echo "The Worker $worker has $count secret(s):"
printf '  %s\n' $names

if [[ "$dry_run" -eq 1 ]]; then
  echo "dry run: nothing deleted"
  exit 0
fi

if [[ "$assume_yes" -ne 1 ]]; then
  read -r -p "Type the Worker's name to delete them all: " typed
  if [[ "$typed" != "$worker" ]]; then
    echo "Not deleted." >&2
    exit 1
  fi
fi

deleted=0
for key in $names; do
  # Stdin from /dev/null makes wrangler non-interactive, where its own
  # "Are you sure?" answers yes — the question was asked once, above.
  bunx wrangler secret delete "$key" --config "$wrangler_config" \
    </dev/null >/dev/null
  echo "deleted: $key"
  deleted=$((deleted + 1))
done

echo "done: $deleted secret(s) deleted from $worker"
