"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface GlassOverlayProps extends React.ComponentProps<"div"> {
  /** Whether the overlay is visible */
  open: boolean
  /** Called when the backdrop is clicked */
  onClose?: () => void
}

/**
 * Full-screen translucent backdrop overlay.
 * Used by DrawerNav, modals, dialogs, or any slide-over panel.
 * Handles click-to-dismiss and Escape key.
 */
function GlassOverlay({
  open,
  onClose,
  className,
  children,
  ...props
}: GlassOverlayProps) {
  React.useEffect(() => {
    if (!open || !onClose) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      data-slot="glass-overlay"
      className={cn("fixed inset-0 z-40 bg-black/40", className)}
      onClick={onClose}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  )
}

export { GlassOverlay }
