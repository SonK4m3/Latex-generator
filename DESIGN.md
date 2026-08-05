---
name: AI LaTeX Generator
description: Natural language to compiled LaTeX PDF, with a self-healing compile loop.
colors:
  ink:
    fontFamily: null
  neutral-bg: "oklch(1 0 0)"
  neutral-bg-dark: "oklch(0.145 0 0)"
  neutral-fg: "oklch(0.145 0 0)"
  neutral-fg-dark: "oklch(0.985 0 0)"
  neutral-card: "oklch(1 0 0)"
  neutral-card-dark: "oklch(0.205 0 0)"
  neutral-muted: "oklch(0.97 0 0)"
  neutral-muted-dark: "oklch(0.269 0 0)"
  neutral-border: "oklch(0.922 0 0)"
  neutral-border-dark: "oklch(1 0 0 / 10%)"
  primary: "oklch(0.205 0 0)"
  primary-dark: "oklch(0.922 0 0)"
  compile-blue: "#2563eb"
  status-success: "#16a34a"
  status-error: "#dc2626"
typography:
  display:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontWeight: 600
  body:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.625"
  label:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  mono:
    fontFamily: "var(--font-geist-mono), Geist Mono, ui-monospace, monospace"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.625rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-cta:
    backgroundColor: "{colors.compile-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
---

# Design System: AI LaTeX Generator

## Overview

**Creative North Star: "The Compile Room"**

This is a tool, not a showroom, and it looks like one on purpose: a quiet, grayscale interface (stock shadcn/ui primitives on OKLCH neutrals) that gets out of the way of the actual product truth — a document either compiled or it didn't, and the interface's only job is to make that status legible fast. Nothing here is trying to be beautiful; it is trying to be trustworthy under repeated, high-stakes use (a student rerunning a thesis chapter compile for the fifth time at 2am).

The one spot of color that exists — a Tailwind-stock blue (`#2563eb`) — has organically become the de facto accent across the real screens (active tabs, links, primary CTAs, in-progress status text), even though the underlying token system (`--primary`) is neutral grayscale and never actually references it. This is documented honestly below as the current, real state: a tokenized primitive layer (`components/ui/*`) that the application screens mostly bypass in favor of hardcoded Tailwind utility colors (`blue-600`, `red-600`, `green-600`, `zinc-*`). Named **Compile Blue**, this accent marks "the system is actively doing compile work or wants your attention here" — selection, action, progress — while red and green stay reserved for terminal states (error / success) surfaced from the actual Tectonic compile pipeline, never decorative.

There is no invented visual sophistication here beyond what's implemented. Where the system is under-decided (no accent token wired into `globals.css`, screens hand-rolling their own blue), this file states that as the honest baseline and gives it a name, rather than smoothing it over into a token spec that doesn't exist in the code.

**Key Characteristics:**
- Grayscale-first: identity lives in restraint, not palette.
- One working accent (Compile Blue) doing double duty as brand color and status color — not yet formalized as a design token.
- Status is truth: red/green/blue map directly to real compile-pipeline states, never used decoratively.
- Density over drama: compact controls (`h-7`–`h-9` buttons, `text-sm`/`text-xs` labels), tight padding, built for a working session, not a landing page.
- Tonal at rest, shadow on overlay: cards and inputs are flat; dropdowns/menus/popovers lift with `shadow-md`/`shadow-lg` + a 1px foreground-tinted ring.

## Colors

The palette is almost entirely neutral; one accent has emerged from use rather than design decision.

### Primary
- **Ink** (`oklch(0.205 0 0)` light / `oklch(0.922 0 0)` dark): the shadcn `--primary` token. Near-black in light mode, near-white in dark mode. Used on the tokenized `Button` primitive's `default` variant and on primary bubble content in chat. Functions as the "structural" primary — high-contrast UI chrome — not the accent visitors actually notice.

