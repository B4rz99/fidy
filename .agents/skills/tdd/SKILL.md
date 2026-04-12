---
name: tdd
description: Test-driven development for Fidy using tracer bullets and vertical slices. Use when building a feature or fixing a bug test-first.
---

# Test-Driven Development

## Philosophy

Tests should verify behavior through public interfaces, not implementation details.
Code can change entirely; the tests should still describe the same capability.

Good tests:

- exercise real behavior through a public seam
- read like a spec for one capability
- survive internal refactors

Bad tests:

- mock internal collaborators by default
- verify private structure
- fail when implementation changes but behavior does not

## Anti-Pattern: Horizontal Slices

Do not write all tests first and then all implementation.

That causes speculative tests, weak feedback, and too much commitment before the
shape of the code is real.

Wrong:

- RED: test1, test2, test3
- GREEN: impl1, impl2, impl3

Right:

- RED -> GREEN: test1 -> impl1
- RED -> GREEN: test2 -> impl2
- RED -> GREEN: test3 -> impl3

## Workflow

### 1. Lock The Behavior

Before writing code:

- confirm the public interface that is changing
- list the important behaviors in priority order
- pick the first tracer bullet

### 2. Tracer Bullet

Write one failing test for one important behavior.

Then write the minimum code required to make that one test pass.

### 3. Repeat

For each next behavior:

- write one failing test
- make it pass with the minimum code
- stop before implementing extra behavior

### 4. Refactor On Green

Only refactor after the current test set is green.

Refactor goals:

- remove duplication
- deepen modules behind simple interfaces
- keep pure logic separate from effects

## Fidy Test Selection

Choose the narrowest public seam that proves the behavior:

- pure `lib/`, `derive.ts`, and helpers: direct unit tests
- repositories: repository-level tests, not raw SQL assertions
- stores/hooks: assert observable state transitions
- components/screens: assert user-visible behavior, not internals

## Project Rules

- One test at a time
- One behavior at a time
- No speculative implementation
- No refactor while red
- Prefer targeted test runs while iterating
- Run `bun run test` and `bun run typecheck` before calling the slice done

## Known Fidy Gotcha

Do not add async `importOriginal` global mocks in Vitest setup for heavy modules
like `date-fns`. They create cross-worker contention and intermittent timeouts.
