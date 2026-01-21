import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "6px",
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="iconGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="iconGradientRight" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
            <linearGradient id="iconAnvilGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
          </defs>

          {/* Left loop */}
          <path
            d="M50 50 C50 25, 20 15, 10 30 C0 45, 0 55, 10 70 C20 85, 50 75, 50 50"
            stroke="url(#iconGradientLeft)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Right loop */}
          <path
            d="M50 50 C50 25, 80 15, 90 30 C100 45, 100 55, 90 70 C80 85, 50 75, 50 50"
            stroke="url(#iconGradientRight)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Simplified anvil */}
          <path d="M38 42 L62 42 L65 46 L35 46 Z" fill="url(#iconAnvilGradient)" />
          <path d="M35 46 L35 50 L42 54 L42 62 L58 62 L58 54 L65 50 L65 46 Z" fill="url(#iconAnvilGradient)" />
          <path d="M40 62 L40 68 L60 68 L60 62 Z" fill="url(#iconAnvilGradient)" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