### Secondary
- **Compile Blue** (`#2563eb`, Tailwind `blue-600`): the de facto accent, hardcoded directly in application screens rather than routed through `--primary`. Marks anything interactive-and-current: active file tab (`ProjectFileEditor`), active result tab (`ResultPanel`), the "processing" status line (`StatusBanner`), links (`DocumentWorkspace`, `DocumentList`), and every primary form-submit CTA (`GeneratorForm`, `ChatEditor`, `ProjectFileEditor`'s save-and-compile button). This is the color to reach for when adding a new primary action or an "in progress" indicator — see the Compile Blue Rule below.

### Neutral
- **Paper White** (`oklch(1 0 0)`): `--background`/`--card` in light mode. Base canvas.
- **Void** (`oklch(0.145 0 0)`): `--background` in dark mode.
- **Ink Text** (`oklch(0.145 0 0)` light / `oklch(0.985 0 0)` dark): `--foreground`, body text.
- **Quiet Fill** (`oklch(0.97 0 0)` light / `oklch(0.269 0 0)` dark): `--muted`/`--secondary`, used for inactive tab backgrounds (`bg-zinc-200 dark:bg-zinc-800` in `ResultPanel`/`DocumentWorkspace` is the same role, hardcoded rather than tokenized) and hover fills.
- **Hairline Border** (`oklch(0.922 0 0)` light / `oklch(1 0 0 / 10%)` dark): `--border`/`--input`. Deliberately near-invisible in light mode; separation comes from spacing and fill contrast more than from the border itself.

### Status (functional, not decorative)
- **Compile Error Red** (`#dc2626`, Tailwind `red-600`): terminal failure state only — compile errors, destructive actions (remove file, delete document). Paired with a pale `red-50`/`red-950` fill for banners.
- **Compile Success Green** (`#16a34a`, Tailwind `green-600`): terminal success state only — "document generated successfully."

### Named Rules
**The Compile Blue Rule.** Blue means "this is active, or this is the thing to press." It is never used for a resting/idle state and never used decoratively. If a new primary action or in-progress indicator is needed, it uses Compile Blue — do not introduce a second accent hue.

**The Status-Is-Truth Rule.** Red and green only ever reflect a real result from the actual compile/validation pipeline (`StatusBanner`, `ResultPanel` error states, `DocumentList` badges). Never use them for arbitrary UI emphasis unrelated to compile/save/delete outcomes.

## Typography

**Display Font:** Geist Sans (`var(--font-geist-sans)`, with system-ui/sans-serif fallback)
**Body Font:** Geist Sans (same family — no separate display face)
**Label/Mono Font:** Geist Mono (`var(--font-geist-mono)`), used for LaTeX source display (`LatexSource`)

**Character:** One typeface, used at close, functional sizes — this is a UI font stack doing UI work, not an editorial pairing. Geist Mono exists specifically to make raw `.tex` source and compile-log output legible and clearly distinguished from prose.

### Hierarchy
- **Title** (600 weight, page/section headers, observed via component structure rather than a fixed scale): document titles, panel headers.
- **Body** (400 weight, `0.875rem`/`14px`, `line-height: 1.625` per `leading-relaxed` on chat bubbles): default reading size for all prose, chat messages, form labels' associated text.
- **Label** (500 weight, `0.75rem`/`12px`): button text, tab labels, status badges, form field labels — the most-used size in the app given its control-dense nature.
- **Mono/Code** (400 weight, Geist Mono, sized like body): `.tex` source view, compile error output.

### Named Rules
**The One-Face Rule.** There is no separate display typeface. Hierarchy is built from weight and size within Geist Sans, not from font-pairing. Do not introduce a second UI typeface.

## Layout

Single-column, task-focused layout: a generator form leads to a two-pane result view (PDF preview / LaTeX source, toggled by tab, not shown side-by-side by default — see `ResultPanel`). The document workspace (`DocumentWorkspace`) follows the same pattern for existing documents: chat/edit panel alongside compiled output. No dashboard-grid or multi-widget layout exists; this is a linear, session-oriented tool, not a control-panel product.

Density is high and consistent: buttons run `h-7`–`h-9` (28–36px), form inputs `h-8` (32px), padding on interactive elements is tight (`px-2.5`, `py-1`). This is deliberate for a tool used in long working sessions (iterative thesis editing) rather than a marketing surface where generous whitespace would be the goal.

Responsive behavior is not yet a deeply engineered concern in the codebase as scanned; chat panels use viewport-relative heights (`h-[78vh]`, `min-h-[520px]`) suggesting a desktop-first assumption, consistent with the primary use case (drafting long documents) rather than mobile browsing.

## Elevation & Depth

Hybrid, not flat: base surfaces (cards, inputs, the chat panel container) sit tonal-flat — separation comes from the near-invisible `--border` and background-fill contrast (`--card` vs `--muted`), not shadows. `ChatAssistant`'s outer container is the one base-level exception, carrying a subtle `shadow-sm`.

Overlays lift for real: dropdown menus and menubars use `shadow-md`/`shadow-lg` paired with a `ring-1 ring-foreground/10` — the ring does the definition work in both light and dark mode where a shadow alone would be too weak (dark mode) or too heavy (light mode against a near-white card).

### Shadow Vocabulary
- **Ambient card** (`shadow-sm`): the rare base-level surface that needs to visually detach from the page (`ChatAssistant`'s panel). Not used on ordinary cards.
- **Menu lift** (`shadow-md` + `ring-1 ring-foreground/10`): dropdown menus, menubar submenus at rest.
- **Menu lift, elevated** (`shadow-lg` + `ring-1 ring-foreground/10`): nested/secondary menu levels that sit above a first-level menu.

### Named Rules
**The Ring-Over-Shadow Rule.** Every overlay shadow ships with a `ring-1 ring-foreground/10`. The ring, not the shadow, is what actually reads in dark mode — never ship a popover shadow without it.

## Shapes

Rounded-lg (`0.625rem`, the `--radius` token) is the default corner for buttons, inputs, cards, and popovers — soft but not pill-shaped. Smaller controls (xs/sm button sizes) step down to `rounded-md`-equivalent via the `--radius-md` scale token, keeping proportional corner-to-size feel rather than a single fixed radius everywhere. No hard-cornered (radius: 0) elements exist in the scanned primitives.

## Components

### Buttons
- **Shape:** rounded-lg by default (`--radius`, 10px); smaller sizes (`xs`, `sm`) scale radius down proportionally.
- **Primary (tokenized):** `bg-primary` (near-black light / near-white dark) with `text-primary-foreground`, `hover:bg-primary/80`. This is the shadcn primitive default — used inside `components/ui/button.tsx` consumers.
- **Primary CTA (as actually shipped on screens):** hardcoded `bg-blue-600 text-white` with `rounded` (not `rounded-lg`) and `px-4 py-2` — this is Compile Blue doing the CTA job directly, bypassing the tokenized primary. Seen on every "Tạo tài liệu" / "Save & compile" / "Send" action.
- **Hover / Focus:** tokenized buttons get `focus-visible:ring-3 focus-visible:ring-ring/50` and a 1px translate-down `active` press effect. Hardcoded blue CTAs currently have no visible focus ring — a gap, not a decision (see Do's and Don'ts).
- **Secondary / Ghost / Outline (tokenized):** `bg-secondary`, `hover:bg-muted`, and borderless `ghost` variants exist and are used consistently inside `components/ui/*` consumers (dropdown triggers, icon buttons).

### Tabs (functions as chips here)
- **Style:** active = `bg-blue-600 text-white`; inactive = `bg-zinc-200 dark:bg-zinc-800`. Used for PDF/Source toggle (`ResultPanel`) and file tabs (`ProjectFileEditor`, `DocumentWorkspace`).
- **State:** binary active/inactive only; no intermediate "visited" or "modified" state styling currently (file-dirty state, if any, is communicated elsewhere in text, not via tab color).

### Cards / Containers
- **Corner Style:** `rounded-xl` (0.875rem) on the chat panel container; `rounded-lg` on smaller nested surfaces.
- **Background:** `bg-card` (tokenized) — white light / dark gray (`oklch(0.205 0 0)`) dark.
- **Shadow Strategy:** flat by default; `shadow-sm` only on the outer chat panel (see Elevation & Depth).
- **Border:** `border` using the near-invisible `--border` token.
- **Internal Padding:** `p-3` (0.75rem) standard for panel containers.

### Inputs / Fields
- **Style:** `border-input`, `bg-transparent`, `rounded-lg`, `h-8` height, `text-base`/`md:text-sm`.
- **Focus:** `focus-visible:border-ring` + `focus-visible:ring-3 focus-visible:ring-ring/50` — a border-color shift plus a soft ring, not a glow or scale effect.
- **Error / Disabled:** `aria-invalid` triggers `border-destructive` + `ring-3 ring-destructive/20`; disabled state drops opacity to 50% and disables pointer events.

### Navigation
No persistent global nav/header component was found in the scanned files — the app is structured as direct routes (`/`, `/documents/[id]`, `/login`) with in-page back-links (`text-blue-600 hover:underline`, e.g. "← Quay lại" patterns in `DocumentWorkspace`) rather than a nav bar. Document-to-document navigation happens through `DocumentList`.

### Chat Bubbles (signature component)
The `Bubble`/`BubbleContent` primitive (`components/ui/bubble.tsx`) is the most fully token-driven component in the codebase: `default` variant uses `bg-primary`/`text-primary-foreground`; a `tinted` variant uses a live OKLCH derivation (`oklch(from var(--primary) ...)`) to generate a tint of whatever primary color is active, without hardcoding a second color — this is the one place in the system that's built to survive a future primary-color change without edits. Rounded-xl bubbles, `px-3 py-2`, `text-sm leading-relaxed`.

## Do's and Don'ts

### Do:
- **Do** use Compile Blue (`#2563eb`) for any new primary action or "in progress" indicator — it is already the de facto accent everywhere in the app; don't introduce a second accent hue.
- **Do** reserve red/green strictly for real compile/save/delete outcomes (**The Status-Is-Truth Rule**).
- **Do** default new overlay/popover components to `shadow-md` + `ring-1 ring-foreground/10` (**The Ring-Over-Shadow Rule**) rather than shadow alone.
- **Do** keep density high (compact `h-7`–`h-9` controls, tight padding) — this is a working tool used in long sessions, not a marketing page that benefits from generous whitespace.
- **Do** route new UI through the tokenized `components/ui/*` primitives (`Button`, `Input`, `Bubble`) rather than hand-rolling new Tailwind utility styling, to close the gap between the token layer and what screens actually render.

### Don't:
- **Don't** introduce a second brand/accent color. Compile Blue already carries that role; a second hue would fragment the "blue = active/action" signal.
- **Don't** add shadows to base-level cards/inputs by default — the system is tonal-flat at rest; shadows are reserved for overlays and the one existing chat-panel exception.
- **Don't** use red/green decoratively (e.g., a "fun" green success confetti unrelated to an actual compile result, or red used for anything other than an error/destructive action).
- **Don't** ship a new primary CTA button without a visible focus-visible ring — the hardcoded blue CTAs currently lack one; this is a known gap to fix forward, not a pattern to repeat.
- **Don't** add a second display typeface. Geist Sans/Geist Mono is the complete type system (**The One-Face Rule**).
