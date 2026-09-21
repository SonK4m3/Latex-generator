# UI Architecture: Implementation Examples

**Companion to:** `ui-architecture-design.md`  
**Purpose:** Ready-to-copy component implementations following design guidelines.

---

## Table of Contents

1. [Tailwind Config (8px Scale)](#tailwind-config-8px-scale)
2. [Layout Primitives](#layout-primitives)
3. [Responsive 3-Column Container](#responsive-3-column-container)
4. [Drawer Sidebar](#drawer-sidebar)
5. [Glass-Aware Components](#glass-aware-components)
6. [Breakpoint-Safe Utilities](#breakpoint-safe-utilities)

---

## Tailwind Config (8px Scale)

**File: `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  
  theme: {
    extend: {
      // Override spacing scale to enforce 8px multiples
      spacing: {
        0: "0",
        1: "0.5rem",   // 8px
        2: "1rem",     // 16px
        3: "1.5rem",   // 24px
        4: "2rem",     // 32px
        5: "2.5rem",   // 40px
        6: "3rem",     // 48px
        7: "3.5rem",   // 56px
        8: "4rem",     // 64px
        9: "4.5rem",   // 72px
        10: "5rem",    // 80px
        11: "5.5rem",  // 88px
        12: "6rem",    // 96px
        14: "7rem",    // 112px
        16: "8rem",    // 128px
        20: "10rem",   // 160px
        24: "12rem",   // 192px
        28: "14rem",   // 224px
        32: "16rem",   // 256px
        36: "18rem",   // 288px
        40: "20rem",   // 320px
        44: "22rem",   // 352px
        48: "24rem",   // 384px
        52: "26rem",   // 416px
        56: "28rem",   // 448px
        60: "30rem",   // 480px
        64: "32rem",   // 512px
        72: "36rem",   // 576px
        80: "40rem",   // 640px
        96: "48rem",   // 768px
      },

      // Consistent breakpoints
      screens: {
        xs: "320px",   // Mobile minimum
        sm: "640px",   // Mobile landscape
        md: "768px",   // Tablet
        lg: "1024px",  // Laptop
        xl: "1280px",  // Desktop
        "2xl": "1536px", // Large desktop
      },

      // Add semantic spacing CSS variables
      colors: {
        // Glass effect supporting variables
        glass: {
          light: "rgb(255 255 255 / 0.7)",
          lighter: "rgb(255 255 255 / 0.8)",
          dark: "rgb(30 41 59 / 0.5)",
          darker: "rgb(30 41 59 / 0.6)",
        },
      },

      backdropFilter: {
        glass: "blur(12px)",
        "glass-sm": "blur(8px)",
        "glass-lg": "blur(16px)",
      },
    },
  },

  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
```

---

## Layout Primitives

### 1. DocumentColumn (Reusable Container)

**File: `components/layout/DocumentColumn.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface DocumentColumnProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  scrollable?: boolean;
  headerAction?: React.ReactNode;
  isGlass?: boolean;
}

export const DocumentColumn = React.forwardRef<
  HTMLDivElement,
  DocumentColumnProps
>(
  (
    {
      title,
      subtitle,
      scrollable = true,
      headerAction,
      isGlass = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col h-full gap-0 rounded-lg border overflow-hidden",
          isGlass
            ? "glass border-glass-border"
            : "bg-card border-border"
        )}
        {...props}
      >
        {/* Header Section */}
        {(title || subtitle || headerAction) && (
          <div className="flex-shrink-0 border-b border-inherit px-4 py-3 flex items-center justify-between gap-2 bg-muted/20">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
          </div>
        )}

        {/* Content Section */}
        <div
          className={cn(
            "flex-1 overflow-hidden",
            scrollable && "overflow-y-auto"
          )}
        >
          {/* Inner wrapper with consistent padding */}
          <div className="h-full px-4 py-3">
            {children}
          </div>
        </div>
      </div>
    );
  }
);

DocumentColumn.displayName = "DocumentColumn";
```

### 2. Column Header (Sub-component)

**File: `components/layout/ColumnHeader.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ColumnHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function ColumnHeader({
  title,
  subtitle,
  action,
  className,
  ...props
}: ColumnHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 flex-shrink-0",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
```

### 3. Scrollable Content Area

**File: `components/layout/ScrollableContent.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ScrollableContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean; // p-2 instead of p-4
}

export const ScrollableContent = React.forwardRef<
  HTMLDivElement,
  ScrollableContentProps
>(({ className, compact = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex-1 overflow-y-auto overflow-x-hidden",
      compact ? "px-2 py-2" : "px-4 py-3",
      className
    )}
    {...props}
  />
));

ScrollableContent.displayName = "ScrollableContent";
```

---

## Responsive 3-Column Container

**File: `components/layout/DocumentLayout.tsx`**

```tsx
"use client";

import * as React from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocumentLayoutProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  result: React.ReactNode;
  title?: string;
}

export function DocumentLayout({
  sidebar,
  main,
  result,
  title = "Document Editor",
}: DocumentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Mobile/Tablet Header */}
      <header className="flex-shrink-0 flex items-center justify-between gap-2 p-2 border-b border-border md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-muted rounded-md transition-colors"
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <h1 className="text-sm font-semibold flex-1 truncate">{title}</h1>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-2 lg:grid-cols-12 gap-4 p-4">
        {/* Sidebar: Hidden on mobile, drawer overlay on tablet, visible on lg+ */}
        {sidebar && (
          <>
            {/* Mobile/Tablet: Drawer Overlay */}
            {sidebarOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/30 z-30 md:hidden"
                  onClick={() => setSidebarOpen(false)}
                  role="presentation"
                />
                <aside className="fixed left-0 top-12 bottom-0 w-64 bg-card border-r border-border z-40 md:hidden overflow-y-auto">
                  <div className="p-4 space-y-4">{sidebar}</div>
                </aside>
              </>
            )}

            {/* Desktop: Sidebar in Layout */}
            <div className="hidden lg:block lg:col-span-3 overflow-hidden">
              <div className="h-full overflow-y-auto space-y-4 pr-2">
                {sidebar}
              </div>
            </div>
          </>
        )}

        {/* Editor: Full mobile, spans rest on tablet+, col-span-6 on desktop */}
        <div className="col-span-1 md:col-span-1 lg:col-span-6 min-h-0 overflow-hidden">
          <div className="h-full rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            {main}
          </div>
        </div>

        {/* Result: Full mobile (stacked/tabbed), col-span-1 tablet, col-span-3 desktop */}
        <div className="col-span-1 md:col-span-1 lg:col-span-3 min-h-0 overflow-hidden">
          <div className="h-full rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            {result}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Drawer Sidebar

### Simple Drawer (Hook-Based)

**File: `components/DrawerSidebar.tsx`**

```tsx
"use client";

import * as React from "react";
import { X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerSidebarProps {
  children: React.ReactNode;
  title?: string;
}

export function DrawerSidebar({
  children,
  title = "Menu",
}: DrawerSidebarProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Trigger Button (mobile only) */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="Open menu"
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 md:hidden z-30 bg-black/30 transition-opacity"
          onClick={() => setOpen(false)}
          role="presentation"
        />
      )}

      {/* Drawer Panel */}
      <aside
        className={cn(
          "fixed md:static left-0 top-0 h-screen w-64 md:w-auto",
          "bg-card border-r border-border",
          "flex flex-col gap-0 p-0",
          "transition-transform duration-200 ease-out md:translate-x-0",
          "md:h-auto md:flex-1",
          "z-40",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 hover:bg-muted rounded transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {children}
        </div>
      </aside>
    </>
  );
}
```

---

## Glass-Aware Components

### 1. Smart Glass Card (Responsive Glass)

**File: `components/ui/glass-card-smart.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardSmartProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "light" | "strong";
  forceNoGlass?: boolean; // Disable glass even on lg+
}

export const GlassCardSmart = React.forwardRef<
  HTMLDivElement,
  GlassCardSmartProps
>(
  (
    { className, variant = "default", forceNoGlass = false, ...props },
    ref
  ) => {
    const variantClasses = {
      default: "bg-card/70 md:bg-card/50 lg:glass",
      light: "bg-card/80 md:bg-card/70 lg:glass-light",
      strong: "bg-card md:bg-card lg:glass",
    };

    // Force no glass if specified or on mobile
    const glassClasses = forceNoGlass
      ? "bg-card border border-border"
      : cn(
          "border rounded-lg",
          variantClasses[variant],
          "md:border-glass-border",
          "lg:border-glass-border"
        );

    return (
      <div
        ref={ref}
        className={cn(glassClasses, className)}
        {...props}
      />
    );
  }
);

GlassCardSmart.displayName = "GlassCardSmart";
```

### 2. Accessible Focus Ring (Works with Glass)

**File: `components/ui/focus-ring.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function withFocusRing(className?: string) {
  return cn(
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-ring",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
    className
  );
}

// Usage:
// <button className={withFocusRing("px-4 py-2")}>
```

---

## Breakpoint-Safe Utilities

### 1. useIsMobile Hook (SSR-Safe)

**File: `lib/hooks/useIsMobile.ts`**

```typescript
import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Check initial state
    setIsMobile(window.innerWidth < breakpoint);

    // Listen for resize
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}
```

**Usage:**

```tsx
export function MyComponent() {
  const isMobile = useIsMobile();

  // Avoid rendering until hydrated to prevent mismatch
  if (isMobile === undefined) return null;

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
```

### 2. Responsive Container Query Alternative

**File: `components/layout/ResponsiveContainer.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"; // Container size, not viewport
}

export const ResponsiveContainer = React.forwardRef<
  HTMLDivElement,
  ResponsiveContainerProps
>(({ className, size = "md", ...props }, ref) => {
  const sizeClasses = {
    sm: "w-full sm:w-96", // Mobile full, grows to 384px
    md: "w-full md:w-2/3 lg:w-1/2", // Responsive proportions
    lg: "w-full", // Full width always
  };

  return (
    <div
      ref={ref}
      className={cn(sizeClasses[size], className)}
      {...props}
    />
  );
});

ResponsiveContainer.displayName = "ResponsiveContainer";
```

---

## Integration Example: Full Page Layout

**File: `app/documents/[id]/layout.tsx`**

```tsx
import { ReactNode } from "react";
import { DocumentLayout } from "@/components/layout/DocumentLayout";

export default function DocumentPageLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocumentLayout
      title="Document Editor"
      sidebar={children}
      main={<MainContent />}
      result={<ResultContent />}
    />
  );
}

function MainContent() {
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      {/* Editor content */}
    </div>
  );
}

function ResultContent() {
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      {/* Result content */}
    </div>
  );
}
```

**File: `app/documents/[id]/page.tsx`**

```tsx
"use client";

