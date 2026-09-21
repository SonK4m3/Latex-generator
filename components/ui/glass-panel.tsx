import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  scrollable?: boolean;
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, title, subtitle, scrollable = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass rounded-lg flex flex-col h-full",
          scrollable && "overflow-hidden flex-1",
          className
        )}
        {...props}
      >
        {(title || subtitle) && (
          <div className="border-b border-glass-border px-2 py-1 flex-shrink-0">
            {title && (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        )}
        <div className={cn(scrollable && "overflow-y-auto flex-1")}>
          {children}
        </div>
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";

export { GlassPanel };
