---
name: adding-i18n-strings
description: Use when adding user-facing strings to components or lib/ functions, implementing plurals or string interpolation, or formatting locale-aware dates in Fidy.
---

# i18n Guide (expo-localization + i18n-js)

## Overview

Spanish-first, English-fallback. All user-facing strings go through the i18n system — never hardcode strings in components or lib/.

## Quick Reference

| Need | Solution |
|------|----------|
| Translate in a component | `const { t, locale } = useTranslation()` from `shared/hooks/use-translation.ts` |
| Category label | `getCategoryLabel(category, locale)` from `shared/i18n/locale-helpers.ts` |
| Date with locale | `format(date, "MMM d", { locale: getDateFnsLocale(locale) })` |
| Add new string | Both `es.ts` and `en.ts` — parity enforced by key-parity test |
| Pure lib/ function with string output | Accept `t` as a param, never import i18n directly |
| Key format | Dot-separated: `"section.key"` e.g. `"bills.addBill"`, `"common.save"` |

## Patterns

**Plurals:**
```ts
// shared/i18n/locales/es.ts
transactions: { one: "1 transacción", other: "%{count} transacciones" }

// Usage
t("transactions", { count: n })
```

**Interpolation:**
```ts
// shared/i18n/locales/es.ts
greeting: "Hola, %{name}"

// Usage
t("greeting", { name: "Orlando" })
```

**FREQUENCIES (calendar schema):**
```ts
// features/calendar/schema.ts — uses labelKey, not label
FREQUENCIES.map(freq => t(freq.labelKey))
```

## Common Mistakes

- Hardcoding a string in a component instead of calling `t()`
- Adding a key to only one locale file — breaks the key-parity test
- Importing i18n directly inside `lib/` — pure functions must accept `t` as a parameter
- Calling `format(date, pattern)` without `{ locale: getDateFnsLocale(locale) }`
