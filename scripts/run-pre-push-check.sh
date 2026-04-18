#!/bin/sh

set -eu

check_name="$1"

case "$check_name" in
  root-biome)
    bun run lint
    ;;
  mobile-eslint)
    bun run lint:mobile
    ;;
  mobile-typecheck)
    bun run typecheck
    ;;
  tests)
    bun run test
    ;;
  *)
    echo "Unknown pre-push check: $check_name" >&2
    exit 1
    ;;
esac
