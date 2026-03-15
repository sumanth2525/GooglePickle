# Stitch design system — use this for design

Single source of truth for the Pickleball app UI. All new or updated screens should follow these tokens and patterns.

---

## Colors

| Token | Light | Hex | Usage |
|-------|--------|-----|--------|
| **primary** | Lime | `#80f20d` | CTAs, active states, accents, links |
| **background-light** | Off-white | `#f7f8f5` | Page background (light) |
| **background-dark** | Dark green | `#192210` | Page background (dark) |

**Text**
- Primary text: `text-slate-900` / `dark:text-slate-100`
- Secondary: `text-slate-500` / `dark:text-slate-400`
- Muted: `text-slate-400` / `dark:text-slate-500`

**Primary variants**
- Soft fill: `bg-primary/10`, `bg-primary/20`
- Border: `border-primary/30`, `border-primary/10`, `ring-primary`
- Shadow: `shadow-primary/20`, `shadow-primary/40`

**Surfaces (cards, inputs)**
- Light: `bg-white` + `border-slate-200`
- Dark: `dark:bg-slate-800` + `dark:border-slate-700`

---

## Typography

- **Font:** Inter only. `font-display` or `font-family: 'Inter', sans-serif`
- **Weights:** 400, 500, 600, 700
- **Headings:** `font-bold` + `tracking-tight`; use `text-lg`, `text-xl`, `text-2xl`, `text-3xl` as needed
- **Small labels / badges:** `text-[10px]` or `text-xs` + `font-bold` or `font-semibold` + `uppercase` + `tracking-wider` (or `tracking-widest` for section labels)
- **Body:** `text-sm` or `text-base`, `leading-relaxed` where appropriate

---

## Border radius

- **Default (cards, inputs, buttons):** `rounded-xl` (1rem)
- **Large (hero, big panels):** `rounded-2xl` (2rem) or Tailwind `rounded-lg` (2rem in this config)
- **Pills / full:** `rounded-full`
- Config: `DEFAULT: 1rem`, `lg: 2rem`, `xl: 3rem`, `full: 9999px`

---

## Icons

- **Family:** [Material Symbols Outlined](https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap)
- **Default:** outline (`FILL` 0)
- **Active / selected:** filled (`FILL` 1) — use class `active-icon` or `font-variation-settings: 'FILL' 1`
- **Sizes:** `text-sm`, `text-xl`, `text-2xl`, `text-3xl` as needed

```css
.material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.active-icon {
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

---

## Components

### Page container (mobile-first)
- `max-w-md mx-auto` (448px)
- `min-h-screen` (or `min-height: max(884px, 100dvh)` for fixed-height previews)
- `bg-background-light dark:bg-background-dark`
- Optional: `shadow-xl` or `shadow-2xl` for phone frame

### Sticky header
- `sticky top-0 z-10` (or z-20)
- `bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md`
- `border-b border-slate-200 dark:border-slate-800` or `border-primary/10`
- Padding: `px-4 pt-6 pb-2` or `p-4`

### Cards
- `bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700`
- Inner padding: `p-4`

### Primary button
- `bg-primary hover:bg-primary/90` (or `hover:opacity-90`) `text-slate-900` or `text-background-dark`
- `font-bold py-3 rounded-xl transition-colors`
- `shadow-lg shadow-primary/20`

### Secondary / outline button
- `bg-primary/20 dark:bg-primary/10 border-2 border-primary/30 text-slate-900 dark:text-primary`
- `font-bold rounded-xl active:scale-[0.98] transition-transform`

### Inputs
- `bg-white dark:bg-slate-800 rounded-xl p-4 focus:ring-2 focus:ring-primary border-none shadow-sm`
- Labels: `text-sm font-semibold ml-1`

### Badges / chips
- Primary: `bg-primary/20 text-slate-800 dark:text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider`
- Neutral: `bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300` same typography
- Pill: `rounded-full px-3 py-1` with same text styles

### Bottom navigation
- `fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md`
- `bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800`
- `px-6 pt-2 pb-6` (or pb-8 for safe area)
- Active item: `text-primary` + `active-icon` on icon; inactive: `text-slate-400 dark:text-slate-500`
- FAB (center): `bg-primary size-14 rounded-full shadow-xl shadow-primary/40 border-4 border-background-light dark:border-background-dark` with `-top-6` to lift

### Tabs (under header)
- Container: `flex border-b border-slate-200 dark:border-slate-800`
- Active: `border-b-2 border-primary text-slate-900 dark:text-white font-semibold`
- Inactive: `border-b-2 border-transparent text-slate-400` with `hover:text-slate-600 dark:hover:text-slate-200`

---

## Dark mode

- Use Tailwind `dark:` variants everywhere. Toggle via `class="dark"` on `<html>`.
- All Stitch screens support both `light` and `dark`.

---

## Tailwind config (copy into project)

```js
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#80f20d",
                "background-light": "#f7f8f5",
                "background-dark": "#192210",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            borderRadius: { "DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px" },
        },
    },
}
```

---

## CDN / fonts (HTML head)

```html
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>/* tailwind config above */</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

Body base:
`class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display"`

Use this doc when adding new pages or changing styles so the app stays consistent with the Stitch screens.
