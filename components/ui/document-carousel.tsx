"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DocumentCarouselItem {
  id: string;
  title: string;
  template?: string;
  date?: string;
  onClick?: () => void;
}

export interface DocumentCarouselProps
  extends React.HTMLAttributes<HTMLDivElement> {
  items: DocumentCarouselItem[];
  onItemClick?: (item: DocumentCarouselItem) => void;
  itemsPerView?: number;
}

const DocumentCarousel = React.forwardRef<HTMLDivElement, DocumentCarouselProps>(
  ({ className, items, onItemClick, itemsPerView = 4, ...props }, ref) => {
    const [scrollPosition, setScrollPosition] = React.useState(0);
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
    const carouselRef = React.useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(true);

    // Check for prefers-reduced-motion
    React.useEffect(() => {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const checkScroll = React.useCallback(() => {
      if (!carouselRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setScrollPosition(scrollLeft);
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }, []);

    React.useEffect(() => {
      checkScroll();
      const carousel = carouselRef.current;
      if (carousel) {
        carousel.addEventListener("scroll", checkScroll);
        window.addEventListener("resize", checkScroll);
        return () => {
          carousel.removeEventListener("scroll", checkScroll);
          window.removeEventListener("resize", checkScroll);
        };
      }
    }, [checkScroll]);

    const scroll = (direction: "left" | "right") => {
      if (!carouselRef.current) return;
      const scrollAmount = carouselRef.current.clientWidth * 0.8;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scroll("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scroll("right");
      }
    };

    const handleItemClick = (item: DocumentCarouselItem) => {
      onItemClick?.(item);
      item.onClick?.();
    };

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        {/* Carousel Container with Navigation */}
        <div className="relative flex items-center gap-2">
          {/* Left scroll button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="flex-shrink-0"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Carousel viewport */}
          <div
            ref={carouselRef}
            className={cn(
              "flex-1 overflow-x-auto",
              !prefersReducedMotion && "scroll-smooth"
            )}
            role="region"
            aria-label="Document carousel"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <div className="flex gap-3 pb-2">
              {items.length === 0 ? (
                <div className="w-full flex items-center justify-center min-h-24">
                  <p className="text-sm text-muted-foreground">
                    No documents yet
                  </p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "glass flex-shrink-0 rounded-lg p-4 w-48 text-left",
                      "hover:bg-white/80 dark:hover:bg-slate-700/60",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "active:bg-white/70 dark:active:bg-slate-700/50",
                      !prefersReducedMotion && "transition-all"
                    )}
                    aria-label={`Open document: ${item.title}`}
                    title={item.title}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground truncate">
                        {item.title}
                      </h3>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {item.template && (
                          <p className="truncate">{item.template}</p>
                        )}
                        {item.date && (
                          <time dateTime={item.date} className="truncate">
                            {new Date(item.date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: item.date.includes(new Date().getFullYear().toString())
                                ? undefined
                                : "numeric",
                            })}
                          </time>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right scroll button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className="flex-shrink-0"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Scroll indicator */}
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {Math.ceil((scrollPosition + 200) / 200)} of {Math.ceil(items.length)} documents
          </p>
        )}
      </div>
    );
  }
);

DocumentCarousel.displayName = "DocumentCarousel";

export { DocumentCarousel };
