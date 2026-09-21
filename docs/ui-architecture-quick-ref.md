# UI Architecture: Quick Reference

**Quick lookup for common patterns and rules.** See `ui-architecture-design.md` for full guidance.

---

## Spacing Scale (8px Modular)

| Value | Pixels | Use |
|-------|--------|-----|
| `0` | 0 | Reset |
| `1` | 8px | Tight spacing (button padding) |
| `2` | 16px | **Default** panel padding |
| `3` | 24px | Section padding, gap between groups |
| `4` | 32px | Large gaps, container padding |
| `6` | 48px | Generous spacing, page sections |
| `8` | 64px | Very large spacing |

✅ **Always use:** `p-2`, `gap-2`, `p-4`, `gap-4`, `p-6`  
❌ **Never use:** `p-3`, `gap-3.5`, `p-[13px]`

---

## Responsive Breakpoints

```
Mobile      Tablet      Desktop      Large Desktop
──────┬────────────┬────────────────┬──────────
  md: max-width 767px
  md: min-width 768px, max-width 1023px (tablet)
  lg: min-width 1024px (desktop+)
```

**Usage:**

```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Mobile: 100%, Tablet: 50%, Desktop: 33% */}
</div>
```

---

## Layout: Mobile → Tablet → Desktop

### Mobile (< 768px)

- ✅ Single column, full width
- ✅ Sidebar as drawer overlay (hamburger)
- ✅ Content tabs if needed (PDF/Source)

```tsx
<div className="flex flex-col h-screen">
  <header className="md:hidden">☰</header>
  <main className="flex-1 overflow-y-auto">{children}</main>
</div>
```

### Tablet (768px–1023px)

- ✅ 2-column: sidebar (drawer) + editor (left) + result (right)
- ✅ Or: sidebar hidden, editor + result visible

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <aside className="hidden md:block">Sidebar (drawer on trigger)</aside>
  <main className="md:col-span-1">Editor</main>
  <section className="md:col-span-1">Result</section>
</div>
```

### Desktop (1024px+)

- ✅ 3-column: sidebar + editor + result, all visible

```tsx
<div className="grid grid-cols-12 gap-4">
  <aside className="col-span-3">Sidebar</aside>
  <main className="col-span-6">Editor</main>
  <section className="col-span-3">Result</section>
</div>
```

---

## Grid vs. Flex: When to Use

| Use Case | Grid | Flex |
|----------|------|------|
| 2D layouts (rows + columns) | ✅ | ❌ |
| 1D list (stacking) | ❌ | ✅ |
| Document sidebar + 3 panes | ✅ | ❌ (use grid) |
| Horizontal button row | ❌ | ✅ |
| Card list (vertical stack) | ❌ | ✅ (use `flex-col`) |

---

## Scrollable Content: Golden Pattern

```tsx
<div className="flex flex-col h-full">
  <header className="flex-shrink-0 px-4 py-3 border-b">
    {/* Header: doesn't shrink, always visible */}
  </header>
  
  <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
    {/* Content: fills remaining space, scrolls if overflows */}
    {/* min-h-0 is CRITICAL: allows flex child to shrink below content */}
  </div>
</div>
```

---

## Glass Effect: Rules

✅ **Use glass on:**
- Floating overlays (modals, dropdowns)
- Header/navbar over background image
- Spacious cards (`p-4+`, `gap-3+`)

❌ **Don't use glass on:**
- Dense form inputs (`p-2`)
- Chat bubbles (tight)
- Tables/grids
- Mobile devices with tight spacing

**Smart glass:** Use Tailwind breakpoint utilities:
```tsx
<div className="bg-card lg:glass">
  {/* Mobile: solid card, Desktop: glass effect */}
</div>
```

---

## Drawer Sidebar: Pattern

```tsx
"use client";

const [open, setOpen] = useState(false);

