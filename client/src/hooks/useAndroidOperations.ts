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

  // Setup Android device connection
  setupDevice: (
    connectionType: 'local' | 'remote',
    deviceId?: string,
    websocketUrl?: string,
    port?: number
  ) => Promise<AndroidActionResult>;

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
    setupAndroidDevice: wsSetupDevice,
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
   * Setup Android device connection
   */
  const setupDevice = useCallback(async (
    connectionType: 'local' | 'remote',
    deviceId?: string,
    websocketUrl?: string,
    _port: number = 8888  // Port passed to backend via wsSetupDevice
  ): Promise<AndroidActionResult> => {
    setIsExecuting(true);
    setLastError(null);

    try {
      const result = await wsSetupDevice(connectionType, deviceId, websocketUrl);

      if (!result.success) {
        setLastError(result.error || 'Setup failed');
      }

      return {
        success: result.success,
        result: result.result,
        error: result.error
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Device setup failed';
      setLastError(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      setIsExecuting(false);
    }
  }, [wsSetupDevice]);

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
    setupDevice,
    executeAction,
    isExecuting,
    lastError,
    isConnected,
    androidStatus
  };
};
