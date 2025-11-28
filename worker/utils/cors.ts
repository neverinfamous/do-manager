import type { CorsHeaders } from '../types'

/**
 * Allowed origins for CORS
 */
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
]

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: Request): CorsHeaders {
  const origin = request.headers.get('Origin')
  
  // Check if origin is allowed or if it's a production deployment
  const allowedOrigin = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.workers.dev') ||
    origin.endsWith('.pages.dev')
  ) ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-Client-Id, CF-Access-Client-Secret',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(corsHeaders: CorsHeaders): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * Check if request is from localhost (development)
 */
export function isLocalDevelopment(request: Request): boolean {
  const url = new URL(request.url)
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.local')
  )
}

