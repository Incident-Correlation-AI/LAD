export interface JwtClaims {
  sub: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface TokenVerificationResult {
  valid: boolean;
  claims?: JwtClaims;
  error?: string;
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Validates and decodes a signed JSON Web Token (JWT).
 * Verifies 3-part structure, JSON header/payload format, subject claim,
 * and expiration timestamp.
 */
export function verifyToken(token: string): TokenVerificationResult {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Authentication token is missing" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      error: "Invalid token format: expected 3 dot-separated JWT segments",
    };
  }

  try {
    const headerJson = base64UrlDecode(parts[0]);
    const header = JSON.parse(headerJson) as Record<string, unknown>;
    if (!header || typeof header !== "object") {
      return { valid: false, error: "Invalid JWT header format" };
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const claims = JSON.parse(payloadJson) as JwtClaims;
    if (!claims || typeof claims !== "object") {
      return { valid: false, error: "Invalid JWT payload format" };
    }

    if (!claims.sub || typeof claims.sub !== "string" || !claims.sub.trim()) {
      return {
        valid: false,
        error: "Missing or invalid subject claim ('sub') in token",
      };
    }

    if (typeof claims.exp === "number") {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (claims.exp < nowSeconds) {
        return {
          valid: false,
          error: `Token expired at ${new Date(claims.exp * 1000).toISOString()}`,
          claims,
        };
      }
    }

    return { valid: true, claims };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to decode JWT: ${message}` };
  }
}

export const TOKEN_STORAGE_KEY = "lad_token";

export function getStoredToken(): string | null {
  try {
    return (
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}
