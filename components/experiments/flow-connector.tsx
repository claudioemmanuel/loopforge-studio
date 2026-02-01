"use client";

interface FlowConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  animated?: boolean;
}

export function FlowConnector({
  from,
  to,
  color = "hsl(var(--border))",
  animated = false,
}: FlowConnectorProps) {
  // Calculate control points for curved line
  const midX = (from.x + to.x) / 2;

  // Create curved path (bezier curve)
  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ overflow: "visible" }}
    >
      <defs>
        {animated && (
          <style>
            {`
              @keyframes dash {
                to {
                  stroke-dashoffset: 0;
                }
              }
            `}
          </style>
        )}
      </defs>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={animated ? "8 8" : undefined}
        style={
          animated
            ? {
                strokeDashoffset: 16,
                animation: "dash 1s linear infinite",
              }
            : undefined
        }
      />
      {/* Arrow head */}
      <circle cx={to.x} cy={to.y} r="3" fill={color} />
    </svg>
  );
}
