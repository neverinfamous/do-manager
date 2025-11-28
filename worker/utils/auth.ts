import * as jose from 'jose'
import type { Env } from '../types'

/**
 * Cloudflare Access JWT payload
 */
interface AccessJWTPayload {
  email?: string
  sub?: string
  aud?: string[]
  iss?: string
  iat?: number
  exp?: number
}

/**
 * Validate Cloudflare Access JWT and return user email
 */
export async function validateAccessJWT(
  request: Request,
  env: Env
): Promise<string | null> {
  // Get JWT from cookie or header
  const cookieHeader = request.headers.get('Cookie')
  const authHeader = request.headers.get('CF-Access-JWT-Assertion')
  
  let token: string | null = null
  
  if (authHeader) {
    token = authHeader
  } else if (cookieHeader) {
    const cookies = parseCookies(cookieHeader)
    token = cookies['CF_Authorization'] ?? null
  }
  
  if (!token) {
    console.log('[Auth] No JWT token found')
    return null
  }
  
  try {
    // Fetch Cloudflare Access public keys
    const certsUrl = `${env.TEAM_DOMAIN}/cdn-cgi/access/certs`
    const certsResponse = await fetch(certsUrl)
    
    if (!certsResponse.ok) {
      console.error('[Auth] Failed to fetch Access certs:', certsResponse.status)
      return null
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const certs = await certsResponse.json() as { keys: jose.JWK[] }
    const jwks = jose.createLocalJWKSet({ keys: certs.keys })
    
    // Verify the token
    const { payload } = await jose.jwtVerify(token, jwks, {
      audience: env.POLICY_AUD,
      issuer: env.TEAM_DOMAIN,
    })
    
    const accessPayload = payload as AccessJWTPayload
    const email = accessPayload.email ?? accessPayload.sub ?? null
    
    if (email) {
      console.log('[Auth] Authenticated user:', email)
    }
    
    return email
  } catch (error) {
    console.error('[Auth] JWT validation failed:', error)
    return null
  }
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (name) {
      cookies[name] = valueParts.join('=')
    }
  }
  
  return cookies
}

