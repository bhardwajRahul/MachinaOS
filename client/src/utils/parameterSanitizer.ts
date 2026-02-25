/**
 * Parameter Sanitizer
 * Strips sensitive credentials from node parameters before export.
 * Prevents API keys, tokens, and passwords from leaking into exported workflow JSON.
 */

// Parameter names that should never appear in exported JSON
const SENSITIVE_EXACT_KEYS = new Set([
  'apiKey', 'api_key', 'apikey',
  'accessToken', 'access_token',
  'refreshToken', 'refresh_token',
  'secret', 'password', 'passwd',
  'client_id', 'client_secret', 'clientId', 'clientSecret',
  'token', 'bearerToken', 'bearer_token',
  'privateKey', 'private_key',
  'encryptionKey', 'encryption_key',
  'oauthToken', 'oauth_token',
]);

// Substring patterns - if a key contains any of these (case-insensitive),
// the value is stripped. Catches variants like "google_access_token".
const SENSITIVE_SUBSTRINGS = [
  'api_key', 'apikey', 'secret', 'password', 'token',
  'private_key', 'privatekey',
];

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_EXACT_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some(sub => lower.includes(sub));
}

/**
 * Deep-strip sensitive keys from a parameter object.
 * Returns a new object with sensitive values removed.
 * Recurses into nested objects but passes arrays through unchanged.
 */
export function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (isSensitiveKey(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeParameters(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
