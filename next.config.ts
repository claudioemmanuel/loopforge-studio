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

  // Turbopack configuration
  turbopack: {
    resolveAlias: {
      // Ensure proper resolution of modules
    },
  },

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

export default nextConfig;
