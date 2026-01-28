import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  showShadow?: boolean;
  id?: string;
  zIndex?: number;
}

export function ParallaxSection({
  children,
  className,
  showShadow = false,
  id,
  zIndex,
}: ParallaxSectionProps) {
  return (
    <div
      id={id}
      className={cn(
        "relative",
        showShadow && "shadow-[0_-4px_30px_rgba(0,0,0,0.1)]",
        className,
      )}
      style={zIndex !== undefined ? { zIndex } : undefined}
    >
      {children}
    </div>
  );
}
