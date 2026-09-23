import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
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
