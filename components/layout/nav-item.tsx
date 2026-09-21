"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface NavItemConfig {
  icon: LucideIcon
  label: string
  href: string
  id: string
}

interface NavItemProps {
  item: NavItemConfig
  /** When false, only icon is shown with a tooltip for the label */
  expanded?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Shared navigation link used by Sidebar (desktop) and DrawerNav (mobile).
 * Renders icon + label when expanded, icon-only with tooltip when collapsed.
 */
export function NavItem({
  item,
  expanded = true,
  onClick,
  className,
}: NavItemProps) {
  const link = (
    <Link
      href={item.href}
      id={item.id}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors",
        "hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "justify-start" : "justify-center",
        className
      )}
      onClick={onClick}
    >
      <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {expanded && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}
