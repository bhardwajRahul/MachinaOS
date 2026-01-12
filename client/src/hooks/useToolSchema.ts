/**
 * useToolSchema Hook - WebSocket-based tool schema management
 *
 * Provides tool schema operations for Android Toolkit and other tool nodes.
 * The database-stored schema is the source of truth for LLM tool configurations.
 */

import { useCallback, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * Schema field configuration for tool arguments
 */
export interface SchemaFieldConfig {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

/**
 * Full schema configuration stored in database
 */
export interface ToolSchemaConfig {
  description: string;
  fields: Record<string, SchemaFieldConfig>;
}

/**
 * Tool schema as stored in database
 */
export interface ToolSchema {
  node_id: string;
  tool_name: string;
  tool_description: string;
  schema_config: ToolSchemaConfig;
  connected_services?: Record<string, any>[];
  created_at?: string;
  updated_at?: string;
}

export interface UseToolSchemaResult {
  // Get tool schema for a node
  getToolSchema: (nodeId: string) => Promise<ToolSchema | null>;

  // Save tool schema for a node
  saveToolSchema: (
    nodeId: string,
    toolName: string,
    toolDescription: string,
    schemaConfig: ToolSchemaConfig,
    connectedServices?: Record<string, any>[]
  ) => Promise<boolean>;

  // Delete tool schema for a node
  deleteToolSchema: (nodeId: string) => Promise<boolean>;

  // Get all tool schemas
  getAllToolSchemas: () => Promise<ToolSchema[]>;

  // State
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

export const useToolSchema = (): UseToolSchemaResult => {
  const { sendRequest, isConnected } = useWebSocket();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get tool schema for a node from database
   */
  const getToolSchema = useCallback(async (nodeId: string): Promise<ToolSchema | null> => {
    if (!isConnected) {
      console.warn('[useToolSchema] WebSocket not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await sendRequest<{ success: boolean; schema: ToolSchema | null }>('get_tool_schema', {
        node_id: nodeId
      });

      if (response.success) {
        return response.schema;
      }
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get tool schema';
      setError(errorMsg);
      console.error('[useToolSchema] Error getting schema:', errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendRequest]);

  /**
   * Save tool schema for a node to database
   */
  const saveToolSchema = useCallback(async (
    nodeId: string,
    toolName: string,
    toolDescription: string,
    schemaConfig: ToolSchemaConfig,
    connectedServices?: Record<string, any>[]
  ): Promise<boolean> => {
    if (!isConnected) {
      console.warn('[useToolSchema] WebSocket not connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await sendRequest<{ success: boolean; saved: boolean }>('save_tool_schema', {
        node_id: nodeId,
        tool_name: toolName,
        tool_description: toolDescription,
        schema_config: schemaConfig,
        connected_services: connectedServices
      });

      return response.success && response.saved;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save tool schema';
      setError(errorMsg);
      console.error('[useToolSchema] Error saving schema:', errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendRequest]);

  /**
   * Delete tool schema for a node from database
   */
  const deleteToolSchema = useCallback(async (nodeId: string): Promise<boolean> => {
    if (!isConnected) {
      console.warn('[useToolSchema] WebSocket not connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await sendRequest<{ success: boolean }>('delete_tool_schema', {
        node_id: nodeId
      });

      return response.success;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete tool schema';
      setError(errorMsg);
      console.error('[useToolSchema] Error deleting schema:', errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendRequest]);

  /**
   * Get all tool schemas from database
   */
  const getAllToolSchemas = useCallback(async (): Promise<ToolSchema[]> => {
    if (!isConnected) {
      console.warn('[useToolSchema] WebSocket not connected');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await sendRequest<{ success: boolean; schemas: ToolSchema[] }>('get_all_tool_schemas', {});

      if (response.success) {
        return response.schemas || [];
      }
      return [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get tool schemas';
      setError(errorMsg);
      console.error('[useToolSchema] Error getting schemas:', errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendRequest]);

  return {
    getToolSchema,
    saveToolSchema,
    deleteToolSchema,
    getAllToolSchemas,
    isLoading,
    error,
    isConnected
  };
};
