import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker (production only)
  ...(process.env.NODE_ENV === "production" && { output: "standalone" }),

  // Enable server actions and View Transitions API
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    viewTransition: true,
  },
};

export default nextConfig;
