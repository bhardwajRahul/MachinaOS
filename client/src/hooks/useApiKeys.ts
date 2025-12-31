/**
 * useApiKeys Hook - WebSocket-based API key management
 *
 * Provides API key validation, storage, and retrieval via WebSocket.
 * This replaces the REST-based ApiKeyManagerService for real-time operations.
 */

import { useCallback, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
  models?: string[];
}

export interface UseApiKeysResult {
  // Validate and store API key
  validateApiKey: (provider: string, apiKey: string) => Promise<ApiKeyValidationResult>;

  // Save API key without validation
  saveApiKey: (provider: string, apiKey: string) => Promise<ApiKeyValidationResult>;

  // Get stored API key
  getStoredApiKey: (provider: string) => Promise<string | null>;

  // Check if API key exists
  hasStoredKey: (provider: string) => Promise<boolean>;

  // Get stored models for a provider
  getStoredModels: (provider: string) => Promise<string[] | null>;

  // Remove stored API key
  removeApiKey: (provider: string) => Promise<void>;

  // Validate Google Maps API key
  validateGoogleMapsKey: (apiKey: string) => Promise<ApiKeyValidationResult>;

  // Get AI models for a provider
  getAiModels: (provider: string, apiKey: string) => Promise<string[]>;

  // State
  isValidating: boolean;
  validationError: string | null;
  isConnected: boolean;
}

export const useApiKeys = (): UseApiKeysResult => {
  const {
    validateApiKey: wsValidateApiKey,
    getStoredApiKey: wsGetStoredApiKey,
    saveApiKey: wsSaveApiKey,
    deleteApiKey: wsDeleteApiKey,
    validateMapsKey: wsValidateMapsKey,
    getAiModels: wsGetAiModels,
    isConnected
  } = useWebSocket();

  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * Validate API key and store if valid
   */
  const validateApiKey = useCallback(async (
    provider: string,
    apiKey: string
  ): Promise<ApiKeyValidationResult> => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await wsValidateApiKey(provider, apiKey);

      if (!result.valid) {
        setValidationError(result.message || 'Validation failed');
      }

      return {
        isValid: result.valid,
        error: result.message,
        models: result.models
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Validation failed';
      setValidationError(errorMsg);
      return {
        isValid: false,
        error: errorMsg
      };
    } finally {
      setIsValidating(false);
    }
  }, [wsValidateApiKey]);

  /**
   * Save API key without validation (for keys that can't be validated beforehand)
   */
  const saveApiKey = useCallback(async (
    provider: string,
    apiKey: string
  ): Promise<ApiKeyValidationResult> => {
    try {
      const success = await wsSaveApiKey(provider, apiKey);
      return {
        isValid: success,
        error: success ? undefined : 'Failed to save API key'
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Failed to save API key'
      };
    }
  }, [wsSaveApiKey]);

  /**
   * Get stored API key for a provider
   */
  const getStoredApiKey = useCallback(async (
    provider: string
  ): Promise<string | null> => {
    try {
      const result = await wsGetStoredApiKey(provider);
      return result.hasKey ? (result.apiKey || null) : null;
    } catch (error) {
      console.warn(`Error retrieving API key for ${provider}:`, error);
      return null;
    }
  }, [wsGetStoredApiKey]);

  /**
   * Check if a stored key exists for a provider
   */
  const hasStoredKey = useCallback(async (
    provider: string
  ): Promise<boolean> => {
    try {
      const result = await wsGetStoredApiKey(provider);
      return result.hasKey;
    } catch (error) {
      return false;
    }
  }, [wsGetStoredApiKey]);

  /**
   * Get stored models for a provider
   */
  const getStoredModels = useCallback(async (
    provider: string
  ): Promise<string[] | null> => {
    try {
      // Get models directly from stored API key response (includes models from DB)
      const result = await wsGetStoredApiKey(provider);
      if (result.hasKey && result.models && result.models.length > 0) {
        return result.models;
      }
      return null;
    } catch (error) {
      console.warn(`Error retrieving models for ${provider}:`, error);
      return null;
    }
  }, [wsGetStoredApiKey]);

  /**
   * Remove stored API key
   */
  const removeApiKey = useCallback(async (
    provider: string
  ): Promise<void> => {
    try {
      await wsDeleteApiKey(provider);
    } catch (error) {
      console.warn(`Error removing API key for ${provider}:`, error);
    }
  }, [wsDeleteApiKey]);

  /**
   * Validate Google Maps API key
   */
  const validateGoogleMapsKey = useCallback(async (
    apiKey: string
  ): Promise<ApiKeyValidationResult> => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await wsValidateMapsKey(apiKey);

      if (!result.valid) {
        setValidationError(result.message || 'Validation failed');
      }

      return {
        isValid: result.valid,
        error: result.message
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Validation failed';
      setValidationError(errorMsg);
      return {
        isValid: false,
        error: errorMsg
      };
    } finally {
      setIsValidating(false);
    }
  }, [wsValidateMapsKey]);

  /**
   * Get available AI models for a provider
   */
  const getAiModels = useCallback(async (
    provider: string,
    apiKey: string
  ): Promise<string[]> => {
    try {
      return await wsGetAiModels(provider, apiKey);
    } catch (error) {
      console.warn(`Error fetching AI models for ${provider}:`, error);
      return [];
    }
  }, [wsGetAiModels]);

  return {
    validateApiKey,
    saveApiKey,
    getStoredApiKey,
    hasStoredKey,
    getStoredModels,
    removeApiKey,
    validateGoogleMapsKey,
    getAiModels,
    isValidating,
    validationError,
    isConnected
  };
};
