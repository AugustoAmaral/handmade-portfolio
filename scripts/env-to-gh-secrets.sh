#!/usr/bin/env bash
# Push every KEY="VALUE" line of a .env file to GitHub Actions repository secrets.
#
# Usage: scripts/env-to-gh-secrets.sh [-f path/to/.env] [-R owner/repo] [-n]
#   -f  env file to read (default: .env in the current directory)
#   -R  target repo; defaults to the repo of the current git checkout (gh's default)
#   -n  dry run: print which keys would be set, never call `gh secret set`
#
# Requires `gh` authenticated with a token that can write repo secrets.
# Values are piped to gh via stdin so they never appear in the process list.
set -euo pipefail

usage() {
  sed -n '2,9p' "$0" >&2
  exit 1
}

env_file=".env"
repo=""
dry_run=0
while getopts "f:R:nh" opt; do
  case "$opt" in
    f) env_file=$OPTARG ;;
    R) repo=$OPTARG ;;
    n) dry_run=1 ;;
    *) usage ;;
  esac
done

[ -r "$env_file" ] || { echo "error: cannot read '$env_file'" >&2; exit 1; }
command -v gh >/dev/null || { echo "error: gh not found on PATH" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "error: gh is not authenticated (run: gh auth login)" >&2; exit 1; }

repo_args=()
[ -n "$repo" ] && repo_args=(-R "$repo")

set_count=0
skip_count=0
while IFS= read -r line || [ -n "$line" ]; do
  # blank lines and comments
  if [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]]; then
    continue
  fi
  # KEY="VALUE" (optional leading `export`); everything between the outer quotes is the value
  if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=\"(.*)\"[[:space:]]*$ ]]; then
    key=${BASH_REMATCH[2]}
    value=${BASH_REMATCH[3]}
  else
    echo "skip: line not in KEY=\"VALUE\" form: ${line%%=*}" >&2
    skip_count=$((skip_count + 1))
    continue
  fi
  if [ -z "$value" ]; then
    echo "skip: $key has an empty value" >&2
    skip_count=$((skip_count + 1))
    continue
  fi

  if (( dry_run )); then
    echo "would set $key (${#value} chars)"
  else
    printf '%s' "$value" | gh secret set "$key" ${repo_args[@]+"${repo_args[@]}"}
    echo "set $key"
  fi
  set_count=$((set_count + 1))
done < "$env_file"

if (( dry_run )); then
  echo "done: $set_count secret(s) would be set, $skip_count skipped"
else
  echo "done: $set_count secret(s) set, $skip_count skipped"
fi
