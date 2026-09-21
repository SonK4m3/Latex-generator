import * as React from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type ButtonVariants = VariantProps<typeof buttonVariants>

interface IconButtonProps
  extends React.ComponentProps<"button">,
    Pick<ButtonVariants, "variant"> {
  /** Accessible label — also shown as tooltip */
  label: string
  /** Icon size preset */
  size?: "xs" | "sm" | "default" | "lg"
  /** Tooltip placement */
  tooltipSide?: "top" | "bottom" | "left" | "right"
}

const sizeMap = {
  xs: "icon-xs",
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
} as const

/**
 * Button that renders a single icon with a tooltip for its label.
 * Wraps Button + Tooltip to eliminate repeated boilerplate.
 */
function IconButton({
  label,
  size = "default",
  variant = "ghost",
  tooltipSide = "top",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size={sizeMap[size]}
            aria-label={label}
            className={cn(className)}
            {...props}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { IconButton }
