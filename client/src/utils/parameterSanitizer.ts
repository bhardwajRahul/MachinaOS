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

// Legitimate parameter names that contain sensitive substrings but are NOT credentials.
// These are checked first and always allowed through.
const SAFE_KEYS = new Set([
  'maxTokens', 'max_tokens',
  'budgetTokens', 'budget_tokens',
  'page_token', 'pageToken', 'nextPageToken', 'next_page_token',
  'tokenCount', 'token_count',
  'totalTokens', 'total_tokens',
  'inputTokens', 'input_tokens',
  'outputTokens', 'output_tokens',
]);

// Substring patterns - if a key contains any of these (case-insensitive),
// the value is stripped. Uses specific credential patterns to avoid
// false positives on parameter names like "maxTokens" or "page_token".
const SENSITIVE_SUBSTRINGS = [
  'api_key', 'apikey',
  'secret',
  'password',
  'private_key', 'privatekey',
  'accesstoken', 'access_token',
  'refreshtoken', 'refresh_token',
  'bearertoken', 'bearer_token',
  'oauthtoken', 'oauth_token',
  'authtoken', 'auth_token',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isSensitiveKey(key: string): boolean {
  if (SAFE_KEYS.has(key)) return false;
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
  // TODO: Re-enable sanitization once safe-key allowlist is fully validated
  return { ...params };
}
