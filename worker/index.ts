import type { Env } from './types'
import { validateAccessJWT } from './utils/auth'
import { getCorsHeaders, handleCorsPreflightRequest, isLocalDevelopment } from './utils/cors'
import { handleNamespaceRoutes } from './routes/namespaces'
import { handleInstanceRoutes } from './routes/instances'
import { handleStorageRoutes } from './routes/storage'
import { handleAlarmRoutes } from './routes/alarms'
import { handleBackupRoutes } from './routes/backup'
import { handleExportRoutes } from './routes/export'
import { handleMetricsRoutes } from './routes/metrics'
import { handleJobRoutes } from './routes/jobs'
import { handleBatchRoutes } from './routes/batch'
import { handleSearchRoutes } from './routes/search'
import { handleWebhookRoutes } from './routes/webhooks'
import { handleHealthRoutes } from './routes/health'

/**
 * Main request handler
 */
async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  console.log('[Request]', request.method, url.pathname)

  // Handle CORS
  const corsHeaders = getCorsHeaders(request)
  if (request.method === 'OPTIONS') {
    return handleCorsPreflightRequest(corsHeaders)
  }

  // If not an API request, serve static assets
  if (!url.pathname.startsWith('/api/')) {
    return env.ASSETS.fetch(request)
  }

  // Authentication
  const isLocalhost = isLocalDevelopment(request)
  let userEmail: string | null = null

  if (isLocalhost) {
    console.log('[Auth] Localhost detected, skipping JWT validation')
    userEmail = 'dev@localhost'
  } else {
    userEmail = await validateAccessJWT(request, env)
    if (!userEmail) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }
  }

  // Check if we're in local dev mode (no credentials)
  const isLocalDev = isLocalhost && (!env.ACCOUNT_ID || !env.API_KEY)

  console.log('[Environment]', {
    isLocalhost,
    hasAccountId: Boolean(env.ACCOUNT_ID),
    hasApiKey: Boolean(env.API_KEY),
    isLocalDev,
  })

  // Route API requests
  if (url.pathname.startsWith('/api/namespaces')) {
    // Check if it's an instances sub-route
    if (url.pathname.includes('/instances')) {
      return handleInstanceRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
    }
    // Check for namespace export sub-route
    if (url.pathname.includes('/export')) {
      return handleExportRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
    }
    return handleNamespaceRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/instances')) {
    // Check for storage, sql, or import sub-routes
    if (url.pathname.includes('/storage') || url.pathname.includes('/sql') || url.pathname.includes('/import')) {
      return handleStorageRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
    }
    // Check for alarm sub-routes
    if (url.pathname.includes('/alarm')) {
      return handleAlarmRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
    }
    // Check for backup/restore sub-routes
    if (url.pathname.includes('/backup') || url.pathname.includes('/restore')) {
      return handleBackupRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
    }
    // Check for export sub-routes
    if (url.pathname.includes('/export')) {
      return handleExportRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
    }
    // Clone and other instance routes handled by instanceRoutes
    return handleInstanceRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/backups')) {
    return handleBackupRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/metrics')) {
    return handleMetricsRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/jobs')) {
    return handleJobRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/batch')) {
    return handleBatchRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/search')) {
    return handleSearchRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/webhooks')) {
    return handleWebhookRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  if (url.pathname.startsWith('/api/health')) {
    return handleHealthRoutes(request, env, url, corsHeaders, isLocalDev, userEmail)
  }

  // 404 for unknown API routes
  return new Response(
    JSON.stringify({ error: 'Not Found', message: `Route ${url.pathname} not found` }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  )
}

/**
 * Cloudflare Worker Entry Point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleApiRequest(request, env)
    } catch (err) {
      console.error('[Worker] Unhandled error:', err)
      const corsHeaders = getCorsHeaders(request)
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred. Please try again later.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }
  },
}

