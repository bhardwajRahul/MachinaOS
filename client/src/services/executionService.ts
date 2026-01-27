import { nodeDefinitions } from '../nodeDefinitions';
import { ANDROID_SERVICE_NODE_TYPES } from '../nodeDefinitions/androidServiceNodes';
import { ANDROID_DEVICE_NODE_TYPES } from '../nodeDefinitions/androidDeviceNodes';
import { SCHEDULER_NODE_TYPES } from '../nodeDefinitions/schedulerNodes';
import { CODE_NODE_TYPES } from '../nodeDefinitions/codeNodes';
import { UTILITY_NODE_TYPES } from '../nodeDefinitions/utilityNodes';
import { Node, Edge } from 'reactflow';
import { INodeExecutionData } from '../types/INodeProperties';
import { API_CONFIG } from '../config/api';

// Execution result with n8n-compatible data
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

// WebSocket execution function type (passed from components using useWebSocket)
export type WebSocketExecuteFn = (
  nodeId: string,
  nodeType: string,
  parameters: Record<string, any>,
  nodes?: any[],
  edges?: any[]
) => Promise<any>;

// WebSocket parameter getter type
export type WebSocketGetParametersFn = (nodeId: string) => Promise<{ parameters: Record<string, any> } | null>;

// No frontend cache - backend is single source of truth

// ============================================================================
// EXECUTION SERVICE - Migrated to Python backend
// ============================================================================

export class ExecutionService {
  // ============================================================================
  // WEBSOCKET-BASED EXECUTION - Primary execution method
  // ============================================================================

  /**
   * Execute node via WebSocket (preferred method)
   * Use this when you have access to WebSocket functions from useWebSocket hook
   */
  static async executeNodeViaWebSocket(
    nodeId: string,
    nodeType: string,
    wsExecute: WebSocketExecuteFn,
    wsGetParameters: WebSocketGetParametersFn,
    nodes?: Node[],
    edges?: Edge[]
  ): Promise<ExecutionResult> {
    try {
      console.log(`[WS Execution] Starting: ${nodeId} (type: ${nodeType})`);

      const startTime = Date.now();

      // Load parameters via WebSocket
      const paramsResult = await wsGetParameters(nodeId);
      const parameters = paramsResult?.parameters || {};
      console.log(`[WS Execution] Parameters for ${nodeId}:`, parameters);

      // Prepare nodes and edges
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
      const result = await wsExecute(nodeId, nodeType, parameters, nodeData, edgeData);

      console.log(`[WS Execution] Result:`, result);

      const executionTime = Date.now() - startTime;

      if (result.success) {
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
        const errorOutputData = result.result || {
          error: result.error,
          nodeId,
          success: false,
          timestamp: result.timestamp || new Date().toISOString()
        };

        const errorData: INodeExecutionData[][] = [[{
          json: errorOutputData
        }]];

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
      console.error(`[WS Execution] Failed for node ${nodeId}:`, error);

      const catchErrorData = {
        error: error.message || 'WebSocket execution failed',
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
        executionTime: 0,
        error: error.message || 'WebSocket execution failed',
        outputs: catchErrorData,
        data: catchErrorData,
        nodeData: [[{ json: catchErrorData }]]
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check backend health status
   */
  static async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.PYTHON_BASE_URL}/api/workflow/health`);
      const health = await response.json();
      return health.status === 'OK';
    } catch (error) {
      console.warn('Backend health check failed:', error);
      return false;
    }
  }

  /**
   * Check if node type is supported by backend execution
   */
  static isNodeTypeSupported(nodeType: string): boolean {
    const supportedTypes = [
      // AI Nodes
      'aiAgent',
      'chatAgent',
      // Note: simpleMemory is passive - accessed by AI Agent automatically, not executed directly
      'openaiChatModel',
      'anthropicChatModel',
      'geminiChatModel',
      'openrouterChatModel',
      'groqChatModel',
      'cerebrasChatModel',
      'azure_openaiChatModel',  // Planned
      'cohereChatModel',         // Planned
      'ollamaChatModel',         // Planned
      'mistralChatModel',        // Planned
      // Google Maps Nodes
      'createMap',
      'addLocations',
      'showNearbyPlaces',
      // WhatsApp Nodes
      'whatsappSend',
      'whatsappConnect',
      'whatsappReceive',
      'whatsappChatHistory',
      // Text Processing Nodes
      'textGenerator',
      'fileHandler',
      // Android Services (16 individual nodes)
      ...ANDROID_SERVICE_NODE_TYPES,
      // Android Device Setup
      ...ANDROID_DEVICE_NODE_TYPES,
      // Scheduler Nodes
      ...SCHEDULER_NODE_TYPES,
      // Code Execution Nodes
      ...CODE_NODE_TYPES,
      // Utility Nodes (HTTP, Webhooks)
      ...UTILITY_NODE_TYPES
    ];

    return supportedTypes.includes(nodeType);
  }
}