import { useState, useEffect, useCallback } from 'react';
import { notification } from 'antd';
import { useApiKeys } from './useApiKeys';

export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

interface UseApiKeyValidationProps {
  provider?: string;
  onSuccess?: (models: string[]) => void;
}

export const useApiKeyValidation = ({ provider, onSuccess }: UseApiKeyValidationProps) => {
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [hasStoredKeyState, setHasStoredKeyState] = useState(false);

  // Use WebSocket-based API key management
  const {
    validateApiKey: wsValidateApiKey,
    getStoredApiKey: wsGetStoredApiKey,
    hasStoredKey: wsHasStoredKey,
    removeApiKey: wsRemoveApiKey,
    getStoredModels: wsGetStoredModels
  } = useApiKeys();

  // Check for existing key on mount
  useEffect(() => {
    if (!provider) return;

    const checkStoredKey = async () => {
      try {
        const hasKey = await wsHasStoredKey(provider);
        if (hasKey) {
          setHasStoredKeyState(true);
          setStatus('valid');

          // Try to get models if there's a stored key
          const models = await wsGetStoredModels(provider);
          if (models?.length && onSuccess) {
            onSuccess(models);
          }
        }
      } catch (error) {
        console.warn('Error checking stored key:', error);
      }
    };

    checkStoredKey();
  }, [provider, onSuccess, wsHasStoredKey, wsGetStoredModels]);

  const validate = useCallback(async (apiKey: string) => {
    if (!provider || !apiKey.trim()) {
      notification.error({ message: 'Please enter an API key' });
      return;
    }

    setStatus('validating');

    try {
      const result = await wsValidateApiKey(provider, apiKey.trim());

      if (result.isValid) {
        setStatus('valid');
        setHasStoredKeyState(true);
        notification.success({ message: 'API key validated successfully!' });

        if (result.models?.length && onSuccess) {
          onSuccess(result.models);
        }
      } else {
        setStatus('invalid');
        notification.error({ message: result.error || 'Invalid API key' });
      }
    } catch (error: any) {
      setStatus('invalid');
      notification.error({ message: error.message || 'Validation failed' });
    }
  }, [provider, onSuccess, wsValidateApiKey]);

  const clear = useCallback(async () => {
    if (!provider) return;

    try {
      await wsRemoveApiKey(provider);
      setHasStoredKeyState(false);
      setStatus('idle');
      notification.success({ message: 'API key cleared' });
    } catch (error) {
      notification.error({ message: 'Failed to clear API key' });
    }
  }, [provider, wsRemoveApiKey]);

  const getStoredKey = useCallback(async () => {
    if (!provider) return null;
    return await wsGetStoredApiKey(provider);
  }, [provider, wsGetStoredApiKey]);

  return {
    status,
    hasStoredKey: hasStoredKeyState,
    validate,
    clear,
    getStoredKey,
    isValidating: status === 'validating',
    isValid: status === 'valid',
    isInvalid: status === 'invalid'
  };
};