/**
 * useAndroidOperations Hook - WebSocket-based Android device operations
 *
 * Provides Android device management and service execution via WebSocket.
 * This replaces REST-based Android API calls for real-time operations.
 */

import { useCallback, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

export interface AndroidDevice {
  id: string;
  model?: string;
  state?: string;
}

export interface AndroidActionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface UseAndroidOperationsResult {
  // Get list of connected devices
  getDevices: () => Promise<AndroidDevice[]>;

  // Execute Android service action
  executeAction: (
    serviceId: string,
    action: string,
    parameters: Record<string, any>,
    deviceId?: string
  ) => Promise<AndroidActionResult>;

  // State
  isExecuting: boolean;
  lastError: string | null;
  isConnected: boolean;

  // Android status from WebSocket
  androidStatus: {
    connected: boolean;
    device_id: string | null;
    connected_devices: string[];
    connection_type: string | null;
  };
}

export const useAndroidOperations = (): UseAndroidOperationsResult => {
  const {
    getAndroidDevices: wsGetDevices,
    executeAndroidAction: wsExecuteAction,
    androidStatus,
    isConnected
  } = useWebSocket();

  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Get list of connected Android devices
   */
  const getDevices = useCallback(async (): Promise<AndroidDevice[]> => {
    try {
      const devices = await wsGetDevices();
      return devices.map((id: string) => ({ id }));
    } catch (error: any) {
      console.warn('Failed to get Android devices:', error);
      setLastError(error.message);
      return [];
    }
  }, [wsGetDevices]);

  /**
   * Execute Android service action
   */
  const executeAction = useCallback(async (
    serviceId: string,
    action: string,
    parameters: Record<string, any>,
    deviceId?: string
  ): Promise<AndroidActionResult> => {
    setIsExecuting(true);
    setLastError(null);

    try {
      const result = await wsExecuteAction(serviceId, action, parameters, deviceId);

      if (!result.success) {
        setLastError(result.error || 'Action failed');
      }

      return {
        success: result.success,
        result: result.result,
        error: result.error
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Action execution failed';
      setLastError(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      setIsExecuting(false);
    }
  }, [wsExecuteAction]);

  return {
    getDevices,
    executeAction,
    isExecuting,
    lastError,
    isConnected,
    androidStatus
  };
};