import { DocumentLayout } from "@/components/layout/DocumentLayout";
import { DocumentColumn } from "@/components/layout/DocumentColumn";
import { DocumentList } from "@/components/DocumentList";
import { ChatEditor } from "@/components/ChatEditor";
import { ResultPanel } from "@/components/ResultPanel";

export default function DocumentPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <DocumentLayout
      title={`Document: ${params.id}`}
      sidebar={
        <DocumentColumn title="Documents" scrollable>
          <DocumentList />
        </DocumentColumn>
      }
      main={
        <DocumentColumn title="Editor" scrollable>
          <ChatEditor />
        </DocumentColumn>
      }
      result={
        <DocumentColumn title="Result" scrollable>
          <ResultPanel />
        </DocumentColumn>
      }
    />
  );
}
```

---

## Testing Responsive Layout

### Viewport Test Points

```typescript
// tests/layout.test.tsx
import { render, screen } from "@testing-library/react";
import { DocumentLayout } from "@/components/layout/DocumentLayout";

describe("DocumentLayout", () => {
  it("shows drawer on mobile", () => {
    // Set viewport to 375px (mobile)
    global.innerWidth = 375;
    render(
      <DocumentLayout
        sidebar={<div>Sidebar</div>}
        main={<div>Main</div>}
        result={<div>Result</div>}
      />
    );

    const hamburger = screen.getByLabelText("Toggle sidebar");
    expect(hamburger).toBeVisible();
  });

  it("shows all 3 columns on desktop", () => {
    // Set viewport to 1280px (desktop)
    global.innerWidth = 1280;
    render(
      <DocumentLayout
        sidebar={<div>Sidebar</div>}
        main={<div>Main</div>}
        result={<div>Result</div>}
      />
    );

    expect(screen.getByText("Sidebar")).toBeVisible();
    expect(screen.getByText("Main")).toBeVisible();
    expect(screen.getByText("Result")).toBeVisible();
  });
});
```

---

**End of Examples**
