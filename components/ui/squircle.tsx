"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  type CSSProperties,
  type ReactNode,
  type ElementType,
  type ComponentPropsWithoutRef,
} from "react";
import { getSvgPath } from "figma-squircle";

// ============================================================================
// Presets
// ============================================================================

export const SQUIRCLE_PRESETS = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
} as const;

export type SquirclePreset = keyof typeof SQUIRCLE_PRESETS;

type CornerRadiusInput = number | SquirclePreset | "full";

function resolveRadius(
  input: CornerRadiusInput,
  width: number,
  height: number,
): number {
  if (input === "full") return Math.min(width, height) / 2;
  if (typeof input === "string") return SQUIRCLE_PRESETS[input];
  return input;
}

// ============================================================================
// Ref merging helper
// ============================================================================

function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref && typeof ref === "object") {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    }
  };
}

// ============================================================================
// useSquircle hook
// ============================================================================

export interface UseSquircleOptions {
  cornerRadius: CornerRadiusInput;
  cornerSmoothing?: number;
  topLeftCornerRadius?: number;
  topRightCornerRadius?: number;
  bottomRightCornerRadius?: number;
  bottomLeftCornerRadius?: number;
}

export function useSquircle(options: UseSquircleOptions) {
  const {
    cornerRadius,
    cornerSmoothing = 0.6,
    topLeftCornerRadius,
    topRightCornerRadius,
    bottomRightCornerRadius,
    bottomLeftCornerRadius,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [clipPath, setClipPath] = useState<string | undefined>(undefined);
  const [svgPath, setSvgPath] = useState<string>("");

  const updatePath = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (w === 0 || h === 0) return;

    const r = resolveRadius(cornerRadius, w, h);

    const path = getSvgPath({
      width: w,
      height: h,
      cornerRadius: r,
      cornerSmoothing,
      ...(topLeftCornerRadius !== undefined && { topLeftCornerRadius }),
      ...(topRightCornerRadius !== undefined && { topRightCornerRadius }),
      ...(bottomRightCornerRadius !== undefined && { bottomRightCornerRadius }),
      ...(bottomLeftCornerRadius !== undefined && { bottomLeftCornerRadius }),
    });

    setClipPath(`path('${path}')`);
    setSvgPath(path);
  }, [
    cornerRadius,
    cornerSmoothing,
    topLeftCornerRadius,
    topRightCornerRadius,
    bottomRightCornerRadius,
    bottomLeftCornerRadius,
  ]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updatePath();

    const observer = new ResizeObserver(() => {
      updatePath();
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [updatePath]);

  const style: CSSProperties = clipPath ? { clipPath } : {};

  return { ref, style, svgPath };
}

// ============================================================================
// <Squircle> component
// ============================================================================

type SquircleOwnProps = {
  cornerRadius: CornerRadiusInput;
  cornerSmoothing?: number;
  borderWidth?: number;
  borderColor?: string;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  children?: ReactNode;
};

type SquircleProps<C extends ElementType = "div"> = SquircleOwnProps &
  Omit<ComponentPropsWithoutRef<C>, keyof SquircleOwnProps>;

export const Squircle = forwardRef<HTMLElement, SquircleProps>(
  function Squircle(
    {
      cornerRadius,
      cornerSmoothing = 0.6,
      borderWidth,
      borderColor,
      className,
      style: externalStyle,
      as: Component = "div",
      children,
      ...rest
    },
    externalRef,
  ) {
    const {
      ref: internalRef,
      style: squircleStyle,
      svgPath,
    } = useSquircle({
      cornerRadius,
      cornerSmoothing,
    });

    const mergedRef = mergeRefs(internalRef, externalRef);

    return (
      <Component
        ref={mergedRef}
        className={className}
        style={{ ...squircleStyle, position: "relative", ...externalStyle }}
        {...rest}
      >
        {children}
        {borderWidth && borderColor && svgPath && (
          <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ position: "absolute", inset: 0 }}
          >
            <path
              d={svgPath}
              fill="none"
              stroke={borderColor}
              strokeWidth={borderWidth}
            />
          </svg>
        )}
      </Component>
    );
  },
);
