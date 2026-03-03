# Coming Soon Screens Design

**Date:** 2026-03-03
**Status:** Approved
**Features:** AI Advisor, Goals

## Overview

Full-screen "Coming Soon" screens for unreleased MVP features (AI Advisor and Goals). Each screen replaces the tab content with a teaser/excitement-building experience that matches the app's existing empty state pattern.

## Approach

**Full-Screen Replacement** — each tab shows a dedicated coming soon screen with feature-specific messaging. Matches the existing GoalsEmpty screen structure (StatusBar, ContentWrapper, BottomNav). One reusable `ComingSoonScreen` component accepts props for customization.

## Screen Structure

```
Screen (393x852, fill: $--bg-page, vertical layout, clip)
  StatusBar (h:62, padding:[0,20])
  ContentWrapper (vertical, gap:16, padding:[0,20,16,20], fill height)
    Header text (Poppins 16/600, $--text-primary)
    EmptyState (vertical, gap:16, center both axes, fill height)
      Icon (64x64, lucide, $--accent-green at 40% alpha)
      Headline (Poppins 18/600, $--text-primary, center)
      Description (Poppins 14/500, $--text-secondary, center, 280px fixed-width)
      "COMING SOON" pill (h:32, radius:9999, fill:$--accent-green, Poppins 12/600, #FFFFFF, letter-spacing:0.05em)
  BottomNav (padding:[12,21,21,21])
    NavPill (h:62, radius:36, fill:$--nav-bg, padding:4)
      [NavItemInactive/Active refs with icon+label overrides]
```

## Content Per Feature

### AI Advisor
- **Header:** "AI Advisor"
- **Icon:** `sparkles` (lucide)
- **Headline:** "Your AI Advisor is on its way"
- **Description:** "Smart insights about your spending, budgets, and savings — powered by AI"
- **Active nav tab:** AI

### Goals
- **Header:** "Goals"
- **Icon:** `target` (lucide)
- **Headline:** "Goals are on their way"
- **Description:** "Set savings targets, track your progress, and reach your financial goals"
- **Active nav tab:** Goals

## Theme Support

All colors use `$--` theme variables for automatic light/dark adaptation:
- Background: `$--bg-page` (light: #FAEBD7, dark: #0D0D0D)
- Text: `$--text-primary`, `$--text-secondary`
- Accent: `$--accent-green` (light: #7CB243, dark: #8BC34A)
- Nav: `$--nav-bg`
- Icon uses green at 40% alpha (#7CB24366) for subtle glow

## Implementation Component

```tsx
// Reusable component: ComingSoonScreen
interface ComingSoonScreenProps {
  icon: string;       // lucide icon name
  headerTitle: string; // screen header
  headline: string;    // teaser headline
  description: string; // feature description
}
```

## Pencil Design References

Screens in `designs/home-screen.pen`:
- `P9aL8` — AIComingSoon-Light
- `j63VS` — GoalsComingSoon-Light
- `6lGeR` — AIComingSoon-Dark
- `ix9aS` — GoalsComingSoon-Dark

## Visual Design Checklist

- [x] Spacing on 8pt grid (16px gaps, 20px padding, 64px icon, 32px pill height)
- [x] Font sizes from app type scale (18px headline, 14px body, 12px caption)
- [x] 60-30-10 color ratio (cream/dark bg, empty space, green accent)
- [x] Border-radius consistent (9999 pill, 36 nav pill)
- [x] Icon size matches GoalsEmpty pattern (64px)
- [x] Dark mode via theme variables
- [x] Uppercase text has letter-spacing (+0.05em)
- [x] Description fixed-width 280px matches existing pattern
