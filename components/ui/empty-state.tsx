import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

/**
 * Placeholder shown when a list/panel has no content.
 * Provides a clear next action to the user.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>
      )}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {children}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export { EmptyState }
