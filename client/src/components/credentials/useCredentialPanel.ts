/**
 * useCredentialPanel — single hook for credential panel state.
 *
 * Plain React state (no antd Form, no react-hook-form). The credential
 * panels save fields individually via `actions.save(key, value)` rather
 * than submitting a single form, so a form library is overkill — the
 * field values are just a key-value bag with stored/loading/error state
 * around them.
 *
 * Provides a generic `execute(key, fn)` that handles try/catch/loading/
 * error identically to every handleTwitterSave, handleGmailLogin, etc.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiKeys } from '../../hooks/useApiKeys';
import { useWebSocket } from '../../contexts/WebSocketContext';
import type { ProviderConfig } from './types';

export type CredentialFormValues = Record<string, string>;

export function useCredentialPanel(config: ProviderConfig, visible: boolean) {
  const [values, setValues] = useState<CredentialFormValues>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState(false);

  const { validateApiKey, saveApiKey, getStoredApiKey, hasStoredKey, removeApiKey,
    validateGoogleMapsKey, validateApifyKey, getProviderDefaults, saveProviderDefaults,
    getProviderUsageSummary, getAPIUsageSummary, getStoredModels, getModelConstraints,
    isConnected } = useApiKeys();
  const { sendRequest } = useWebSocket();

  // Imperative form-like API for compat with existing callers. Stable across
  // renders so memoized children don't re-render.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const form = useRef({
    getFieldValue: (key: string): string | undefined => valuesRef.current[key],
    getFieldsValue: (): CredentialFormValues => ({ ...valuesRef.current }),
    setFieldValue: (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    setFieldsValue: (next: CredentialFormValues) => {
      setValues((prev) => ({ ...prev, ...next }));
    },
    resetFields: () => setValues({}),
  }).current;

  // Load stored values into form when panel becomes visible. Fields load
  // in parallel via Promise.all so a 3-field provider takes one WS
  // round-trip instead of six sequential ones (fields populate together
  // instead of one-by-one on modal open).
  useEffect(() => {
    if (!visible || !isConnected || !config.fields) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        config.fields!.map(async (field) => {
          const storeKey = field.key === 'apiKey' ? config.id : field.key;
          const has = await hasStoredKey(storeKey);
          if (!has) return null;
          const val = await getStoredApiKey(storeKey);
          return val ? ([field.key, val] as const) : null;
        }),
      );
      if (cancelled) return;
      const next: CredentialFormValues = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setValues(next);
      setStored(Object.keys(next).length > 0);
      setError(null);
    })();
    return () => { cancelled = true; };
  }, [config.id, visible, isConnected]);

  // Generic action executor — replaces 19 duplicate handler functions.
  const execute = useCallback(async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    setError(null);
    try {
      const result = await fn();
      if (result && !result.success && result.error) {
        setError(result.error);
      }
      return result;
    } catch (err: any) {
      setError(err.message || `Failed: ${key}`);
      return undefined;
    } finally {
      setLoading(null);
    }
  }, []);

  // Pre-built actions that panels call directly.
  const actions = {
    validate: (id: string, key: string) => execute('validate', async () => {
      if (config.validateAs === 'google_maps') return validateGoogleMapsKey(key);
      if (config.validateAs === 'apify') return validateApifyKey(key);
      return validateApiKey(id, key);
    }),
    save: (key: string, value: string) => execute('save', () => saveApiKey(key, value)),
    remove: (key: string) => execute('remove', async () => {
      await removeApiKey(key);
      setStored(false);
      setValues({});
    }),
    oauthLogin: () => execute('login', async () => {
      const res = await sendRequest(config.ws!.login, {});
      if (res.success && res.url) window.open(res.url, '_blank');
      return res;
    }),
    oauthLogout: () => execute('logout', () => sendRequest(config.ws!.logout, {})),
    oauthRefresh: () => execute('refresh', () => sendRequest(config.ws!.status, {})),
    sendWs: (type: string, data?: Record<string, any>) => execute(type, () => sendRequest(type, data ?? {})),
  };

  return {
    form, values, loading, error, stored, setStored, setError,
    execute, actions, isConnected,
    getProviderDefaults, saveProviderDefaults,
    getProviderUsageSummary, getAPIUsageSummary,
    getStoredModels, getModelConstraints,
  };
}
