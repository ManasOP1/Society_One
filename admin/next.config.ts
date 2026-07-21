import type { NextConfig } from "next";
import path from "path";

/** Nest API target for dev proxy — avoids browser CORS / connection issues. */
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET?.trim() || "http://localhost:4000";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
