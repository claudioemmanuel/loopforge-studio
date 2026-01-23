"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageTransition component wraps page content and applies smooth
 * view transitions when navigating between pages.
 *
 * Uses the View Transitions API when available, with a CSS fallback
 * for browsers that don't support it.
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only trigger animation if path actually changed
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    const element = contentRef.current;
    if (!element) return;

    // Check if View Transitions API is supported (native in modern browsers)
    if ("startViewTransition" in document) {
      // The API handles the transition automatically when DOM changes
      // We just need to ensure our CSS view-transition-name is applied
      return;
    }

    // Fallback: manually trigger CSS animation for older browsers
    element.style.animation = "none";
    // Force reflow to restart animation
    void element.offsetHeight;
    element.style.animation = "";
  }, [pathname]);

  return (
    <div
      ref={contentRef}
      className={`page-transition ${className}`.trim()}
    >
      {children}
    </div>
  );
}
