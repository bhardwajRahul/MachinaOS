/**
 * useCredentialPanel — single hook replacing 20 useState calls + 19 handlers.
 *
 * Uses antd Form.useForm() for field state management.
 * Provides a generic `execute(key, fn)` that handles try/catch/loading/error
 * identically to every handleTwitterSave, handleGmailLogin, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { Form } from 'antd';
import { useApiKeys } from '../../hooks/useApiKeys';
import { useWebSocket } from '../../contexts/WebSocketContext';
import type { ProviderConfig } from './types';

export function useCredentialPanel(config: ProviderConfig, visible: boolean) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState(false);

  const { validateApiKey, saveApiKey, getStoredApiKey, hasStoredKey, removeApiKey,
    validateGoogleMapsKey, validateApifyKey, getProviderDefaults, saveProviderDefaults,
    getProviderUsageSummary, getAPIUsageSummary, getStoredModels, getModelConstraints,
    isConnected } = useApiKeys();
  const { sendRequest } = useWebSocket();

  // Load stored values into form when panel becomes visible
  useEffect(() => {
    if (!visible || !isConnected || !config.fields) return;
    let cancelled = false;
    (async () => {
      const values: Record<string, string> = {};
      let anyStored = false;
      for (const field of config.fields!) {
        const has = await hasStoredKey(field.key === 'apiKey' ? config.id : field.key);
        if (has) {
          const val = await getStoredApiKey(field.key === 'apiKey' ? config.id : field.key);
          if (val && !cancelled) { values[field.key] = val; anyStored = true; }
        }
      }
      if (!cancelled) {
        form.setFieldsValue(values);
        setStored(anyStored);
        setError(null);
      }
    })();
    return () => { cancelled = true; };
  }, [config.id, visible, isConnected]);

  // Generic action executor — replaces all 19 duplicate handler functions
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

  // Pre-built actions that panels call directly
  const actions = {
    validate: (id: string, key: string) => execute('validate', async () => {
      if (config.validateAs === 'google_maps') return validateGoogleMapsKey(key);
      if (config.validateAs === 'apify') return validateApifyKey(key);
      return validateApiKey(id, key);
    }),
    save: (key: string, value: string) => execute('save', () => saveApiKey(key, value)),
    remove: (key: string) => execute('remove', async () => { await removeApiKey(key); setStored(false); form.resetFields(); }),
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
    form, loading, error, stored, setStored, setError,
    execute, actions, isConnected,
    // Pass through API methods panels need
    getProviderDefaults, saveProviderDefaults,
    getProviderUsageSummary, getAPIUsageSummary,
    getStoredModels, getModelConstraints,
  };
}
