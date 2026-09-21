"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState, ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlassNavbar } from "@/components/ui/glass-navbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/app", id: "nav-home" },
  { label: "CV Library", href: "/app/documents?type=cv", id: "nav-cv" },
  { label: "Settings", href: "/app/settings", id: "nav-settings" },
];

interface AppNavbarProps {
  authStatus?: ReactNode;
}

export default function AppNavbar({ authStatus }: AppNavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Skip link for accessibility */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Floating Glass Navbar */}
      <GlassNavbar
        className="top-4 left-4 right-4 mx-auto max-w-7xl rounded-full px-6 py-3"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo / Brand */}
        <Link
          href="/app"
          className="text-base font-bold tracking-tight text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-2 py-1"
          aria-label="AI LaTeX Generator - Home"
        >
          AI LaTeX Generator
        </Link>

        {/* Desktop Navigation Menu */}
        <nav
          className="hidden md:flex items-center gap-1"
          aria-label="Navigation menu"
        >
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              id={item.id}
              className={cn(
                "text-sm font-medium px-3 py-2 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive(item.href)
                  ? "text-primary bg-primary/10"
                  : "text-foreground hover:bg-accent/10"
              )}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Desktop Auth Status */}
          <div className="hidden md:flex items-center gap-3">
            {authStatus}
            <ThemeToggle />
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </GlassNavbar>

      {/* Mobile Navigation Menu */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="fixed top-20 left-4 right-4 md:hidden glass rounded-lg p-4 z-40"
          role="region"
          aria-label="Mobile navigation"
        >
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "text-sm font-medium px-3 py-2 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive(item.href)
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:bg-accent/10"
                )}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-glass-border pt-3 mt-3 flex flex-col gap-3">
              <div className="flex md:hidden">
                {authStatus}
              </div>
              <div className="flex md:hidden">
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Spacer to account for fixed navbar */}
      <div className="h-20" />
    </>
  );
}
