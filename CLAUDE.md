## Agent Notes & Surprises

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in this CLAUDE.md file to help prevent future agents from having the same issue

## Committing Changes

Before committing, use the `committing-changes` skill.

## Tech Stack

This is a greenfield project called Fidy, so you are allowed to use any tool you think is best for solving the problem.

Tools already chosen:
- React Bits
- Zustand
- TanStack Query
- expo-sqlite + SQLCipher
- Drizzle ORM
- Zod
- date-fns

## Code Style: Functional Programming

All code in the financial core (`lib/`, schemas, utils) MUST follow functional programming patterns. Infrastructure edges (stores, hooks, DB clients) are exempt where idiomatic React/Zustand patterns require it.

- No mutable variables (`let`, `var`) in pure logic — use `const` only
- No `.push()` accumulation — use `.map()`, `.filter()`, `.reduce()`, `Array.from()`
- No parameter reassignment — create new `const` bindings instead
- No `while`/`for` loops — use declarative alternatives or recursion
- Separate pure functions from side effects: pure logic in `lib/`, effects in stores/hooks
- Pure functions take all dependencies as parameters (no reaching into module state)
