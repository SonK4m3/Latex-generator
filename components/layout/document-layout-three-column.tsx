"use client";

import { cn } from "@/lib/utils";

/**
 * 3-Column Layout Component for DocumentWorkspace
 * 
 * Layout Structure:
 * - Desktop (lg+): Sidebar (250px) | Preview (40%) | Chat (60%)
 * - Tablet (md): Sidebar (hidden) | Preview (50%) | Chat (50%)
 * - Mobile (sm): Stack vertically - Preview | Chat (scrollable)
 * 
 * Uses 8px spacing scale:
 * - gap-1: 8px
 * - gap-2: 16px (used for main sections)
 * - p-1, p-2, p-4: 8px, 16px, 32px
 */

interface DocumentLayout3ColumnProps {
  sidebar?: React.ReactNode;
  preview: React.ReactNode;
  chat: React.ReactNode;
  className?: string;
}

export function DocumentLayout3Column({
  sidebar,
  preview,
  chat,
  className,
}: DocumentLayout3ColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row h-screen md:h-full w-full gap-2",
        className
      )}
    >
      {/* Sidebar — visible only on md+ (after fixed sidebar in layout.tsx) */}
      {sidebar && (
        <aside className="hidden lg:block w-64 flex-shrink-0 min-h-0 overflow-y-auto p-2">
          {sidebar}
        </aside>
      )}

      {/* Main Content Grid: Preview | Chat */}
      <div className="flex flex-col md:flex-row flex-1 gap-2 min-h-0">
        {/* Preview Column (40% on lg, 50% on md, full on mobile) */}
        <div
          className={cn(
            "flex-1 min-h-0 p-2",
            "md:basis-1/2 md:flex-grow",
            "lg:basis-2/5 lg:flex-grow-0"
          )}
        >
          {preview}
        </div>

        {/* Chat Column (60% on lg, 50% on md, full on mobile) */}
        <div
          className={cn(
            "w-full md:basis-1/2 md:flex-grow lg:basis-3/5 lg:flex-grow-0 min-h-0 p-2"
          )}
        >
          {chat}
        </div>
      </div>
    </div>
  );
}

export default DocumentLayout3Column;
