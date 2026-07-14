import type { NextConfig } from "next";

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