import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/u/**",
      },
    ],
  },

  // Compress responses
  compress: true,

  // Strict-mode for catching issues
  reactStrictMode: true,

  // Redirects for backward compatibility
  redirects: async () => [
    // Execution → Activity redirects (Navigation Restructure 2026-02-01)
    {
      source: "/execution/active",
      destination: "/activity/active",
      permanent: true,
    },
    {
      source: "/execution/history",
      destination: "/activity/history",
      permanent: true,
    },
    {
      source: "/execution/failed",
      destination: "/activity/failed",
      permanent: true,
    },
    {
      source: "/execution/performance",
      destination: "/analytics",
      permanent: true,
    },
    {
      source: "/execution/:taskId*",
      destination: "/activity/:taskId*",
      permanent: true,
    },
    // Workers → Activity redirects
    {
      source: "/workers",
      destination: "/activity/active",
      permanent: true,
    },
    {
      source: "/workers/history",
      destination: "/activity/history",
      permanent: true,
    },
    {
      source: "/workers/failed",
      destination: "/activity/failed",
      permanent: true,
    },
    {
      source: "/workers/:taskId*",
      destination: "/activity/:taskId*",
      permanent: true,
    },
    // Settings redirects
    {
      source: "/settings/integrations",
      destination: "/settings/connections",
      permanent: true,
    },
    {
      source: "/settings/workflow",
      destination: "/settings/automation",
      permanent: true,
    },
    // Legacy billing redirects
    {
      source: "/subscription",
      destination: "/billing",
      permanent: true,
    },
    {
      source: "/subscription/:path*",
      destination: "/billing/:path*",
      permanent: true,
    },
  ],

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

export default withAnalyzer(withNextIntl(nextConfig));
