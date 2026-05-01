#!/bin/sh

set -eu

check_name="$1"

case "$check_name" in
  root-biome)
    bun run lint
    ;;
  branded-boundaries)
    bun run lint:brands
    ;;
  mobile-eslint)
    bun run lint:mobile
    ;;
  mobile-typecheck)
    bun run typecheck
    ;;
  complexity)
    bun run lint:complexity
    ;;
  file-size)
    bun run lint:file-size
    ;;
  tests)
    bun run test
    ;;
  *)
    echo "Unknown pre-push check: $check_name" >&2
    exit 1
    ;;
esac
