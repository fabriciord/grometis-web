const TOKEN_KEY = 'grometis_access_token';

type JwtPayload = {
  exp?: unknown;
};

function safeParseJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const json = atob(padded);
    const obj = JSON.parse(json) as JwtPayload;
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = safeParseJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + skewSeconds;
}
