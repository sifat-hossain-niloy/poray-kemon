# ADR-006: Tailwind CSS 4 + shadcn/ui

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

We need a UI styling approach that:

- Renders Bangla Unicode correctly on all major browsers
- Works well on mobile (44px touch targets, responsive layout)
- Provides accessible components out of the box (keyboard navigation, ARIA)
- Doesn't require fighting a component library to customize for Bangla typography

---

## Decision

Use **Tailwind CSS 4** for styling and **shadcn/ui** for base UI components.

---

## Rationale

### Why Tailwind

- **Bangla text rendering** — Tailwind's typography utilities (`font-normal`, `leading-relaxed`, `tracking-normal`) work well with Bangla Unicode fonts (Hind Siliguri, Noto Sans Bengali)
- **Utility-first** — no style conflicts, no specificity wars, predictable output
- **Mobile-first** — responsive prefixes (`md:`, `lg:`) encourage mobile-first design
- **No dead CSS** — Tailwind 4's new engine is fully on-demand with zero unused styles in production

### Why shadcn/ui over other component libraries

| Library           | Customizable              | Bangla-friendly | Accessible    | Bundle  |
| ----------------- | ------------------------- | --------------- | ------------- | ------- |
| shadcn/ui         | Full control (copy-paste) | ✅              | ✅ (Radix UI) | Minimal |
| MUI (Material UI) | Difficult                 | ⚠️              | ✅            | Large   |
| Mantine           | Good                      | ✅              | ✅            | Medium  |
| Chakra UI         | Good                      | ✅              | ✅            | Medium  |
| Ant Design        | Difficult                 | ⚠️              | ✅            | Large   |

shadcn/ui is not a dependency — it's copy-paste components built on **Radix UI** primitives. This means:

- We own the code — no version mismatches
- We can modify any component to add Bangla labels, custom star ratings, etc.
- Zero bundle overhead from unused components
- Radix UI handles all accessibility (keyboard navigation, screen readers, ARIA)

### Bangla font setup

```css
/* app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&display=swap');

:root {
  --font-bangla: 'Hind Siliguri', sans-serif;
}

body {
  font-family: var(--font-bangla), system-ui, sans-serif;
}
```

---

## Consequences

**Positive:**

- Consistent design system with design tokens (CSS variables for colors, spacing)
- Components like Dialog, Select, Dropdown, Toast come with full keyboard support
- Dark mode support built into shadcn/ui via CSS variables (future feature)
- Tailwind 4 with Vite engine is significantly faster than Tailwind 3

**Negative:**

- shadcn/ui components are copied into the codebase — updates require manual re-copying
- Learning curve for developers new to Tailwind's utility-first approach
- Star rating input requires a custom component (not in shadcn/ui by default)

**Constraints:**

- Minimum touch target: 44×44px (per SRS NFR-UX-02) — enforce with `min-h-[44px] min-w-[44px]`
- All interactive elements must have visible focus rings — never `outline-none` without a custom focus style
- Bangla text must use `font-siliguri` class; English content can use system font
