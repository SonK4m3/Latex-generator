"use client"

import { useState, ReactNode } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NavItem } from "@/components/layout/nav-item"
import { navItems } from "@/components/layout/nav-config"
import { GlassOverlay } from "@/components/ui/glass-overlay"
import { cn } from "@/lib/utils"

interface DrawerNavProps {
  authStatus?: ReactNode
}

export function DrawerNav({ authStatus }: DrawerNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed top-2 right-2 z-50 md:hidden">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="mobile-drawer"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Backdrop */}
      <GlassOverlay
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="md:hidden"
      />

      {/* Drawer */}
      <div
        id="mobile-drawer"
        className={cn(
          "fixed top-0 left-0 h-screen w-64 glass z-40 flex flex-col transition-transform duration-200 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-glass-border">
          <h2 className="font-bold text-sm">Menu</h2>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-2 flex-1">
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              expanded
              onClick={() => setIsOpen(false)}
            />
          ))}
        </nav>

        {/* Footer */}
        {authStatus && (
          <div className="p-2 border-t border-glass-border">{authStatus}</div>
        )}
      </div>
    </>
  )
}
