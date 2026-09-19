import type { NextConfig } from "next";

const API = process.env.API_ORIGIN ?? "http://localhost:4100";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/socket.io/:path*", destination: `${API}/api/socket.io/:path*` },
      { source: "/api/:path*", destination: `${API}/api/:path*` },
    ];
  },
};

export default nextConfig;
