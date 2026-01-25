import * as jose from "jose";
import type { Env } from "../types";
import { logInfo, logWarning } from "./error-logger";

/**
 * Cloudflare Access JWT payload
 */
interface AccessJWTPayload {
  email?: string;
  sub?: string;
  aud?: string[];
  iss?: string;
  iat?: number;
  exp?: number;
}

/**
 * Validate Cloudflare Access JWT and return user email
 */
export async function validateAccessJWT(
  request: Request,
  env: Env,
): Promise<string | null> {
  // Get JWT from cookie or header
  const cookieHeader = request.headers.get("Cookie");
  const authHeader = request.headers.get("CF-Access-JWT-Assertion");

  let token: string | null = null;

  if (authHeader) {
    token = authHeader;
  } else if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    token = cookies["CF_Authorization"] ?? null;
  }

  if (!token) {
    logInfo("No JWT token found", {
      module: "auth",
      operation: "validateAccessJWT",
    });
    return null;
  }

  try {
    // Fetch Cloudflare Access public keys
    const certsUrl = `${env.TEAM_DOMAIN}/cdn-cgi/access/certs`;
    const certsResponse = await fetch(certsUrl);

    if (!certsResponse.ok) {
      logWarning(
        `Failed to fetch Access certs: ${String(certsResponse.status)}`,
        {
          module: "auth",
          operation: "validateAccessJWT",
          metadata: { status: certsResponse.status },
        },
      );
      return null;
    }

    const certs = (await certsResponse.json()) as { keys: jose.JWK[] };
    const jwks = jose.createLocalJWKSet({ keys: certs.keys });

    // Verify the token
    const { payload } = await jose.jwtVerify(token, jwks, {
      audience: env.POLICY_AUD,
      issuer: env.TEAM_DOMAIN,
    });

    const accessPayload = payload as AccessJWTPayload;
    const email = accessPayload.email ?? accessPayload.sub ?? null;

    if (email) {
      logInfo(`Authenticated user: ${email}`, {
        module: "auth",
        operation: "validateAccessJWT",
        userId: email,
      });
    }

    return email;
  } catch (error) {
    logWarning(
      `JWT validation failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        module: "auth",
        operation: "validateAccessJWT",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    );
    return null;
  }
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      cookies[name] = valueParts.join("=");
    }
  }

  return cookies;
}
