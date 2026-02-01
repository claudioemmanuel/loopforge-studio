/**
 * Accessibility utilities for execution graph
 */

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(prefers-contrast: high)").matches ||
    window.matchMedia("(prefers-contrast: more)").matches
  );
}

/**
 * Get animation duration based on user preferences
 */
export function getAnimationDuration(
  normalDuration: number,
  reducedDuration = 0,
): number {
  return prefersReducedMotion() ? reducedDuration : normalDuration;
}

/**
 * ARIA announcements for screen readers
 */
export class GraphAnnouncer {
  private liveRegion: HTMLDivElement | null = null;

  constructor() {
    if (typeof window === "undefined") return;

    // Create live region for announcements
    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.liveRegion.className = "sr-only";
    document.body.appendChild(this.liveRegion);
  }

  /**
   * Announce a message to screen readers
   */
  announce(message: string, priority: "polite" | "assertive" = "polite"): void {
    if (!this.liveRegion) return;

    this.liveRegion.setAttribute("aria-live", priority);
    this.liveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = "";
      }
    }, 1000);
  }

  /**
   * Announce node status change
   */
  announceNodeUpdate(
    nodeLabel: string,
    oldStatus: string,
    newStatus: string,
  ): void {
    const message = `${nodeLabel} changed from ${oldStatus} to ${newStatus}`;
    this.announce(message);
  }

  /**
   * Announce graph connection status
   */
  announceConnectionStatus(connected: boolean): void {
    const message = connected
      ? "Live updates connected"
      : "Live updates disconnected";
    this.announce(message);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.parentNode.removeChild(this.liveRegion);
      this.liveRegion = null;
    }
  }
}

/**
 * Color contrast utilities (WCAG 2.1 AA compliance)
 */
export const WCAG_AA_CONTRAST_RATIO = 4.5;
export const WCAG_AA_LARGE_TEXT_RATIO = 3.0;

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number],
): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color pair meets WCAG AA standards
 */
export function meetsWCAGAA(
  foreground: [number, number, number],
  background: [number, number, number],
  isLargeText = false,
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = isLargeText
    ? WCAG_AA_LARGE_TEXT_RATIO
    : WCAG_AA_CONTRAST_RATIO;

  return ratio >= threshold;
}

/**
 * Keyboard shortcuts help text
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ["Tab", "Shift+Tab"], description: "Navigate between nodes" },
  { keys: ["Arrow keys"], description: "Move to adjacent nodes" },
  { keys: ["Enter", "Space"], description: "Select focused node" },
  { keys: ["Home"], description: "Go to first node" },
  { keys: ["End"], description: "Go to last node" },
  { keys: ["+", "="], description: "Zoom in" },
  { keys: ["-", "_"], description: "Zoom out" },
  { keys: ["F"], description: "Fit graph to view" },
  { keys: ["R"], description: "Reset zoom" },
  { keys: ["Ctrl+Arrow"], description: "Pan graph" },
] as const;

/**
 * Get keyboard shortcuts as formatted string for ARIA
 */
export function getKeyboardShortcutsARIA(): string {
  return KEYBOARD_SHORTCUTS.map(
    (shortcut) => `${shortcut.keys.join(" or ")}: ${shortcut.description}`,
  ).join(". ");
}
