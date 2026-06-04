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

Shared components must remain domain-neutral: a component belongs in `shared/components` only when it can be described without Fidy financial vocabulary. Reusable financial-domain compositions stay feature-owned unless a separate domain-specific shared surface is deliberately introduced. Shared component APIs should prefer semantic props such as `variant`, `tone`, `size`, `leading`, `trailing`, `title`, `subtitle`, and `onPress`; `className` remains an escape hatch for local layout exceptions rather than the primary reuse mechanism.

The first shared UI kit batch is `Button`, `Card`, `Row`, `Chip`, `Callout`, and `EmptyState`. Form fields stayed out of the first wave so the migration could first remove duplicated visual containers, rows, actions, chips, callouts, and empty states without redesigning domain forms at the same time.

The first migration slice is Settings: convert the local settings row pattern to the shared `Row`, then use notification preferences as the second proving ground. Account suggestions and review queues follow because they exercise cards, chips, action buttons, callouts, and empty states with more domain-specific states.

## Consequences

Positive trade-offs: repeated UI patterns move behind shared primitives, migrated screens inherit semantic token changes consistently, and future component reuse has clearer boundaries.

Negative trade-offs: compatibility aliases remain during migration, feature-owned domain cards may still contain local styling, and the first wave intentionally excludes form fields to keep the migration focused.

Enforcement starts at medium strength: tests and source guards should cover the shared primitive exports, semantic token aliases, and migrated slices. Heavy lint-style restrictions against feature-local restyling come last, after enough existing duplicated UI has moved to the shared kit to avoid noisy exemption lists.

## Update: Glass Surface Migration

As of the glass redesign, reusable form and picker surfaces are part of the shared UI kit. The shared surface modules are `GlassSurface`, `FieldSurface`, `Card`, `FormTextField`, `FieldButton`, `FilterTextField`, `FormSection`, `DialogFrame`, `PickerDialog`, `PickerOptionRow`, and the money-entry modules (`MoneyEntryScreen`, `MoneyEntryFieldSurface`, `MoneyEntryTextField`, `MoneyEntryDateButton`).

Surface styling should flow through those modules instead of feature-local `bg-card`, `bg-surface`, `card`, `peachLight`, or `borderSubtle` surface styling. Feature modules may still use direct colors for semantic accent/status states, category colors, chart marks, avatars, icon badges, nav, chat bubbles, and numpad keys because those are not glass container surfaces.

`TextInput` content should not be nested directly inside native liquid glass when that causes rendering or measurement issues. The field modules own the adapter pattern: render the glass frame behind the interactive content, and keep the interactive content transparent above it. This keeps the visual language consistent while preserving text input behavior.

Numpad-based money entry screens should go through `MoneyEntryScreen`; feature modules provide content and actions while the shared module owns amount centering, pinned form stack placement, safe-area padding, and numpad anchoring.