return (
  <>
    <button onClick={() => setOpen(!open)} className="md:hidden">
      ☰ Menu
    </button>

    {/* Overlay */}
    {open && <div className="fixed inset-0 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

    {/* Drawer */}
    <aside className={cn(
      "fixed md:static left-0 top-0 h-screen w-64",
      "transition-transform",
      open ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Sidebar content */}
    </aside>
  </>
);
```

---

## Common Mistakes

| ❌ Don't | ✅ Do | Why |
|---------|-------|-----|
| `<div className="h-screen flex"><main className="h-full overflow-y-auto">` | `<div className="flex flex-col h-screen"><main className="flex-1 overflow-y-auto min-h-0">` | `min-h-0` required on flex child to enable shrinking + scroll |
| `gap-3 md:gap-5 lg:gap-7` | `gap-2 md:gap-4 lg:gap-6` | Stay on 8px scale (no off-scale values like gap-5) |
| `<aside className="w-64">` | `<aside className="w-full md:w-64">` | Width must be responsive; 256px on mobile breaks layout |
| `<div className="glass p-2">` form field | `<div className="bg-card p-2">` form field | Glass + tight spacing = blur halos; use solid card |
| All spans in 12-col grid | Mix `col-span-*` with `md:col-span-*` | Responsive: different column counts per breakpoint |

---

## Accessibility Checklist

- [ ] Drawer has hamburger button labeled `aria-label="Toggle sidebar"`
- [ ] Close button has `aria-label="Close sidebar"`
- [ ] Drawer overlay is `role="presentation"` or click-to-close
- [ ] All buttons have visible focus ring (`:focus-visible`)
- [ ] Headings use semantic `<h1>`, `<h2>`, etc., not styled divs
- [ ] Form inputs have `<label>` (hidden or visible)
- [ ] Color is not the only indicator (e.g., error + icon, not red text alone)
- [ ] Glass effect respects `prefers-reduced-motion` (no blur)

---

## Performance Tips

1. **Avoid nested grid/flex:** Flatten layout structure when possible.
2. **Use CSS breakpoints, not JS:** Prefer Tailwind utilities over `useMediaQuery()`.
3. **Minimize repaints:** Use `transform: translateX()` for drawer, not `left: 0/–100%`.
4. **Glass sparingly:** Backdrop filter is GPU-intensive; disable on mobile.
5. **Scroll containment:** Use `overflow-y-auto` with `flex-1 min-h-0` to prevent nested scroll bubbles.

---

## File Structure (Recommended)

```
components/
├── layout/
│   ├── DocumentLayout.tsx       # 3-column responsive container
│   ├── DocumentColumn.tsx       # Reusable panel wrapper
│   ├── ColumnHeader.tsx         # Header sub-component
│   └── ScrollableContent.tsx    # Scroll-safe wrapper
├── ui/
│   ├── glass-card-smart.tsx     # Responsive glass effect
│   └── focus-ring.tsx           # Accessible focus utility
└── DrawerSidebar.tsx            # Mobile drawer pattern

lib/
└── hooks/
    └── useIsMobile.ts           # Breakpoint detection hook

docs/
├── ui-architecture-design.md    # Full guide
├── ui-architecture-examples.md  # Ready-to-copy code
└── ui-architecture-quick-ref.md # This file
```

---

## Column Proportions (12-Col Grid)

| Desktop | Tablet | Mobile | Cols |
|---------|--------|--------|------|
| Sidebar | Hidden | Drawer | `lg:col-span-3` |
| Editor | Editor | 100% | `lg:col-span-6 md:col-span-1 col-span-1` |
| Result | Result | 100% (tab) | `lg:col-span-3 md:col-span-1 col-span-1` |

---

## Testing Viewports

```bash
# Mobile
width = 375px

# Tablet
width = 768px

# Desktop
width = 1024px

# Large
width = 1280px
```

Open DevTools → Device Toolbar → Select device or enter custom size.

---

## Links to Full Docs

- **Design Guide:** `ui-architecture-design.md`
- **Code Examples:** `ui-architecture-examples.md`
- **Tailwind Docs:** https://tailwindcss.com/docs
- **Radix UI (Drawer):** https://radix-ui.com/primitives/docs/components/dialog
- **shadcn/ui:** https://ui.shadcn.com

---

**Last Updated:** 2025  
**Status:** Reference
