import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Enable standalone output for Docker (production only)
  ...(process.env.NODE_ENV === "production" && { output: "standalone" }),

  // Enable server actions and View Transitions API
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    viewTransition: true,
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
    ],
  },

  // Turbopack configuration
  turbopack: {
    resolveAlias: {
      // Ensure proper resolution of modules
    },
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Compress responses
  compress: true,

  // Strict-mode for catching issues
  reactStrictMode: true,

  // Security headers
  headers: async () => [
    {
      source: "/:path*",
      headers: [{ key: "X-DNS-Prefetch-Control", value: "on" }],
    },
  ],

  // Webpack configuration (fallback when not using Turbopack)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Fix worker thread module resolution issues
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          "thread-stream": "commonjs thread-stream",
        });
      }
    }
    return config;
  },
};

export default withAnalyzer(nextConfig);
