import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { DrawerNav } from "@/components/layout/drawer-nav";
import AuthStatusClient from "@/components/AuthStatusClient";
import AppCommandPalette from "@/components/AppCommandPalette";

// The Compile Room (Operate mode) layout — uses 3-column desktop layout with responsive drawer
// for mobile. Desktop: fixed sidebar | main content. Mobile: drawer overlay.
// See root DESIGN.md for the visual system this chrome follows.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full relative bg-background">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:block fixed left-0 top-0 h-screen w-64 z-40">
        <Sidebar isOpen={true} />
      </div>

      {/* Mobile Drawer Navigation */}
      <DrawerNav
        authStatus={
          <Suspense fallback={<div className="h-8 w-24 bg-muted rounded animate-pulse" />}>
            <AuthStatusClient />
          </Suspense>
        }
      />

      {/* Main Content Area */}
      <main
        id="main-content"
        className="flex-1 md:ml-64 p-2 md:p-4 flex flex-col"
        role="main"
      >
        {children}
      </main>

      {/* ⌘K — mở được từ bất kỳ đâu trong khu làm việc. */}
      <AppCommandPalette />
    </div>
  );
}
