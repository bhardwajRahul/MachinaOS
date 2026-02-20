/**
 * Hook for managing pricing configuration and API usage data.
 * Provides access to pricing config (LLM and API pricing) and usage summaries.
 */

import { useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

// ============================================================================
// Types
// ============================================================================

export interface LLMPricing {
  input: number;
  output: number;
  cache_read?: number;
  reasoning?: number;
}

export interface APIPricing {
  [operation: string]: number;
}

export interface PricingConfig {
  version: string;
  last_updated: string;
  llm: Record<string, Record<string, LLMPricing>>;
  api: Record<string, APIPricing>;
  operation_map: Record<string, Record<string, string>>;
}

export interface APIOperationSummary {
  operation: string;
  resource_count: number;
  total_cost: number;
  execution_count: number;
}

export interface APIUsageSummary {
  service: string;
  total_resources: number;
  total_cost: number;
  execution_count: number;
  operations: APIOperationSummary[];
}

// ============================================================================
// Hook
// ============================================================================

export const usePricing = () => {
  const { sendRequest, isConnected } = useWebSocket();

  /**
   * Get the full pricing configuration (LLM + API pricing).
   * Returns null if not connected or request fails.
   */
  const getPricingConfig = useCallback(async (): Promise<PricingConfig | null> => {
    if (!isConnected) return null;

    try {
      const response = await sendRequest<{ success: boolean; config: PricingConfig }>(
        'get_pricing_config',
        {}
      );
      return response?.config || null;
    } catch (error) {
      console.error('[usePricing] Failed to get pricing config:', error);
      return null;
    }
  }, [sendRequest, isConnected]);

  /**
   * Save updated pricing configuration.
   * Returns true if saved successfully.
   */
  const savePricingConfig = useCallback(async (config: PricingConfig): Promise<boolean> => {
    if (!isConnected) return false;

    try {
      const response = await sendRequest<{ success: boolean }>(
        'save_pricing_config',
        { config }
      );
      return response?.success || false;
    } catch (error) {
      console.error('[usePricing] Failed to save pricing config:', error);
      return false;
    }
  }, [sendRequest, isConnected]);

  /**
   * Get aggregated API usage summary.
   * Optionally filter by service (e.g., 'twitter').
   */
  const getAPIUsageSummary = useCallback(async (
    service?: string
  ): Promise<APIUsageSummary[]> => {
    if (!isConnected) return [];

    try {
      const response = await sendRequest<{ success: boolean; services: APIUsageSummary[] }>(
        'get_api_usage_summary',
        { service }
      );
      return response?.services || [];
    } catch (error) {
      console.error('[usePricing] Failed to get API usage summary:', error);
      return [];
    }
  }, [sendRequest, isConnected]);

  /**
   * Get Twitter-specific usage summary.
   * Convenience method that calls getAPIUsageSummary with 'twitter' filter.
   */
  const getTwitterUsage = useCallback(async (): Promise<APIUsageSummary | null> => {
    const services = await getAPIUsageSummary('twitter');
    return services.find(s => s.service === 'twitter') || null;
  }, [getAPIUsageSummary]);

  return {
    // Config methods
    getPricingConfig,
    savePricingConfig,
    // Usage methods
    getAPIUsageSummary,
    getTwitterUsage,
    // State
    isConnected,
  };
};

export default usePricing;
