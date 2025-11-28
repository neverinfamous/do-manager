/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  message: string,
  corsHeaders: Record<string, string>,
  status = 500
): Response {
  return jsonResponse(
    { error: message },
    corsHeaders,
    status
  )
}

/**
 * Parse JSON body from request, returning null on failure
 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T
  } catch {
    return null
  }
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Validate that a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Safe JSON parse with default value
 */
export function safeJsonParse<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue
  }
}

