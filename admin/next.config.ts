import type { NextConfig } from "next";
import path from "path";

/**
 * API traffic uses `src/app/api/v1/[...path]/route.ts` (in-app proxy to Nest).
 * Rewrites are intentionally omitted so a stale Vercel `API_PROXY_TARGET`
 * (e.g. old Fly.io) cannot hijack `/api/v1/*` away from the route handler.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
