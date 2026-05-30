# Mobile UI Kit and Semantic Theme Tokens

Fidy will consolidate recurring mobile UI patterns into a small shared UI kit while keeping domain-specific compositions, such as budget, goal, notification, and account cards, feature-owned. Shared UI components should use semantic theme roles and NativeWind `className` tokens for static styling, reserving `useThemeColor()` for icon colors, chart/category colors, alpha-derived values, and native or third-party props that cannot use classes. Existing descriptive color names remain as compatibility aliases during migration, but new shared components should use role-based tokens such as surface, text, border, action, and status roles instead of names tied to a color value or one screen.

The first shared UI kit batch is `Button`, `Card`, `Row`, `Chip`, `Callout`, and `EmptyState`. Form fields stay out of the first wave so the migration can first remove duplicated visual containers, rows, actions, chips, callouts, and empty states without redesigning domain forms at the same time.

The first migration slice is Settings: convert the local settings row pattern to the shared `Row`, then use notification preferences as the second proving ground. Account suggestions and review queues follow because they exercise cards, chips, action buttons, callouts, and empty states with more domain-specific states.

Enforcement starts at medium strength: tests and source guards should cover the shared primitive exports, semantic token aliases, and migrated slices. Heavy lint-style restrictions against feature-local restyling come last, after enough existing duplicated UI has moved to the shared kit to avoid noisy exemption lists.
