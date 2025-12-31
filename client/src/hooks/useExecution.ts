/**
 * useExecution Hook - WebSocket-based node execution
 *
 * Provides node execution functionality via WebSocket instead of REST API.
 * This replaces the REST-based ExecutionService for real-time execution.
 */

import { useCallback, useState } from 'react';
import { Node, Edge } from 'reactflow';
import { useWebSocket } from '../contexts/WebSocketContext';
import { nodeDefinitions } from '../nodeDefinitions';
import { INodeExecutionData } from '../types/INodeProperties';

// Execution result interface (compatible with ExecutionService)
export interface ExecutionResult {
  success: boolean;
  nodeId: string;
  nodeType: string;
  nodeName: string;
  timestamp: string;
  executionTime: number;
  outputs?: Record<string, any>;
  error?: string;
  data?: any;
  nodeData: INodeExecutionData[][];
}

export interface UseExecutionResult {
  // Execute a node via WebSocket
  executeNode: (
    nodeId: string,
    nodeType: string,
    nodes?: Node[],
    edges?: Edge[]
  ) => Promise<ExecutionResult>;

  // Execute AI node via WebSocket
  executeAiNode: (
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    model: string
  ) => Promise<ExecutionResult>;

  // Execution state
  isExecuting: boolean;
  executingNodeId: string | null;
  lastError: string | null;

  // Connection status
  isConnected: boolean;
}

