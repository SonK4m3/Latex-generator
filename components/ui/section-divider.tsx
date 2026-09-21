import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionDividerProps extends React.ComponentProps<"div"> {
  label?: string
}

/**
 * Horizontal divider with optional centered label.
 * Used between sidebar sections, form groups, etc.
 */
function SectionDivider({ label, className, ...props }: SectionDividerProps) {
  if (!label) {
    return (
      <div
        data-slot="section-divider"
        role="separator"
        className={cn("border-t border-glass-border", className)}
        {...props}
      />
    )
  }

  return (
    <div
      data-slot="section-divider"
      role="separator"
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="flex-1 border-t border-glass-border" />
      <span className="shrink-0">{label}</span>
      <span className="flex-1 border-t border-glass-border" />
    </div>
  )
}

export { SectionDivider }
