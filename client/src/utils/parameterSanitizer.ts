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

/**
 * Check if a parameter key holds sensitive credential data.
 * Returns true if the key should be stripped from exports.
 */
function isSensitiveKey(key: string): boolean {
  if (SAFE_KEYS.has(key)) return false;
  if (SENSITIVE_EXACT_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some(sub => lower.includes(sub));
}

// Runtime/state keys that should not appear in exported workflows.
// These are transient execution state, not user configuration.
const RUNTIME_KEYS = new Set([
  'memoryContent',         // Conversation history (personal data)
  'token_usage',           // Execution token metrics
  'execution_time',        // Runtime timing
  'last_execution',        // Last execution result
  'last_result',           // Cached result
]);

/**
 * Deep-strip sensitive and runtime keys from a parameter object.
 * Returns a new object with sensitive values removed.
 * Recurses into nested objects but passes arrays through unchanged.
 */
export function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    // Skip sensitive credential keys
    if (isSensitiveKey(key)) continue;

    // Skip runtime/state keys
    if (RUNTIME_KEYS.has(key)) continue;

    // Recurse into nested objects (but not arrays or null)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = sanitizeParameters(value);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
