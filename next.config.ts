import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/upload/:path*",
        destination: "/api/upload/serve/:path*",
      },
    ];
  },
};

export default nextConfig;