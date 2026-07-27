import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live Nest API on Render — never proxy production traffic to Fly/localhost. */
const LIVE_API = "https://admin-society-one.onrender.com";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function resolveTarget(): string {
  const raw = process.env.API_PROXY_TARGET?.trim() || "";
  const stale =
    /fly\.dev|\.fly\.io|\.fly\.dev/i.test(raw) ||
    /localhost|127\.0\.0\.1/i.test(raw);
  if (process.env.VERCEL) {
    if (!raw || stale) return LIVE_API;
    return raw.replace(/\/$/, "");
  }
  return (raw || "http://localhost:4000").replace(/\/$/, "");
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const target = resolveTarget();
  const path = pathSegments.map(encodeURIComponent).join("/");
  const dest = `${target}/api/v1/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(dest, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        error: `Cannot reach Nest API at ${target}: ${message}`,
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
