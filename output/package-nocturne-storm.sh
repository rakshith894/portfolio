#!/usr/bin/env bash
set -euo pipefail
export TMPDIR=/e/port/nocturne/work
mkdir -p "$TMPDIR"
rm() {
  if [[ "$#" != 2 || "$1" != -rf ]]; then
    echo 'Unexpected packaging cleanup arguments' >&2
    return 1
  fi
  local target
  target="$(realpath -m -- "$2")"
  case "$target" in
    /e/port/nocturne/work/tmp.*) command rm -rf -- "$target" ;;
    *) echo 'Packaging cleanup escaped its staging directory' >&2; return 1 ;;
  esac
}
export -f rm
bash /c/Users/raksh/.codex/plugins/cache/openai-bundled/sites/0.1.46/scripts/package-site.sh /e/port/nocturne /e/port/nocturne/work/nocturne-storm.tar.gz
