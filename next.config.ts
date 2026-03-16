import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["exceljs"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  webpack: (config) => {
    // Redirect webpack cache to local disk to avoid ENOSPC on network drives
    if (process.env.WEBPACK_CACHE_DIR) {
      config.cache = {
        type: "filesystem",
        cacheDirectory: process.env.WEBPACK_CACHE_DIR,
      };
    }
    return config;
  },
};

export default nextConfig;
