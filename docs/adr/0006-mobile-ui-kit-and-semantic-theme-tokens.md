# Mobile UI Kit and Semantic Theme Tokens

## Status

Accepted

## Date

2026-05-29

## Context

Mobile screens have been rebuilding recurring rows, cards, chips, callouts, buttons, and empty states in feature-local components. Those duplicated components also mix descriptive color names, direct theme reads, and local class strings, which makes shared styling harder to change consistently.

The migration needs a small reusable UI kit that standardizes common visual primitives without taking ownership of domain-specific compositions such as budget, goal, notification, and account cards.

## Decision

Fidy will consolidate recurring mobile UI patterns into a small shared UI kit while keeping domain-specific compositions, such as budget, goal, notification, and account cards, feature-owned. Shared UI components should use semantic theme roles and NativeWind `className` tokens for static styling, reserving `useThemeColor()` for icon colors, chart/category colors, alpha-derived values, and native or third-party props that cannot use classes. Existing descriptive color names remain as compatibility aliases during migration, but new shared components should use role-based tokens such as surface, text, border, action, and status roles instead of names tied to a color value or one screen.

The first shared UI kit batch is `Button`, `Card`, `Row`, `Chip`, `Callout`, and `EmptyState`. Form fields stay out of the first wave so the migration can first remove duplicated visual containers, rows, actions, chips, callouts, and empty states without redesigning domain forms at the same time.

The first migration slice is Settings: convert the local settings row pattern to the shared `Row`, then use notification preferences as the second proving ground. Account suggestions and review queues follow because they exercise cards, chips, action buttons, callouts, and empty states with more domain-specific states.

## Consequences

Positive trade-offs: repeated UI patterns move behind shared primitives, migrated screens inherit semantic token changes consistently, and future component reuse has clearer boundaries.

Negative trade-offs: compatibility aliases remain during migration, feature-owned domain cards may still contain local styling, and the first wave intentionally excludes form fields to keep the migration focused.

Enforcement starts at medium strength: tests and source guards should cover the shared primitive exports, semantic token aliases, and migrated slices. Heavy lint-style restrictions against feature-local restyling come last, after enough existing duplicated UI has moved to the shared kit to avoid noisy exemption lists.
