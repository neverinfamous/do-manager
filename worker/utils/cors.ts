import type { CorsHeaders } from "../types";

/**
 * Allowed origins for CORS
 */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8787",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8787",
];

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: Request): CorsHeaders {
  const origin = request.headers.get("Origin");

  // Check if origin is allowed or if it's a production deployment
  const allowedOrigin =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith(".workers.dev") ||
      origin.endsWith(".pages.dev"))
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, CF-Access-Client-Id, CF-Access-Client-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(corsHeaders: CorsHeaders): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Check if request is from localhost (development)
 * Note: When running `wrangler dev` with custom routes, the hostname/origin
 * will show the production domain. We detect this by checking for the
 * production domain without CF-Access headers (which would be present in real production).
 */
export function isLocalDevelopment(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");

  // Check request URL hostname
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname.endsWith(".local")
  ) {
    return true;
  }

  // Check Origin header (for proxied requests from Vite)
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (
        originUrl.hostname === "localhost" ||
        originUrl.hostname === "127.0.0.1"
      ) {
        return true;
      }
    } catch {
      // Invalid origin URL, ignore
    }
  }

  // Special case: wrangler dev with custom routes uses production hostname
  // but without CF-Access headers. Real production always has these headers.
  const hasCfAccessToken =
    request.headers.has("CF-Access-JWT-Assertion") ||
    request.headers.has("Cf-Access-Jwt-Assertion");
  const isProductionDomain =
    url.hostname === "do.adamic.tech" ||
    (origin?.includes("do.adamic.tech") ?? false);

  if (isProductionDomain && !hasCfAccessToken) {
    return true;
  }

  return false;
}
