import type { NextConfig } from "next";
import path from "path";

/**
 * Nest API target for the same-origin `/api/v1` rewrite.
 * Always prefer Render in production. If an env var still points at a dead
 * host (e.g. old Fly.io), force Render so login/lists do not 404 in production.
 */
const LIVE_API = "https://admin-society-one.onrender.com";

function resolveApiProxyTarget(): string {
  const raw = process.env.API_PROXY_TARGET?.trim() || "";
  const isStaleHost =
    /fly\.dev|\.fly\.io|\.fly\.dev/i.test(raw) ||
    /localhost|127\.0\.0\.1/i.test(raw);
  if (process.env.VERCEL && (!raw || isStaleHost)) {
    return LIVE_API;
  }
  return raw || "http://localhost:4000";
}

const API_PROXY_TARGET = resolveApiProxyTarget();

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
