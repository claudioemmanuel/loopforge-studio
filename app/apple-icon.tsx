import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderRadius: "40px",
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="appleGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="50%" stopColor="#0088CC" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="appleGradientRight" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
            <linearGradient id="appleAnvilGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="30%" stopColor="#E2E8F0" />
              <stop offset="70%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
            <filter id="appleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Left loop */}
          <path
            d="M50 50 C50 25, 20 15, 10 30 C0 45, 0 55, 10 70 C20 85, 50 75, 50 50"
            stroke="url(#appleGradientLeft)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            filter="url(#appleGlow)"
          />

          {/* Right loop */}
          <path
            d="M50 50 C50 25, 80 15, 90 30 C100 45, 100 55, 90 70 C80 85, 50 75, 50 50"
            stroke="url(#appleGradientRight)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            filter="url(#appleGlow)"
          />

          {/* Anvil */}
          <g filter="url(#appleGlow)">
            <path d="M38 42 L62 42 L65 46 L35 46 Z" fill="url(#appleAnvilGradient)" />
            <path d="M33 46 L28 47 L28 50 L35 50 Z" fill="url(#appleAnvilGradient)" />
            <path d="M67 46 L72 46 L72 52 L65 50 Z" fill="url(#appleAnvilGradient)" />
            <path d="M35 46 L35 50 L42 54 L42 62 L58 62 L58 54 L65 50 L65 46 Z" fill="url(#appleAnvilGradient)" />
            <path d="M40 62 L40 68 L38 70 L62 70 L60 68 L60 62 Z" fill="url(#appleAnvilGradient)" />
          </g>

          {/* Shine */}
          <path d="M40 44 L60 44" stroke="white" strokeWidth="0.8" opacity="0.5" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
