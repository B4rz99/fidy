# Mobile UI System

Fidy's mobile UI should stay custom and lightweight: React Native primitives, NativeWind tokens, and small shared components in `apps/mobile/shared/components`.

## Component Rules

- Prefer shared components for repeated product patterns: `ScreenLayout`, `Button`, `Card`, `SettingsSection`, `ProgressBar`, navigation buttons, empty states, and finance rows.
- Keep `shared/components/rn.ts` limited to React Native primitive re-exports and types. Do not export feature components, stores, Expo modules, or heavy runtime dependencies from it.
- Add new shared components only after the same shape appears in more than one screen, or when consistency/accessibility matters.
- Keep cross-feature UI imports on explicit UI surfaces; do not widen pure `public.ts` files with React components.

## Styling Rules

- Use NativeWind `className` for static layout, spacing, typography, color, border radius, and dark-mode tokens.
- Use `StyleSheet` or inline `style` only for computed values, hairline borders, platform-specific values, measurements from hooks, or Reanimated styles.
- Prefer tokens from `tailwind.config.ts` and `shared/constants/theme.ts` over raw color literals in product UI.
- If a style combines many computed values, extract it near the component instead of hiding it in a generic utility.

## Icon Rules

- Import product icons from `@/shared/components/icons`, not directly from icon packages.
- `lucide-react-native` is the default icon library because it covers the current product icon set with one consistent stroke style.
- Keep `@react-native-vector-icons/*` only for platform or provider-specific icons that Lucide does not cover.

## Dependency Rules

- Use `@shopify/flash-list` for long or dynamic lists, not short static settings groups.
- Use `react-native-reanimated` for transform/opacity/progress animations; avoid adding animation libraries with overlapping responsibilities.
- Use `react-native-svg` for charts and custom vector marks.
- Use `expo-image` for remote/user images.
- Use `@expo/ui` selectively for platform widgets such as the SDK 56 date picker.