export const useExecution = (): UseExecutionResult => {
  const {
    executeNode: wsExecuteNode,
    executeAiNode: wsExecuteAiNode,
    getNodeParameters,
    isConnected
  } = useWebSocket();

  const [isExecuting, setIsExecuting] = useState(false);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Execute a workflow node via WebSocket
   */
  const executeNode = useCallback(async (
    nodeId: string,
    nodeType: string,
    nodes?: Node[],
    edges?: Edge[]
  ): Promise<ExecutionResult> => {
    const startTime = Date.now();

    try {
      console.log(`[WebSocket Execution] Starting: ${nodeId} (type: ${nodeType})`);

      setIsExecuting(true);
      setExecutingNodeId(nodeId);
      setLastError(null);

      // Load parameters from WebSocket/backend
      const paramsResult = await getNodeParameters(nodeId);
      const parameters = paramsResult?.parameters || {};

      console.log(`[WebSocket Execution] Parameters for ${nodeId}:`, parameters);

      // Prepare nodes and edges for execution
      const nodeData = nodes?.map(node => ({
        id: node.id,
        type: node.type || '',
        data: node.data || {}
      })) || [];

      const edgeData = edges?.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined
      })) || [];

      // Execute via WebSocket
      const result = await wsExecuteNode(nodeId, nodeType, parameters, nodeData, edgeData);

      console.log(`[WebSocket Execution] Result:`, result);

      const executionTime = Date.now() - startTime;

      if (result.success) {
        // Extract output data
        const outputData = result.result || {
          nodeId,
          success: true,
          message: 'Execution completed successfully',
          timestamp: result.timestamp || new Date().toISOString()
        };

        const nodeExecutionData: INodeExecutionData[][] = [[{
          json: outputData
        }]];

        return {
          success: true,
          nodeId,
          nodeType,
          nodeName: nodeDefinitions[nodeType]?.displayName || nodeType,
          timestamp: result.timestamp || new Date().toISOString(),
          executionTime: result.execution_time || executionTime,
          outputs: outputData,
          data: outputData,
          nodeData: nodeExecutionData
        };
      } else {
        // Handle error
        const errorOutputData = result.result || {
          error: result.error,
          nodeId,
          success: false,
          timestamp: result.timestamp || new Date().toISOString()
        };

        const errorData: INodeExecutionData[][] = [[{
          json: errorOutputData
        }]];

        setLastError(result.error || 'Execution failed');

        return {
          success: false,
          nodeId,
          nodeType,
          nodeName: nodeDefinitions[nodeType]?.displayName || nodeType,
          timestamp: result.timestamp || new Date().toISOString(),
          executionTime: result.execution_time || executionTime,
          error: result.error,
          outputs: errorOutputData,
          data: errorOutputData,
          nodeData: errorData
        };
      }

    } catch (error: any) {
      console.error(`[WebSocket Execution] Failed for node ${nodeId}:`, error);

      const errorMessage = error.message || 'WebSocket execution failed';
      setLastError(errorMessage);

      const catchErrorData = {
        error: errorMessage,
        nodeId,
        success: false,
        timestamp: new Date().toISOString()
      };

      return {
        success: false,
        nodeId,
        nodeType,
        nodeName: nodeDefinitions[nodeType]?.displayName || nodeType,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        error: errorMessage,
        outputs: catchErrorData,
        data: catchErrorData,
        nodeData: [[{ json: catchErrorData }]]
      };

    } finally {
      setIsExecuting(false);
      setExecutingNodeId(null);
    }
  }, [wsExecuteNode, getNodeParameters]);

  /**
   * Execute an AI node via WebSocket
   */
  const executeAiNode = useCallback(async (
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    model: string
  ): Promise<ExecutionResult> => {
    const startTime = Date.now();

    try {
      console.log(`[WebSocket AI Execution] Starting: ${nodeId} (type: ${nodeType})`);

      setIsExecuting(true);
      setExecutingNodeId(nodeId);
      setLastError(null);

      // Execute AI node via WebSocket
      const result = await wsExecuteAiNode(nodeId, nodeType, parameters, model);

      console.log(`[WebSocket AI Execution] Result:`, result);

      const executionTime = Date.now() - startTime;

      if (result.success) {
        const outputData = result.result || {
          nodeId,
          success: true,
          message: 'AI execution completed successfully',
          timestamp: result.timestamp || new Date().toISOString()
        };

        const nodeExecutionData: INodeExecutionData[][] = [[{
          json: outputData
        }]];

        return {
          success: true,
          nodeId,
          nodeType,
          nodeName: nodeDefinitions[nodeType]?.displayName || nodeType,
          timestamp: result.timestamp || new Date().toISOString(),
          executionTime: result.execution_time || executionTime,
          outputs: outputData,
          data: outputData,
          nodeData: nodeExecutionData
        };
      } else {
        const errorOutputData = result.result || {
          error: result.error,
          nodeId,
          success: false,
          timestamp: result.timestamp || new Date().toISOString()
        };

        const errorData: INodeExecutionData[][] = [[{
          json: errorOutputData
        }]];

        setLastError(result.error || 'AI execution failed');

        return {
          success: false,
          nodeId,
          nodeType,
          nodeName: nodeDefinitions[nodeType]?.displayName || nodeType,
          timestamp: result.timestamp || new Date().toISOString(),
          executionTime: result.execution_time || executionTime,
          error: result.error,
          outputs: errorOutputData,
          data: errorOutputData,
          nodeData: errorData
        };
      }

    } catch (error: any) {
      console.error(`[WebSocket AI Execution] Failed for node ${nodeId}:`, error);

      const errorMessage = error.message || 'WebSocket AI execution failed';
      setLastError(errorMessage);

      const catchErrorData = {
        error: errorMessage,
        nodeId,
        success: false,
        timestamp: new Date().toISOString()
      };

      return {
        success: false,
        nodeId,
        nodeType,
        nodeName: nodeDefinitions[nodeType]?.displayName || nodeType,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        error: errorMessage,
        outputs: catchErrorData,
        data: catchErrorData,
        nodeData: [[{ json: catchErrorData }]]
      };

    } finally {
      setIsExecuting(false);
      setExecutingNodeId(null);
    }
  }, [wsExecuteAiNode]);

  return {
    executeNode,
    executeAiNode,
    isExecuting,
    executingNodeId,
    lastError,
    isConnected
  };
};
