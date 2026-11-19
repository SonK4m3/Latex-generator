"use client"

import { useState, useSyncExternalStore } from "react"
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { NavItem } from "@/components/layout/nav-item"
import { navItems } from "@/components/layout/nav-config"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isOpen?: boolean
}

const subscribeToMount = () => () => {}
const getClientMounted = () => true
const getServerMounted = () => false

export function Sidebar({ isOpen: initialOpen = true }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribeToMount, getClientMounted, getServerMounted)

  return (
    <div
      className={cn(
        "h-full glass flex flex-col transition-all duration-200",
        isOpen ? "w-64 p-2" : "w-16 p-1"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {isOpen && <h2 className="font-bold text-sm truncate">Workspace</h2>}
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <NavItem key={item.id} item={item} expanded={isOpen} />
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="border-t border-glass-border pt-2 mt-2">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(!isOpen && "mx-auto")}
          aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )
          ) : (
            <div className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  )
}
