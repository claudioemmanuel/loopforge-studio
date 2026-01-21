"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface LoopforgeLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  animate?: boolean;
  showSparks?: boolean;
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { width: 32, height: 32, strokeWidth: 3 },
  md: { width: 48, height: 48, strokeWidth: 3.5 },
  lg: { width: 64, height: 64, strokeWidth: 4 },
  xl: { width: 96, height: 96, strokeWidth: 4.5 },
  "2xl": { width: 128, height: 128, strokeWidth: 5 },
};

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  life: number;
}

export function LoopforgeLogo({
  size = "md",
  animate = true,
  showSparks = true,
  showText = false,
  className,
}: LoopforgeLogoProps) {
  const gradientId = useId();
  const glowId = useId();
  const { width, height, strokeWidth } = sizeMap[size];
  const [sparks, setSparks] = useState<Spark[]>([]);

  // Spark animation effect
  useEffect(() => {
    if (!animate || !showSparks) return;

    const interval = setInterval(() => {
      setSparks((prev) => {
        // Remove dead sparks
        const alive = prev
          .map((s) => ({ ...s, life: s.life - 0.05 }))
          .filter((s) => s.life > 0);

        // Add new spark occasionally
        if (Math.random() > 0.6 && alive.length < 8) {
          const angle = Math.random() * Math.PI * 2;
          // Spawn from the loop path
          const spawnAngle = Math.random() * Math.PI * 2;
          const loopX = 50 + Math.cos(spawnAngle) * 20;
          const loopY = 50 + Math.sin(spawnAngle * 2) * 12;

          alive.push({
            id: Date.now() + Math.random(),
            x: loopX,
            y: loopY,
            angle,
            speed: 0.5 + Math.random() * 1.5,
            size: 1 + Math.random() * 2,
            life: 1,
          });
        }

        // Move sparks
        return alive.map((s) => ({
          ...s,
          x: s.x + Math.cos(s.angle) * s.speed,
          y: s.y + Math.sin(s.angle) * s.speed - 0.3, // Float upward
        }));
      });
    }, 50);

    return () => clearInterval(interval);
  }, [animate, showSparks]);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Animated gradient for molten metal effect */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(152, 60%, 45%)">
              {animate && (
                <animate
                  attributeName="stop-color"
                  values="hsl(152, 60%, 45%);hsl(170, 55%, 50%);hsl(45, 90%, 55%);hsl(25, 85%, 55%);hsl(152, 60%, 45%)"
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
            </stop>
            <stop offset="50%" stopColor="hsl(170, 55%, 50%)">
              {animate && (
                <animate
                  attributeName="stop-color"
                  values="hsl(170, 55%, 50%);hsl(45, 90%, 55%);hsl(25, 85%, 55%);hsl(152, 60%, 45%);hsl(170, 55%, 50%)"
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
            </stop>
            <stop offset="100%" stopColor="hsl(45, 90%, 55%)">
              {animate && (
                <animate
                  attributeName="stop-color"
                  values="hsl(45, 90%, 55%);hsl(25, 85%, 55%);hsl(152, 60%, 45%);hsl(170, 55%, 50%);hsl(45, 90%, 55%)"
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
            </stop>
          </linearGradient>

          {/* Glow filter */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background glow pulse */}
        {animate && (
          <ellipse
            cx="50"
            cy="50"
            rx="25"
            ry="15"
            fill={`url(#${gradientId})`}
            opacity="0.15"
          >
            <animate
              attributeName="opacity"
              values="0.1;0.25;0.1"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="rx"
              values="25;28;25"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="ry"
              values="15;18;15"
              dur="2s"
              repeatCount="indefinite"
            />
          </ellipse>
        )}

        {/* Infinity loop path */}
        <path
          d="M50 50
             C50 35, 70 35, 70 50
             C70 65, 50 65, 50 50
             C50 35, 30 35, 30 50
             C30 65, 50 65, 50 50"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={animate ? `url(#${glowId})` : undefined}
        >
          {animate && (
            <animate
              attributeName="stroke-dasharray"
              values="0 1000;200 1000;0 1000"
              dur="4s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* Static base infinity for visibility */}
        <path
          d="M50 50
             C50 35, 70 35, 70 50
             C70 65, 50 65, 50 50
             C50 35, 30 35, 30 50
             C30 65, 50 65, 50 50"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth * 0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.6"
        />

        {/* Animated sparks */}
        {showSparks &&
          sparks.map((spark) => (
            <circle
              key={spark.id}
              cx={spark.x}
              cy={spark.y}
              r={spark.size}
              fill={`hsl(${35 + Math.random() * 20}, 90%, ${55 + spark.life * 20}%)`}
              opacity={spark.life * 0.8}
            >
              <animate
                attributeName="r"
                values={`${spark.size};${spark.size * 0.5};0`}
                dur="0.5s"
                fill="freeze"
              />
            </circle>
          ))}

        {/* Center forge point */}
        <circle cx="50" cy="50" r="3" fill={`url(#${gradientId})`}>
          {animate && (
            <>
              <animate
                attributeName="r"
                values="2.5;4;2.5"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.8;1;0.8"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </>
          )}
        </circle>
      </svg>

      {showText && (
        <span className="mt-1 text-xl font-bold tracking-tight">
          <span className="text-primary">Loop</span>
          <span className="text-foreground">forge</span>
        </span>
      )}
    </div>
  );
}

// Compact icon version (just the symbol, no text)
export function LoopforgeIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(152, 60%, 45%)" />
          <stop offset="50%" stopColor="hsl(170, 55%, 50%)" />
          <stop offset="100%" stopColor="hsl(45, 90%, 55%)" />
        </linearGradient>
      </defs>

      <path
        d="M50 50
           C50 35, 70 35, 70 50
           C70 65, 50 65, 50 50
           C50 35, 30 35, 30 50
           C30 65, 50 65, 50 50"
        stroke={`url(#${gradientId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="50" cy="50" r="4" fill={`url(#${gradientId})`} />
    </svg>
  );
}
