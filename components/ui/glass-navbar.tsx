import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassNavbarProps
  extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean;
  sticky?: boolean;
}

const GlassNavbar = React.forwardRef<HTMLElement, GlassNavbarProps>(
  ({ className, fixed = true, sticky = false, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "glass border-b",
          fixed && "fixed top-0 left-0 right-0 z-50",
          sticky && "sticky top-0 z-40",
          "flex items-center justify-between px-6 py-4",
          className
        )}
        {...props}
      />
    );
  }
);

GlassNavbar.displayName = "GlassNavbar";

export { GlassNavbar };
