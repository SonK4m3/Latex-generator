# UI Architecture Design Document
## Document Sidebar + 3-Column Layout, Spacing Systems, Responsive Patterns

**Version:** 1.0  
**Last Updated:** 2025  
**Status:** Design Reference  

---

## Table of Contents

1. [Overview](#overview)
2. [3-Column Layout Architecture](#3-column-layout-architecture)
3. [Spacing Scale System (8px-Based)](#spacing-scale-system-8px-based)
4. [Drawer & Toggle Patterns](#drawer--toggle-patterns)
5. [Responsive Collapse Strategies](#responsive-collapse-strategies)
6. [Glass Effect with Tight Spacing](#glass-effect-with-tight-spacing)
7. [Implementation Guide](#implementation-guide)
8. [Anti-Patterns & Gotchas](#anti-patterns--gotchas)

---

## Overview

This document provides architectural guidance for the AI LaTeX Generator UI, focusing on:

- **Document-centric workflows** combining sidebar navigation + multi-pane content editing
- **Tailwind-based 3-column responsive layouts** that adapt gracefully from desktop → mobile
- **8px modular spacing scale** enforced through configuration to maintain visual consistency
- **Accessible drawer/toggle patterns** for sidebar collapse, built with client-side state
- **Glassmorphism compatibility** with tight spacing, including when glass effects break down
- **Reusable layout primitives** that minimize custom CSS and maximize grid/flex composability

### Design Philosophy

The UI prioritizes **density + clarity** over dramatic spacing. Cards are compact (`p-3` / 0.75rem), controls are small (`h-7–h-9`), and every pixel counts in a tool used in long editing sessions. Responsiveness is not about adding whitespace; it's about reflow — on mobile, columns stack; on tablet, secondary columns may hide. The glass effect exists to add *depth layering*, not to replace real borders or make density feel less tight.

---

## 3-Column Layout Architecture

### Pattern Overview

The canonical 3-column layout splits content into:

```
┌─────────────────────────────────────────┐
│ Document List / Nav (Sidebar)           │  ← 1st column (toggleable on mobile)
│ - Docs carousel or tree                  │
│ - Quick actions                          │
├─────────────────────────────────────────┤
│ Editor (Chat/Markdown/LaTeX)            │  ← 2nd column (main content area)
│ - Input + conversation or source view    │
│ - Focus-heavy, resizable with 3rd col   │
├─────────────────────────────────────────┤
│ Result Panel (PDF/Source toggle)        │  ← 3rd column (output)
│ - Live preview or compiled LaTeX        │
│ - Tab-based view selection              │
└─────────────────────────────────────────┘
```

**Current Implementation:** `DocumentWorkspace.tsx` uses `GlassSplitView` (2-pane, left+right); sidebar is separate above or aside depending on context.

### Tailwind Grid Implementation

#### Desktop (Full 3-Column)

```tsx
// Layout container (app shell)
<div className="grid grid-cols-12 gap-4 p-4 h-screen">
  {/* Sidebar: cols 1–3 */}
  <aside className="col-span-3 overflow-y-auto">
    {/* Document list, search, quick actions */}
  </aside>

  {/* Editor: cols 4–8 */}
  <main className="col-span-5 flex flex-col">
    {/* Chat input, textarea, file tabs */}
  </main>

  {/* Result: cols 9–12 */}
  <section className="col-span-4 flex flex-col">
    {/* PDF preview / source toggle tabs */}
  </section>
</div>
```

**Why `grid-cols-12` over `grid-cols-3`?**

- **Flexibility:** 12-column allows fine-grained breakpoint adjustments (1:5:6, 2:5:5, etc.) without creating multiple breakpoints.
- **Standard:** Aligns with Material Design, Bootstrap, and design systems that expect decimal subdivision.
- **Readability:** `col-span-3`, `col-span-5`, `col-span-4` is immediately legible; proportions are clear.

#### Tablet (2 Columns, Hide Sidebar)

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 h-screen">
  {/* Sidebar: hidden on md and below */}
  <aside className="hidden md:block md:col-span-1">
    {/* Nav hidden; hamburger menu appears */}
  </aside>

  {/* Editor + Result share cols 2–3 */}
  <div className="md:col-span-2 flex flex-col">
    {/* Stacked or side-by-side editor + result */}
  </div>
</div>
```

#### Mobile (Single Column, Drawer Sidebar)

```tsx
<div className="flex flex-col h-screen">
  {/* Header with hamburger + breadcrumb */}
  <header className="flex items-center gap-2 p-2 border-b">
    <button onClick={toggleSidebar}>☰</button>
  </header>

  {/* Sidebar as overlay (drawer) — conditionally rendered */}
  {sidebarOpen && <Drawer onClose={closeSidebar}>{/* ... */}</Drawer>}

  {/* Main: full width */}
  <main className="flex-1 overflow-hidden">
    {/* Editor stacked above result */}
  </main>
</div>
```

### Resizable Panels Strategy

The `GlassSplitView` component implements a resizable divider between editor and result. To extend it to 3 columns:

**Option A: Nested Split (Recommended)**

```tsx
<GlassSplitView
  leftPanel={<Sidebar />}
  rightPanel={
    <GlassSplitView
      leftPanel={<Editor />}
      rightPanel={<ResultPanel />}
      leftWidth={55}
    />
  }
  leftWidth={25}
/>
```

- Pros: Composable, clean component hierarchy, two independent drag handles.
- Cons: Mobile requires hiding both resizers and stacking all three.

**Option B: Custom 3-Pane Component**

Create `GlassTripleSplitView` that manages three drags in one place:

```tsx
<GlassTripleSplitView
  leftPanel={<Sidebar />}
  middlePanel={<Editor />}
  rightPanel={<ResultPanel />}
  leftWidth={25}
  middleWidth={50}
  // rightWidth computed as 100 - left - middle
/>
```

- Pros: Single source of truth, easier mobile collapse, coordinated resizing.
- Cons: More complex component logic, harder to test individual resizer behavior.

**Recommendation:** Option A (nested split) for simplicity; migrate to Option B if UX testing shows simultaneous 3-way resizing is critical.

### Reusable Container Primitives

Define layout containers as composable wrappers around `GlassPanel`:

```tsx
// lib/components/layout/DocumentColumn.tsx
export function DocumentColumn({
  title,
  children,
  scrollable = true,
}: {
  title?: string;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <div className="flex flex-col h-full gap-0">
      {title && (
        <header className="flex-shrink-0 px-3 py-2 border-b border-border/50">
          <h2 className="text-sm font-semibold">{title}</h2>
        </header>
      )}
      <div className={cn("flex-1 overflow-hidden", scrollable && "overflow-y-auto")}>
        {children}
      </div>
    </div>
  );
}
```

**Usage:** All three columns share consistent header + scroll behavior:

```tsx
<DocumentColumn title="Files">
  <FileList />
</DocumentColumn>

<DocumentColumn title="Editor">
  <ChatEditor />
</DocumentColumn>

<DocumentColumn title="Result">
  <ResultPanel />
</DocumentColumn>
```

---

## Spacing Scale System (8px-Based)

### The Problem: Inconsistent Spacing

Without a enforced scale, developers default to:
- Hand-rolled `gap-3.5` (arbitrary), `p-[13px]` (magic numbers)
- Mixing `gap-4` (16px) with `p-3` (12px) inconsistently
- Glass panels with tight padding breaking at breakpoints

**Solution:** An 8px modular scale **enforced in Tailwind config**, so every spacing decision snaps to a multiple of 8px.

### 8px Base Scale

| Tailwind | Rem  | Pixels | Use Case |
|----------|------|--------|----------|
| `p-0`    | 0    | 0      | Reset    |
| `p-1`    | 0.25 | 4px    | ⚠️ Avoid (half-step) |
| `p-2`    | 0.5  | 8px    | **Tight** button padding, minimal spacing |
| `p-3`    | 0.75 | 12px   | Card padding, form input padding (off-scale) |
| `p-4`    | 1    | 16px   | **Default** padding, CTA buttons |
| `p-6`    | 1.5  | 24px   | Large card padding, section margins |
| `p-8`    | 2    | 32px   | Generous container padding |
| `p-10`   | 2.5  | 40px   | Spacious section margins |
| `p-12`   | 3    | 48px   | Page-level top padding |

**Current Project State:** Uses `p-3` (0.75rem = 12px) as default card padding — a compromise, not a multiple of 8. This is acceptable but creates friction when stacking components.

### Enforce Scale in Tailwind Config

To lock developers into an 8px scale, override the spacing scale to disable off-scale values:

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  theme: {
    spacing: {
      0: '0',
      1: '0.5rem',   // 8px  (was 0.25rem)
      2: '1rem',     // 16px (was 0.5rem)
      3: '1.5rem',   // 24px (was 0.75rem)
      4: '2rem',     // 32px (was 1rem)
      5: '2.5rem',   // 40px (was 1.25rem)
      6: '3rem',     // 48px (was 1.5rem)
      7: '3.5rem',   // 56px (was 1.75rem)
      8: '4rem',     // 64px (was 2rem)
      // ... up to 12 = 96px
    },
    gap: {
      // Inherit spacing scale
    },
    padding: {
      // Inherit spacing scale
    },
    margin: {
      // Inherit spacing scale
    },
  },
} satisfies Config;
```

**Effect:** Every spacing utility (`p-2`, `gap-3`, `m-4`, `my-2`, etc.) now snaps to 8px multiples. Off-scale values (`p-3.5`) become build errors.

### Semantic Spacing Tokens (Optional Layer)

For higher-level readability, add semantic CSS variables:

```css
/* app/globals.css */
:root {
  /* Semantic spacing tokens layered over 8px scale */
  --spacing-xs: 0.5rem;    /* p-1 */
  --spacing-sm: 1rem;      /* p-2 */
  --spacing-md: 1.5rem;    /* p-3 */
  --spacing-lg: 2rem;      /* p-4 */
  --spacing-xl: 3rem;      /* p-6 */
  --spacing-2xl: 4rem;     /* p-8 */

  /* Tailwind still uses numeric scale */
  /* Semantic tokens are optional in HTML for clarity */
}
```

**Usage:** Team can use either:

```tsx
{/* Numeric (recommended in most cases) */}
<div className="p-4 gap-3">

{/* Semantic (for design system docs/patterns) */}
<div style={{ padding: 'var(--spacing-lg)', gap: 'var(--spacing-md)' }}>
```

### Spacing Rules

1. **Never hardcode `px` values** in component classes. Use Tailwind utilities only.
2. **Prefer gaps over margin** when spacing siblings. Gap is more predictable (no margin collapse).
3. **Container padding is layer-wide.** All `GlassPanel`, `GlassCard`, form inputs use `p-2` (8px) or `p-4` (16px); never `p-3` (12px).
4. **Breakpoint spacing adjusts,** not zeros out. Mobile doesn't mean no padding — it means `p-2` instead of `p-4`.

---

## Drawer & Toggle Patterns

### Pattern: Collapsible Sidebar (Mobile)

On mobile/tablet, the sidebar converts to a drawer that slides in over content.

#### Implementation: React Hook + Tailwind

```tsx
// components/DrawerSidebar.tsx
"use client";

import { useState } from "react";
import { X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function DrawerSidebar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button (visible on mobile only) */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-md hover:bg-muted"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Drawer overlay (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 md:hidden z-30 bg-black/30"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar content */}
      <aside
        className={cn(
          "fixed md:static left-0 top-0 h-screen w-64 md:w-auto",
          "bg-card border-r border-border",
          "flex flex-col gap-4 p-4",
          "transition-transform duration-200 ease-out",
          "md:translate-x-0",
          isOpen ? "translate-x-0 z-40" : "-translate-x-full"
        )}
      >
        {/* Close button (mobile only) */}
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden ml-auto p-2"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>

        {children}
      </aside>
    </>
  );
}
```

**Key Decisions:**

- **`fixed` on mobile, `static` on md+**: Fixed overlay on small screens; normal flow on larger screens.
- **`-translate-x-full` hidden state**: Slide off-screen smoothly; not `hidden` (JavaScript perf neutral, CSS handles animation).
- **`transition-transform` only**: No full-page repaint, only GPU-accelerated transform.
- **`z-30` overlay + `z-40` drawer**: Drawer sits above overlay (in stacking order and event bubbling).

#### Usage:

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <div className="flex h-screen">
          <DrawerSidebar>
            {/* Sidebar content: nav, doc list, quick actions */}
            <NavMenu />
            <DocumentList />
          </DrawerSidebar>

          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

### Pattern: Toggle Button State

For less dramatic toggles (show/hide a sub-panel, filter toggle), use a simple state hook + aria attributes:

```tsx
"use client";

export function FilterToggle() {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShowFilters(!showFilters)}
        aria-pressed={showFilters}
        className="px-3 py-1 rounded-md bg-muted hover:bg-muted/80"
      >
        Filters {showFilters ? "✓" : ""}
      </button>

      {showFilters && (
        <div className="mt-2 p-3 border border-border rounded-lg bg-card">
          {/* Filter controls */}
        </div>
      )}
    </div>
  );
}
```

### Radix UI + shadcn/ui Integration

For production-grade drawer with animation, keyboard handling (Esc to close), and focus management, use Radix's `Dialog` primitive via shadcn:

```tsx
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DrawerSidebarRadix() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="md:hidden">
          <Menu size={20} />
        </button>
      </DialogTrigger>
      <DialogContent className="w-64 p-0 shadow-lg">
        {/* Sidebar content */}
      </DialogContent>
    </Dialog>
  );
}
```

**Why Radix:**
- Auto Esc key handling.
- Focus trap (focus cycles within dialog on Tab).
- Accessible (ARIA `role="dialog"` + `aria-labelledby`).
- Mobile-aware (full-height on mobile, side drawer on desktop via media query).

---

## Responsive Collapse Strategies

### Breakpoint Map

```
Mobile      Tablet      Desktop
───┬──────┬──────────┬──────────
   |      |          |
  375px   768px     1024px
  sm      md        lg
```

**Tailwind Breakpoints (Default + Custom):**

```typescript
// tailwind.config.ts
theme: {
  screens: {
    xs: '320px',   // min-width: 320px
    sm: '640px',   // min-width: 640px (mobile landscape)
    md: '768px',   // min-width: 768px (tablet portrait)
    lg: '1024px',  // min-width: 1024px (laptop)
    xl: '1280px',  // min-width: 1280px (large desktop)
  },
}
```

### 3-Column → 2-Column → 1-Column Collapse

#### Stage 1: Desktop (3-Column Visible)

```tsx
<div className="grid grid-cols-12 gap-4">
  <aside className="col-span-3">Sidebar</aside>
  <main className="col-span-6">Editor</main>
  <section className="col-span-3">Result</section>
</div>
```

**Breakpoint:** `lg` and up (1024px+)

#### Stage 2: Tablet (2-Column, Sidebar Drawer)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Sidebar hidden (drawer on demand via button) */}
  <aside className="hidden md:block md:col-span-1 md:hidden">
    Sidebar
  </aside>

  {/* Editor + Result stack vertically, or side-by-side with smaller width */}
  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2">
    <main>Editor</main>
    <section>Result</section>
  </div>
</div>
```

**Breakpoint:** `md` to `lg` (768px–1023px)

**Visual Result:**
```
┌────────────────┐
│  ☰  |  Editor  │  ← Hamburger + editor full width
│     |  Result  │  ← Result stacked below (full width)
└────────────────┘
```

#### Stage 3: Mobile (1-Column, Stacked, Drawer)

```tsx
<div className="flex flex-col">
  {/* Hamburger opens drawer */}
  <header className="flex items-center gap-2 p-2 border-b md:hidden">
    <button onClick={toggleSidebar}>☰</button>
  </header>

  {/* Main content: all 3 areas stack vertically */}
  <main className="flex-1 overflow-y-auto space-y-4">
    {/* Editor (or tab to switch to Result) */}
    {activeTab === "editor" && <Editor />}
    {activeTab === "result" && <Result />}

    {/* Or: stacked without tabs */}
    {/* <Editor /> */}
    {/* <Result /> */}
  </main>
</div>
```

**Breakpoint:** Below `md` (< 768px)

**Visual Result:**
```
┌──────────┐
│ ☰        │  ← Header with hamburger
├──────────┤
│  Editor  │  ← Full width, stacked
├──────────┤
│  Result  │  ← Full width, stacked
└──────────┘
```

### Collapse Logic: Pseudo-Code

```tsx
function DocumentLayout() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return (
    <>
      {/* Desktop */}
      {isDesktop && (
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-3">Sidebar</aside>
          <main className="col-span-6">Editor</main>
          <section className="col-span-3">Result</section>
        </div>
      )}

      {/* Tablet */}
      {isTablet && (
        <>
          <DrawerSidebar>Sidebar</DrawerSidebar>
          <div className="grid grid-cols-2 gap-4">
            <main>Editor</main>
            <section>Result</section>
          </div>
        </>
      )}

      {/* Mobile */}
      {isMobile && (
        <>
          <DrawerSidebar>Sidebar</DrawerSidebar>
          <div className="space-y-4">
            {activeTab === "editor" && <Editor />}
            {activeTab === "result" && <Result />}
          </div>
        </>
      )}
    </>
  );
}
```

**Better Approach (CSS-only, no JS breakpoint logic):**

Rely entirely on Tailwind's responsive utilities, avoiding `useMediaQuery` when possible:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
  {/* Sidebar: hidden on mobile/tablet, visible on lg+ */}
  <aside className="hidden lg:block lg:col-span-3">
    Sidebar
  </aside>

  {/* Editor: full-width mobile, half-width tablet, 6-col desktop */}
  <main className="col-span-1 md:col-span-1 lg:col-span-6">
    Editor
  </main>

  {/* Result: full-width mobile, half-width tablet, 3-col desktop */}
  <section className="col-span-1 md:col-span-1 lg:col-span-3">
    Result
  </section>
</div>
```

**Benefit:** No manual media queries in JavaScript; Tailwind generates CSS directly from class names.

---

## Glass Effect with Tight Spacing

### Glass Morphism: When to Use & When to Avoid

**What is glassmorphism?**

A semi-transparent panel with background blur, faint border, and soft shadow — mimicking frosted glass layered over a colorful or complex background.

**Current Implementation:**

```css
/* app/globals.css */
.glass {
  background-color: var(--glass-bg);           /* rgba(255, 255, 255, 0.7) light */
  border: 1px solid var(--glass-border);       /* rgba(255, 255, 255, 0.2) light */
  backdrop-filter: blur(var(--backdrop-blur-amount)); /* 12px */
  -webkit-backdrop-filter: blur(12px);         /* Safari compat */
}
```

### Tight Spacing Issues with Glass

When panels have tight padding (`p-2`, `gap-2`), glass effects create visual crowding:

❌ **Problem 1: Blur Halos Around Text**
```
┌─────────────────────────┐
│ Text in glass blurs      │  ← Letters have fuzzy, blurred bg
│ everything behind it     │  ← Creates visual "halo" effect
└─────────────────────────┘
```

**Why?** The `backdrop-filter: blur()` blurs the content *behind* the panel, but the panel's semi-transparency lets that blur through to readers' eyes. With tiny gaps between elements, the blur becomes visible noise.

**Solution:** Either:
1. Increase glass panel opacity (`--glass-bg: rgba(255, 255, 255, 0.9)` instead of 0.7).
2. Disable glass on dense panels (use solid `bg-card` instead).
3. Reduce blur amount (`blur(8px)` instead of `blur(12px)`) on tight layouts.

❌ **Problem 2: Performance (Mobile)**

Backdrop filter is GPU-intensive. On older mobile devices (A12 or older), blur causes frame drops, especially if multiple glass panels are visible.

**Solution:**
```css
@media (prefers-reduced-motion: reduce) {
  .glass {
    backdrop-filter: none;
    background-color: var(--glass-bg-fallback, white);
  }
}
```

✅ **When Glass Works Well:**

- **Floating overlays** over a background image or gradient (modal dialogs, notifications).
- **Header bars** with generous padding (`p-4`, `p-6`) over a colorful or complex background.
- **Cards with spacious content** (`p-6`, gap between elements).

❌ **When Glass Breaks Down:**

- **Dense form inputs** with `p-2` padding.
- **Tight chat bubbles** (`p-2 gap-1`).
- **Tables or grids** with many small cells (blur makes text hard to read).
- **Mobile devices** with limited GPU capacity.

### Practical: Conditional Glass by Breakpoint

Apply glass only on desktop; revert to solid card bg on mobile:

```tsx
// components/ui/glass-card-smart.tsx
export function GlassCardSmart({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        /* Desktop: glass effect */
        "lg:glass lg:border-glass-border",
        /* Mobile: solid card background */
        "bg-card md:bg-transparent lg:bg-transparent",
        "border-border md:border-transparent lg:border-glass-border"
      )}
    >
      {children}
    </div>
  );
}
```

**Result:**
- Mobile: solid white card (no blur artifacts, fast rendering).
- Desktop: frosted glass effect (premium feel, depth layering).

### Glass + Spacing Recommendations

| Component | Padding | Gap | Glass | Reason |
|-----------|---------|-----|-------|--------|
| Modal dialog | `p-6` | `gap-4` | ✅ Yes | Large, overlaid, spacious. |
| Floating button | `p-3` | — | ✅ Yes | Single element, no blur artifacts. |
| Chat bubble | `p-2` | — | ⚠️ Maybe | Dense; test for readability. |
| Form input | `p-2` | — | ❌ No | Text blur-halos. Use solid card. |
| Header bar | `p-4` | `gap-3` | ✅ Yes | Wide, generous padding. |
| Sidebar panel | `p-3` | `gap-2` | ❌ No | Tight; use card with subtle border. |
| Notification toast | `p-3` | — | ✅ Yes | Temporary overlay, brief scan. |

---

## Implementation Guide

### Step 1: Configure 8px Spacing Scale

**File:** `tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        // 8px modular scale (override defaults)
        0: "0",
        1: "0.5rem",  // 8px
        2: "1rem",    // 16px
        3: "1.5rem",  // 24px
        4: "2rem",    // 32px
        5: "2.5rem",  // 40px
        6: "3rem",    // 48px
        7: "3.5rem",  // 56px
        8: "4rem",    // 64px
        10: "5rem",   // 80px
        12: "6rem",   // 96px
      },
      screens: {
        xs: "320px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
```

### Step 2: Create Layout Primitives

**File:** `components/layout/DocumentColumn.tsx`

```tsx
import { cn } from "@/lib/utils";

export interface DocumentColumnProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  scrollable?: boolean;
  headerAction?: React.ReactNode;
}

export function DocumentColumn({
  title,
  subtitle,
  scrollable = true,
  headerAction,
  className,
  children,
  ...props
}: DocumentColumnProps) {
  return (
    <div
      className={cn("flex flex-col h-full gap-0 bg-card rounded-lg border border-border", className)}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex-shrink-0 border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div className={cn("flex-1 overflow-hidden", scrollable && "overflow-y-auto")}>
        <div className="px-4 py-3 space-y-2">{children}</div>
      </div>
    </div>
  );
}
```

### Step 3: Build 3-Column Layout Container

**File:** `components/layout/DocumentLayout.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";
import { DocumentColumn } from "./DocumentColumn";

export interface DocumentLayoutProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  result: React.ReactNode;
  sidebarOpen?: boolean;
  onSidebarToggle?: (open: boolean) => void;
}

export function DocumentLayout({
  sidebar,
  main,
  result,
  sidebarOpen = true,
  onSidebarToggle,
}: DocumentLayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center gap-2 p-2 border-b border-border">
        <button
          onClick={() => onSidebarToggle?.(!sidebarOpen)}
          className="p-2 hover:bg-muted rounded-md"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <h1 className="text-sm font-semibold flex-1">AI LaTeX Generator</h1>
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 p-4">
        {/* Sidebar: Hidden on mobile, visible on lg+ */}
        {sidebar && (
          <div className="hidden lg:block lg:col-span-3">
            <DocumentColumn title="Documents">
              {sidebar}
            </DocumentColumn>
          </div>
        )}

        {/* Editor: Full on mobile, col-span-1 on tablet, col-span-6 on desktop */}
        <div className="col-span-1 md:col-span-1 lg:col-span-6 min-h-0">
          <DocumentColumn title="Editor">
            {main}
          </DocumentColumn>
        </div>

        {/* Result: Full on mobile (tab-switched), col-span-1 on tablet, col-span-3 on desktop */}
        <div className="col-span-1 md:col-span-1 lg:col-span-3 min-h-0">
          <DocumentColumn title="Result">
            {result}
          </DocumentColumn>
        </div>
      </div>

      {/* Mobile Drawer Sidebar (overlay) */}
      {sidebar && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 md:hidden bg-black/30 z-30"
            onClick={() => onSidebarToggle?.(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card z-40 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Documents</h2>
                <button
                  onClick={() => onSidebarToggle?.(false)}
                  className="p-1 hover:bg-muted rounded"
                >
                  ✕
                </button>
              </div>
              {sidebar}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
```

### Step 4: Wire Into App Shell

**File:** `app/layout.tsx`

```tsx
import { DocumentLayout } from "@/components/layout/DocumentLayout";
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**File:** `app/documents/[id]/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { DocumentLayout } from "@/components/layout/DocumentLayout";
import { DocumentList } from "@/components/DocumentList";
import { ChatEditor } from "@/components/ChatEditor";
import { ResultPanel } from "@/components/ResultPanel";

export default function DocumentPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <DocumentLayout
      sidebar={<DocumentList />}
      main={<ChatEditor />}
      result={<ResultPanel />}
      sidebarOpen={sidebarOpen}
      onSidebarToggle={setSidebarOpen}
    />
  );
}
```

---

## Anti-Patterns & Gotchas

### Anti-Pattern 1: Mixing Numeric & Semantic Spacing

❌ **Don't:**
```tsx
<div className="p-4 gap-3">
  <div className="mb-2">Item</div>
  <div style={{ paddingBottom: '10px' }}>Item</div>
</div>
```

✅ **Do:**
```tsx
<div className="p-4 gap-4">
  <div className="mb-4">Item</div>
  <div className="pb-4">Item</div>
</div>
```

**Why:** Mixing Tailwind utils with inline styles or hardcoded px creates inconsistency and makes scaling difficult. Stick to the 8px scale everywhere.

---

### Anti-Pattern 2: Over-Nesting Grid/Flex

❌ **Don't:**
```tsx
<div className="grid grid-cols-12">
  <div className="col-span-6 flex">
    <div className="flex-1 grid grid-cols-2">
      <div className="flex flex-col">
        {/* Too many layout contexts */}
      </div>
    </div>
  </div>
</div>
```

✅ **Do:**
```tsx
<div className="grid grid-cols-12 gap-4">
  <main className="col-span-6">
    <div className="grid grid-cols-2 gap-4">
      {/* Flatten unnecessary nesting */}
    </div>
  </main>
</div>
```

**Why:** Each nested flex/grid context adds layout cost. Flatten when possible.

---

### Anti-Pattern 3: Glass Everywhere

❌ **Don't:**
```tsx
<div className="glass p-2">
  <input className="glass" placeholder="Type..." />
  <button className="glass">Send</button>
</div>
```

✅ **Do:**
```tsx
<div className="bg-card p-4 rounded-lg border border-border">
  <input className="bg-muted border border-border rounded-md p-2" placeholder="Type..." />
  <button className="bg-blue-600 text-white p-2 rounded-md">Send</button>
</div>
```

**Why:** Glass is a special effect for floating overlays, not a substitute for solid backgrounds. Overuse reduces contrast and readability, especially on mobile.

---

### Anti-Pattern 4: Responsive Gaps with Arbitrary Values

❌ **Don't:**
```tsx
<div className="flex gap-3 md:gap-5 lg:gap-6">
```

✅ **Do:**
```tsx
<div className="flex gap-2 md:gap-4 lg:gap-6">
```

**Why:** Stick to 8px multiples. `gap-3`, `gap-5` are off-scale; use `gap-2` (16px), `gap-4` (32px), `gap-6` (48px) instead.

---

### Anti-Pattern 5: Fixed Heights Without Overflow Handling

❌ **Don't:**
```tsx
<div className="h-screen">
  <header className="h-16" />
  <main className="h-full">
    {/* Content may overflow, no scrolling */}
  </main>
</div>
```

✅ **Do:**
```tsx
<div className="h-screen flex flex-col">
  <header className="h-16 flex-shrink-0" />
  <main className="flex-1 overflow-y-auto">
    {/* Fills remaining space, scrolls if needed */}
  </main>
</div>
```

**Why:** Use `flex-1 overflow-y-auto` to let content scroll safely. Never rely on `h-full` without flex context.

---

### Gotcha 1: Breakpoint Prefixes Don't Stack Intuitively

❌ **This doesn't work as expected:**
```tsx
<div className="lg:hidden lg:absolute">
  {/* lg:hidden hides on lg+, lg:absolute is never applied */}
</div>
```

✅ **Do:**
```tsx
<div className="absolute lg:hidden">
  {/* absolute applies first, then lg:hidden hides it on lg+ */}
</div>
```

**Why:** Breakpoint prefixes apply a single media query. Stack non-responsive and responsive utilities in order.

---

### Gotcha 2: `min-h-0` Required on Flex Children with Overflow

❌ **This overflows despite `overflow-y-auto`:**
```tsx
<div className="flex flex-col h-screen">
  <header>Title</header>
  <main className="flex-1 overflow-y-auto">
    {/* Long content doesn't scroll; overflows parent */}
  </main>
</div>
```

✅ **Do:**
```tsx
<div className="flex flex-col h-screen">
  <header>Title</header>
  <main className="flex-1 overflow-y-auto min-h-0">
    {/* min-h-0 allows flex child to shrink below content size */}
  </main>
</div>
```

**Why:** Flex children default to `min-h: auto`, which prevents shrinking below content. `min-h-0` is required to override.

---

### Gotcha 3: Sidebar Width Not Responsive by Default

❌ **This sidebar is always 256px, even on mobile:**
```tsx
<aside className="w-64 overflow-y-auto">
  {/* w-64 = 256px, doesn't shrink on mobile, causes layout break */}
</aside>
```

✅ **Do:**
```tsx
<aside className="w-full md:w-64 overflow-y-auto">
  {/* mobile: full width, tablet+: 256px */}
</aside>
```

Or use the drawer overlay pattern on mobile instead.

---

### Gotcha 4: `gap` Between Flex Children Ignores `margin`

❌ **Confusing:**
```tsx
<div className="flex gap-4">
  <div className="mr-2">Item</div>
  {/* gap-4 is used; mr-2 is ignored between siblings */}
</div>
```

✅ **Just use gap:**
```tsx
<div className="flex gap-4">
  <div>Item</div>
  {/* gap handles all spacing; no margin needed */}
</div>
```

**Why:** `gap` is explicitly designed for flex/grid spacing. Don't mix margin in flex containers.

---

## Checklist: Responsive 3-Column Audit

Use this checklist to verify a 3-column layout meets the standards in this document:

- [ ] **Spacing:** All padding/margin uses 8px scale (p-2, p-4, p-6, gap-2, gap-4).
- [ ] **Desktop (lg+):** All 3 columns visible side-by-side (grid-cols-12 or flex).
- [ ] **Tablet (md–lg):** Sidebar hidden or drawer; editor + result visible (2 columns or stacked).
- [ ] **Mobile (< md):** All content stacks vertically or tabs to switch between sections; sidebar is drawer.
- [ ] **Drawer:** Hamburger button opens overlay sidebar; Esc or overlay click closes it.
- [ ] **Overflow:** All scrollable sections use `overflow-y-auto` with `flex-1 min-h-0` context.
- [ ] **Glass:** Only applied to floating overlays or headers on desktop; disabled on mobile or dense panels.
- [ ] **Accessibility:** Drawer has `aria-label`, close button, focus trap; sidebar toggle is labeled.
- [ ] **Performance:** No `useMediaQuery` if entire layout can be CSS-only (Tailwind breakpoint utilities).
- [ ] **Testing:** Verified on 320px (mobile), 768px (tablet), 1024px+ (desktop) viewports.

---

## References

- **Tailwind CSS:** https://tailwindcss.com/docs
- **Spacing Utilities:** https://tailwindcss.com/docs/customizing-spacing
- **Responsive Design:** https://tailwindcss.com/docs/responsive-design
- **Grid & Flex:** https://tailwindcss.com/docs/grid, https://tailwindcss.com/docs/flexbox
- **Glassmorphism:** https://superdesign.dev/styles/glassmorphism
- **Radix UI Dialog:** https://radix-ui.com/primitives/docs/components/dialog
- **shadcn/ui Sidebar:** https://ui.shadcn.com/docs/components/sidebar

---

**End of Document**
