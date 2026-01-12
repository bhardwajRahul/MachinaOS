/**
 * WebSocket Context for real-time communication with Python backend.
 *
 * Provides WebSocket connection for:
 * - Request/response operations (parameters, execution, API keys)
 * - Real-time broadcasts (status updates, multi-client sync)
 * - Android device connection status
 * - Node execution status (scoped by workflow_id - n8n pattern)
 * - Variable/parameter updates
 * - Workflow state changes
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { API_CONFIG } from '../config/api';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from './AuthContext';

// Generate unique request ID
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Pending request tracking
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: NodeJS.Timeout | null;  // null for no timeout (trigger nodes)
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

// Trigger node types that wait indefinitely for events
const TRIGGER_NODE_TYPES = ['whatsappReceive', 'webhookTrigger', 'cronScheduler'];

// Status types
export interface AndroidStatus {
  connected: boolean;
  paired: boolean;
  device_id: string | null;
  device_name: string | null;
  connected_devices: string[];
  connection_type: string | null;
  qr_data: string | null;
  session_token: string | null;
}

export interface NodeStatus {
  status: 'idle' | 'executing' | 'success' | 'error' | 'waiting';
  data?: Record<string, any>;
  output?: any;
  timestamp?: number;
  // Per-workflow scoping (n8n pattern)
  workflow_id?: string;
  // Waiting state data
  message?: string;
  waiter_id?: string;
  timeout?: number;
}

export interface WorkflowStatus {
  executing: boolean;
  current_node: string | null;
  progress?: number;
}

export interface DeploymentStatus {
  isRunning: boolean;
  activeRuns: number;
  status: 'idle' | 'starting' | 'running' | 'stopped' | 'cancelled' | 'error';
  workflow_id?: string | null;  // Which workflow is deployed (for scoping)
  totalTime?: number;
  error?: string;
}

export interface WorkflowLock {
  locked: boolean;
  workflow_id: string | null;
  locked_at: number | null;
  reason: string | null;
}

export interface WhatsAppStatus {
  connected: boolean;
  has_session: boolean;
  running: boolean;
  pairing: boolean;
  device_id?: string;
  qr?: string;
  timestamp?: number;
}

export interface ApiKeyStatus {
  valid: boolean;
  hasKey?: boolean;
  message?: string;
  models?: string[];
  timestamp?: number;
}

// WhatsApp received message structure (from Go service via whatsapp_message_received event)
export interface WhatsAppMessage {
  message_id: string;
  sender: string;
  chat_id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'sticker';
  text?: string;
  timestamp: number;
  is_group: boolean;
  push_name?: string;
  media_url?: string;
  media_data?: string;  // Base64 if includeMediaData is enabled
  caption?: string;
  // Location message fields
  latitude?: number;
  longitude?: number;
  // Contact message fields
  contact_name?: string;
  vcard?: string;
}

export interface NodeParameters {
  parameters: Record<string, any>;
  version: number;
  timestamp?: number;
}

export interface FullStatus {
  android: AndroidStatus;
  api_keys: Record<string, ApiKeyStatus>;
  nodes: Record<string, NodeStatus>;
  node_parameters: Record<string, NodeParameters>;
  variables: Record<string, any>;
  workflow: WorkflowStatus;
}

// Context value type
interface WebSocketContextValue {
  // Connection state
  isConnected: boolean;
  reconnecting: boolean;

  // Status data
  androidStatus: AndroidStatus;
  whatsappStatus: WhatsAppStatus;
  whatsappMessages: WhatsAppMessage[];  // History of received messages
  lastWhatsAppMessage: WhatsAppMessage | null;  // Most recent message
  apiKeyStatuses: Record<string, ApiKeyStatus>;
  nodeStatuses: Record<string, NodeStatus>;  // Current workflow's node statuses
  nodeParameters: Record<string, NodeParameters>;
  variables: Record<string, any>;
  workflowStatus: WorkflowStatus;
  deploymentStatus: DeploymentStatus;
  workflowLock: WorkflowLock;

  // Status getters
  getNodeStatus: (nodeId: string) => NodeStatus | undefined;
  getApiKeyStatus: (provider: string) => ApiKeyStatus | undefined;
  getVariable: (name: string) => any;
  requestStatus: () => void;
  clearNodeStatus: (nodeId: string) => Promise<void>;
  clearWhatsAppMessages: () => void;

  // Generic request method
  sendRequest: <T = any>(type: string, data?: Record<string, any>) => Promise<T>;

  // Node Parameters
  getNodeParameters: (nodeId: string) => Promise<NodeParameters | null>;
  getAllNodeParameters: (nodeIds: string[]) => Promise<Record<string, NodeParameters>>;
  saveNodeParameters: (nodeId: string, parameters: Record<string, any>, version?: number) => Promise<boolean>;
  deleteNodeParameters: (nodeId: string) => Promise<boolean>;

  // Node Execution
  executeNode: (nodeId: string, nodeType: string, parameters: Record<string, any>, nodes?: any[], edges?: any[]) => Promise<any>;
  executeWorkflow: (nodes: any[], edges: any[], sessionId?: string) => Promise<any>;
  getNodeOutput: (nodeId: string, outputName?: string) => Promise<any>;

  // Trigger/Event Waiting
  cancelEventWait: (nodeId: string, waiterId?: string) => Promise<{ success: boolean; cancelled_count?: number }>;

  // Deployment Operations
  deployWorkflow: (workflowId: string, nodes: any[], edges: any[], sessionId?: string) => Promise<any>;
  cancelDeployment: (workflowId?: string) => Promise<any>;
  getDeploymentStatus: (workflowId?: string) => Promise<{ isRunning: boolean; activeRuns: number; settings?: any; workflow_id?: string }>;

  // AI Operations
  executeAiNode: (nodeId: string, nodeType: string, parameters: Record<string, any>, model: string) => Promise<any>;
  getAiModels: (provider: string, apiKey: string) => Promise<string[]>;

  // API Key Operations
  validateApiKey: (provider: string, apiKey: string) => Promise<{ valid: boolean; message?: string; models?: string[] }>;
  getStoredApiKey: (provider: string) => Promise<{ hasKey: boolean; apiKey?: string; models?: string[] }>;
  saveApiKey: (provider: string, apiKey: string, models?: string[]) => Promise<boolean>;
  deleteApiKey: (provider: string) => Promise<boolean>;

  // Android Operations
  getAndroidDevices: () => Promise<string[]>;
  executeAndroidAction: (serviceId: string, action: string, parameters: Record<string, any>, deviceId?: string) => Promise<any>;
  setupAndroidDevice: (connectionType: string, deviceId?: string, websocketUrl?: string) => Promise<any>;

  // Maps Operations
  validateMapsKey: (apiKey: string) => Promise<{ valid: boolean; message?: string }>;

  // WhatsApp Operations
  getWhatsAppStatus: () => Promise<{ connected: boolean; deviceId?: string; data?: any }>;
  getWhatsAppQR: () => Promise<{ connected: boolean; qr?: string; message?: string }>;
  sendWhatsAppMessage: (phone: string, message: string) => Promise<{ success: boolean; messageId?: string; error?: string }>;
  startWhatsAppConnection: () => Promise<{ success: boolean; message?: string }>;
  restartWhatsAppConnection: () => Promise<{ success: boolean; message?: string }>;
  getWhatsAppGroups: () => Promise<{ success: boolean; groups: Array<{ jid: string; name: string; topic?: string; size?: number }>; error?: string }>;
  getWhatsAppGroupInfo: (groupId: string) => Promise<{ success: boolean; participants: Array<{ phone: string; name: string; jid: string; is_admin?: boolean }>; name?: string; error?: string }>;
}

// Default values
const defaultAndroidStatus: AndroidStatus = {
  connected: false,
  paired: false,
  device_id: null,
  device_name: null,
  connected_devices: [],
  connection_type: null,
  qr_data: null,
  session_token: null
};

const defaultWorkflowStatus: WorkflowStatus = {
  executing: false,
  current_node: null
};

const defaultDeploymentStatus: DeploymentStatus = {
  isRunning: false,
  activeRuns: 0,
  status: 'idle'
};

const defaultWorkflowLock: WorkflowLock = {
  locked: false,
  workflow_id: null,
  locked_at: null,
  reason: null
};

const defaultWhatsAppStatus: WhatsAppStatus = {
  connected: false,
  has_session: false,
  running: false,
  pairing: false
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// WebSocket URL (convert http to ws)
const getWebSocketUrl = () => {
  const baseUrl = API_CONFIG.PYTHON_BASE_URL;

  // Production: empty base URL means use current origin
  if (!baseUrl) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${window.location.host}/ws/status`;
  }

  // Development: convert http(s) to ws(s)
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = baseUrl.replace(/^https?/, wsProtocol);
  return `${wsUrl}/ws/status`;
};

// Max number of WhatsApp messages to keep in history
const MAX_WHATSAPP_MESSAGE_HISTORY = 100;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get authentication state - only connect WebSocket when authenticated
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Get current workflow ID for filtering node status updates (n8n pattern)
  const currentWorkflow = useAppStore(state => state.currentWorkflow);
  const currentWorkflowId = currentWorkflow?.id;

  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [androidStatus, setAndroidStatus] = useState<AndroidStatus>(defaultAndroidStatus);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>(defaultWhatsAppStatus);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [lastWhatsAppMessage, setLastWhatsAppMessage] = useState<WhatsAppMessage | null>(null);
  const [apiKeyStatuses, setApiKeyStatuses] = useState<Record<string, ApiKeyStatus>>({});
  // Per-workflow node statuses: workflow_id -> node_id -> NodeStatus (n8n pattern)
  const [allNodeStatuses, setAllNodeStatuses] = useState<Record<string, Record<string, NodeStatus>>>({});
  const [nodeParameters, setNodeParameters] = useState<Record<string, NodeParameters>>({});
  // Per-workflow variables: workflow_id -> variable_name -> value (n8n pattern)
  const [allVariables, setAllVariables] = useState<Record<string, Record<string, any>>>({});
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(defaultWorkflowStatus);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>(defaultDeploymentStatus);
  const [workflowLock, setWorkflowLock] = useState<WorkflowLock>(defaultWorkflowLock);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  // Ref for current workflow ID - allows message handler to access latest value
  // without recreating the WebSocket connection (n8n pattern)
  const currentWorkflowIdRef = useRef<string | undefined>(currentWorkflowId);

  // Keep the ref in sync with the state and clear node statuses on workflow switch (n8n pattern)
  useEffect(() => {
    const previousWorkflowId = currentWorkflowIdRef.current;
    currentWorkflowIdRef.current = currentWorkflowId;

    // No need to clear node statuses - they are now stored per-workflow (n8n pattern)
    // Each workflow's statuses are isolated in allNodeStatuses[workflow_id]
    if (previousWorkflowId && currentWorkflowId && previousWorkflowId !== currentWorkflowId) {

      // Fetch deployment status for the new workflow (n8n pattern)
      // This ensures the deploy button shows correct state when switching workflows
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const fetchDeploymentStatus = async () => {
          try {
            const requestId = generateRequestId();
            const response = await new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

              const handler = (event: MessageEvent) => {
                try {
                  const msg = JSON.parse(event.data);
                  if (msg.request_id === requestId) {
                    clearTimeout(timeout);
                    wsRef.current?.removeEventListener('message', handler);
                    resolve(msg);
                  }
                } catch {}
              };

              wsRef.current?.addEventListener('message', handler);
              wsRef.current?.send(JSON.stringify({
                type: 'get_deployment_status',
                request_id: requestId,
                workflow_id: currentWorkflowId
              }));
            });

            // Update deployment status based on response
            const isRunning = response.is_running || false;
            setDeploymentStatus({
              isRunning,
              activeRuns: response.active_runs || 0,
              status: isRunning ? 'running' : 'idle',
              workflow_id: response.workflow_id || null
            });

            // Sync with Zustand store's per-workflow isExecuting state (n8n pattern)
            // This ensures Dashboard's isExecuting reflects the actual backend state
            const { setWorkflowExecuting } = useAppStore.getState();
            setWorkflowExecuting(currentWorkflowId, isRunning);

            // Also update workflow lock based on deployment status (n8n pattern)
            // A running workflow should be locked
            setWorkflowLock({
              locked: isRunning,
              workflow_id: isRunning ? currentWorkflowId : null,
              locked_at: isRunning ? Date.now() : null,
              reason: isRunning ? 'Workflow is running' : null
            });
          } catch (err) {
            console.error('[WebSocket] Failed to fetch deployment status:', err);
          }
        };
        fetchDeploymentStatus();
      }
    }
  }, [currentWorkflowId]);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data, node_id, name, value, output, variables: varsUpdate, request_id } = message;

      // Handle request/response pattern - resolve pending requests
      if (request_id && pendingRequestsRef.current.has(request_id)) {
        const pending = pendingRequestsRef.current.get(request_id)!;
        if (pending.timeout) {
          clearTimeout(pending.timeout);
        }
        pendingRequestsRef.current.delete(request_id);
        pending.resolve(message);
        return; // Response handled, don't process as broadcast
      }

      switch (type) {
        case 'initial_status':
        case 'full_status':
          if (data) {
            if (data.android) setAndroidStatus(data.android);
            if (data.whatsapp) setWhatsappStatus(data.whatsapp);
            if (data.api_keys) setApiKeyStatuses(data.api_keys);
            // Node statuses from initial_status - group by workflow_id (n8n pattern)
            if (data.nodes) {
              const groupedStatuses: Record<string, Record<string, NodeStatus>> = {};
              for (const [nodeId, status] of Object.entries(data.nodes)) {
                const nodeStatus = status as NodeStatus;
                const wfId = nodeStatus?.workflow_id || 'unknown';
                if (!groupedStatuses[wfId]) groupedStatuses[wfId] = {};
                groupedStatuses[wfId][nodeId] = nodeStatus;
              }
              setAllNodeStatuses(prev => ({ ...prev, ...groupedStatuses }));
            }
            if (data.node_parameters) setNodeParameters(data.node_parameters);
            // Variables from initial_status - group by workflow_id (n8n pattern)
            if (data.variables) {
              // Variables may come with workflow_id or need grouping
              const groupedVars: Record<string, Record<string, any>> = {};
              for (const [varName, varData] of Object.entries(data.variables)) {
                const wfId = (varData as any)?.workflow_id || 'unknown';
                if (!groupedVars[wfId]) groupedVars[wfId] = {};
                groupedVars[wfId][varName] = varData;
              }
              setAllVariables(prev => ({ ...prev, ...groupedVars }));
            }
            if (data.workflow) setWorkflowStatus(data.workflow);
            if (data.workflow_lock) setWorkflowLock(data.workflow_lock);
            // Handle deployment status from initial_status (n8n/Conductor pattern)
            if (data.deployment) {
              setDeploymentStatus({
                isRunning: data.deployment.isRunning || false,
                activeRuns: data.deployment.activeRuns || 0,
                status: data.deployment.status || 'idle'
              });
            }
          }
          break;

        case 'api_key_status':
          if (message.provider) {
            setApiKeyStatuses(prev => ({
              ...prev,
              [message.provider]: data
            }));
          }
          break;

        case 'android_status':
          setAndroidStatus(data || defaultAndroidStatus);
          break;

        case 'whatsapp_status':
          setWhatsappStatus(data || defaultWhatsAppStatus);
          break;

        case 'whatsapp_message_received':
          // Handle incoming WhatsApp message from Go service
          if (data) {
            const message: WhatsAppMessage = {
              message_id: data.message_id || data.id || '',
              sender: data.sender || data.from || '',
              chat_id: data.chat_id || data.chat || '',
              type: data.type || 'text',
              text: data.text || data.message || data.body || '',
              timestamp: data.timestamp || Date.now(),
              is_group: data.is_group || data.isGroup || false,
              push_name: data.push_name || data.pushName || data.name,
              media_url: data.media_url || data.mediaUrl,
              media_data: data.media_data || data.mediaData,
              caption: data.caption,
              latitude: data.latitude,
              longitude: data.longitude,
              contact_name: data.contact_name || data.contactName,
              vcard: data.vcard
            };

            // Update last message
            setLastWhatsAppMessage(message);

            // Add to message history (newest first, limit size)
            setWhatsappMessages(prev => {
              const updated = [message, ...prev];
              return updated.slice(0, MAX_WHATSAPP_MESSAGE_HISTORY);
            });

          }
          break;

        case 'node_status':
          // Per-workflow node status storage (n8n pattern)
          // Store status under workflow_id -> node_id structure
          if (node_id) {
            const statusWorkflowId = message.workflow_id || 'unknown';
            // Phase and tool_name are inside data.data (nested structure from broadcaster)
            const innerData = data?.data || {};

            // Flatten the structure: merge inner data with outer data for easier access
            const flattenedData = { ...data, ...innerData, workflow_id: statusWorkflowId };

            setAllNodeStatuses((prev: Record<string, Record<string, NodeStatus>>) => ({
              ...prev,
              [statusWorkflowId]: {
                ...(prev[statusWorkflowId] || {}),
                [node_id]: flattenedData
              }
            }));
          }
          break;

        case 'node_output':
          // Per-workflow node output storage (n8n pattern)
          if (node_id) {
            const outputWorkflowId = message.workflow_id || 'unknown';
            setAllNodeStatuses((prev: Record<string, Record<string, NodeStatus>>) => ({
              ...prev,
              [outputWorkflowId]: {
                ...(prev[outputWorkflowId] || {}),
                [node_id]: {
                  ...(prev[outputWorkflowId]?.[node_id] || {}),
                  output,
                  workflow_id: outputWorkflowId
                }
              }
            }));
          }
          break;

        case 'node_status_cleared':
          // Handle broadcast from server when node status is cleared
          if (node_id || message.node_id) {
            const clearedNodeId = node_id || message.node_id;
            const clearWorkflowId = message.workflow_id;
            setAllNodeStatuses((prev: Record<string, Record<string, NodeStatus>>) => {
              // If workflow_id specified, only clear from that workflow
              if (clearWorkflowId && prev[clearWorkflowId]) {
                const workflowStatuses = { ...prev[clearWorkflowId] };
                delete workflowStatuses[clearedNodeId];
                return { ...prev, [clearWorkflowId]: workflowStatuses };
              }
              // Otherwise clear from all workflows
              const newStatuses: Record<string, Record<string, NodeStatus>> = {};
              for (const [wfId, nodes] of Object.entries(prev)) {
                const filteredNodes = { ...nodes };
                delete filteredNodes[clearedNodeId];
                newStatuses[wfId] = filteredNodes;
              }
              return newStatuses;
            });
          }
          break;

        // Node parameters broadcasts (from other clients)
        case 'node_parameters_updated':
          if (node_id) {
            setNodeParameters(prev => ({
              ...prev,
              [node_id]: {
                parameters: message.parameters,
                version: message.version,
                timestamp: message.timestamp
              }
            }));
          }
          break;

        case 'node_parameters_deleted':
          if (node_id) {
            setNodeParameters(prev => {
              const updated = { ...prev };
              delete updated[node_id];
              return updated;
            });
          }
          break;

        case 'variable_update':
          // Per-workflow variable storage (n8n pattern)
          if (name !== undefined) {
            const varWorkflowId = message.workflow_id || 'unknown';
            setAllVariables((prev: Record<string, Record<string, any>>) => ({
              ...prev,
              [varWorkflowId]: {
                ...(prev[varWorkflowId] || {}),
                [name]: value
              }
            }));
          }
          break;

        case 'variables_update':
          // Per-workflow batch variable update (n8n pattern)
          if (varsUpdate) {
            const batchWorkflowId = message.workflow_id || 'unknown';
            setAllVariables((prev: Record<string, Record<string, any>>) => ({
              ...prev,
              [batchWorkflowId]: {
                ...(prev[batchWorkflowId] || {}),
                ...varsUpdate
              }
            }));
          }
          break;

        case 'workflow_status':
          setWorkflowStatus(data || defaultWorkflowStatus);
          break;

        case 'deployment_status':
          // Handle deployment status updates (event-driven, no iterations)
          // Per-workflow scoping (n8n pattern): Only apply updates for current workflow
          if (message.status) {
            const deploymentWorkflowId = message.workflow_id;
            const activeWorkflowId = currentWorkflowIdRef.current;

            // Apply deployment update if:
            // 1. It's for the current workflow, OR
            // 2. It's a stop/cancel/error (affects any workflow that was running), OR
            // 3. No specific workflow context (backward compatibility)
            const isTerminalStatus = ['stopped', 'cancelled', 'error'].includes(message.status);
            const shouldApplyDeployment = !deploymentWorkflowId ||
                                           deploymentWorkflowId === activeWorkflowId ||
                                           isTerminalStatus;

            if (shouldApplyDeployment) {
              setDeploymentStatus(prev => {
                const newStatus: DeploymentStatus = { ...prev };
                // Capture workflow_id from message
                if (message.workflow_id) {
                  newStatus.workflow_id = message.workflow_id;
                }

                switch (message.status) {
                  case 'starting':
                    newStatus.isRunning = true;
                    newStatus.status = 'starting';
                    newStatus.activeRuns = 0;
                    break;
                  case 'running':
                  case 'started':
                    newStatus.isRunning = true;
                    newStatus.status = 'running';
                    newStatus.activeRuns = message.data?.active_runs ?? prev.activeRuns;
                    break;
                  case 'run_started':
                    newStatus.isRunning = true;
                    newStatus.status = 'running';
                    newStatus.activeRuns = message.data?.active_runs || prev.activeRuns + 1;
                    break;
                  case 'run_complete':
                    newStatus.activeRuns = Math.max(0, message.data?.active_runs || prev.activeRuns - 1);
                    break;
                  case 'stopped':
                    // Only clear if this was our workflow or no workflow was tracked
                    if (!prev.workflow_id || prev.workflow_id === deploymentWorkflowId) {
                      newStatus.isRunning = false;
                      newStatus.status = 'stopped';
                      newStatus.totalTime = message.data?.total_time;
                      newStatus.activeRuns = 0;
                      newStatus.workflow_id = null;
                    }
                    break;
                  case 'cancelled':
                    // Only clear if this was our workflow or no workflow was tracked
                    if (!prev.workflow_id || prev.workflow_id === deploymentWorkflowId) {
                      newStatus.isRunning = false;
                      newStatus.status = 'cancelled';
                      newStatus.activeRuns = 0;
                      newStatus.workflow_id = null;
                    }
                    break;
                  case 'error':
                    // Only clear if this was our workflow or no workflow was tracked
                    if (!prev.workflow_id || prev.workflow_id === deploymentWorkflowId) {
                      newStatus.isRunning = false;
                      newStatus.status = 'error';
                      newStatus.error = message.error;
                      newStatus.workflow_id = null;
                    }
                    break;
                }

                return newStatus;
              });
              // Sync with Zustand store's per-workflow isExecuting state (n8n pattern)
              if (deploymentWorkflowId) {
                const { setWorkflowExecuting } = useAppStore.getState();
                const isRunning = ['starting', 'running', 'started', 'run_started'].includes(message.status);
                const isStopped = ['stopped', 'cancelled', 'error'].includes(message.status);
                if (isRunning || isStopped) {
                  setWorkflowExecuting(deploymentWorkflowId, isRunning);
                }
              }
            }
          }
          break;

        case 'pong':
          // Keep-alive response, no action needed
          break;

        case 'workflow_lock':
          // Handle workflow lock status updates (per-workflow locking - n8n pattern)
          // Only update lock state if it's for the current workflow or if unlocking
          if (data) {
            const lockWorkflowId = message.workflow_id || data.workflow_id;
            const activeWorkflowId = currentWorkflowIdRef.current;

            // Apply lock update if:
            // 1. It's for the current workflow, OR
            // 2. We're unlocking (locked=false), OR
            // 3. No specific workflow context (backward compatibility)
            const shouldApplyLock = !lockWorkflowId ||
                                     lockWorkflowId === activeWorkflowId ||
                                     !data.locked;

            if (shouldApplyLock) {
              setWorkflowLock({
                locked: data.locked || false,
                workflow_id: data.workflow_id || null,
                locked_at: data.locked_at || null,
                reason: data.reason || null
              });
            }
          }
          break;

        case 'error':
          console.error('[WebSocket] Server error:', message.code, message.message);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }, []);  // Empty deps - uses ref for currentWorkflowId to avoid reconnecting WebSocket

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = getWebSocketUrl();

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = async () => {
        setIsConnected(true);
        setReconnecting(false);

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        // Load initial API key statuses for known providers
        const providers = ['openai', 'anthropic', 'gemini', 'google_maps', 'android_remote'];
        for (const provider of providers) {
          try {
            const response = await new Promise<any>((resolve, reject) => {
              const requestId = `init_${provider}_${Date.now()}`;
              const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

              const handler = (event: MessageEvent) => {
                try {
                  const msg = JSON.parse(event.data);
                  if (msg.request_id === requestId) {
                    clearTimeout(timeout);
                    ws.removeEventListener('message', handler);
                    resolve(msg);
                  }
                } catch {}
              };

              ws.addEventListener('message', handler);
              ws.send(JSON.stringify({ type: 'get_stored_api_key', provider, request_id: requestId }));
            });

            if (response.has_key) {
              setApiKeyStatuses(prev => ({
                ...prev,
                [provider]: { hasKey: true, valid: true }
              }));
            }
          } catch {
            // Ignore errors during initial check
          }
        }
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Reconnect after delay (unless intentional close)
        if (event.code !== 1000) {
          setReconnecting(true);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setReconnecting(true);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [handleMessage]);

  // Request current status
  const requestStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_status' }));
    }
  }, []);

  // Get node status for current workflow (n8n pattern)
  // IMPORTANT: Use currentWorkflowId state directly (not ref) to ensure reactivity on workflow switch
  const getNodeStatus = useCallback((nodeId: string) => {
    if (!currentWorkflowId) {
      return undefined;
    }
    return allNodeStatuses[currentWorkflowId]?.[nodeId];
  }, [allNodeStatuses, currentWorkflowId]);

  // Get API key status
  const getApiKeyStatus = useCallback((provider: string) => {
    return apiKeyStatuses[provider];
  }, [apiKeyStatuses]);

  // Get variable value for current workflow (n8n pattern)
  // IMPORTANT: Use currentWorkflowId state directly (not ref) to ensure reactivity on workflow switch
  const getVariable = useCallback((name: string) => {
    if (!currentWorkflowId) return undefined;
    return allVariables[currentWorkflowId]?.[name];
  }, [allVariables, currentWorkflowId]);

  // Clear node status (used when clearing execution results)
  // Also clears the backend node_outputs storage
  const clearNodeStatus = useCallback(async (nodeId: string) => {
    const workflowId = currentWorkflowIdRef.current;
    // Clear local state for current workflow
    setAllNodeStatuses((prev: Record<string, Record<string, NodeStatus>>) => {
      if (!workflowId || !prev[workflowId]) return prev;
      const workflowStatuses = { ...prev[workflowId] };
      delete workflowStatuses[nodeId];
      return { ...prev, [workflowId]: workflowStatuses };
    });
    // Clear backend storage
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'clear_node_output',
          node_id: nodeId,
          workflow_id: workflowId
        }));
      }
    } catch (err) {
      console.error('[WebSocket] Failed to clear backend node output:', err);
    }
  }, []);

  // Clear WhatsApp message history
  const clearWhatsAppMessages = useCallback(() => {
    setWhatsappMessages([]);
    setLastWhatsAppMessage(null);
  }, []);

  // Derive current workflow's node statuses (n8n pattern)
  // This provides a flat Record<nodeId, NodeStatus> for the current workflow
  // IMPORTANT: Use currentWorkflowId state directly, not ref, to ensure re-render on workflow switch
  const nodeStatuses = useMemo(() => {
    if (!currentWorkflowId) return {};
    return allNodeStatuses[currentWorkflowId] || {};
  }, [allNodeStatuses, currentWorkflowId]);

  // Derive current workflow's variables (n8n pattern)
  // This provides a flat Record<varName, value> for the current workflow
  // IMPORTANT: Use currentWorkflowId state directly, not ref, to ensure re-render on workflow switch
  const variables = useMemo(() => {
    if (!currentWorkflowId) return {};
    return allVariables[currentWorkflowId] || {};
  }, [allVariables, currentWorkflowId]);

  // =========================================================================
  // Core Request/Response Pattern
  // =========================================================================

  // Send a request and wait for response
  // timeoutMs: undefined/0 = use default, negative = no timeout (for trigger nodes)
  const sendRequest = useCallback(async <T = any>(
    type: string,
    data?: Record<string, any>,
    timeoutMs?: number
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = generateRequestId();
      const useTimeout = timeoutMs === undefined || timeoutMs >= 0;
      const actualTimeout = timeoutMs && timeoutMs > 0 ? timeoutMs : REQUEST_TIMEOUT;

      let timeout: NodeJS.Timeout | null = null;
      if (useTimeout && timeoutMs !== -1) {
        timeout = setTimeout(() => {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error(`Request timeout: ${type}`));
        }, actualTimeout);
      }

      pendingRequestsRef.current.set(requestId, { resolve, reject, timeout });

      wsRef.current.send(JSON.stringify({
        type,
        request_id: requestId,
        ...data
      }));
    });
  }, []);

  // =========================================================================
  // Node Parameters Operations
  // =========================================================================

  const getNodeParametersAsync = useCallback(async (nodeId: string): Promise<NodeParameters | null> => {
    try {
      const response = await sendRequest<any>('get_node_parameters', { node_id: nodeId });
      if (response.parameters) {
        const params: NodeParameters = {
          parameters: response.parameters,
          version: response.version || 0,
          timestamp: response.timestamp
        };
        // Update local cache
        setNodeParameters(prev => ({ ...prev, [nodeId]: params }));
        return params;
      }
      return null;
    } catch (error) {
      console.error('[WebSocket] Failed to get node parameters:', error);
      return null;
    }
  }, [sendRequest]);

  const getAllNodeParametersAsync = useCallback(async (nodeIds: string[]): Promise<Record<string, NodeParameters>> => {
    if (!nodeIds.length) return {};
    try {
      const response = await sendRequest<any>('get_all_node_parameters', { node_ids: nodeIds });
      const result: Record<string, NodeParameters> = {};

      if (response.parameters) {
        for (const [nodeId, data] of Object.entries(response.parameters as Record<string, any>)) {
          result[nodeId] = {
            parameters: data.parameters || {},
            version: data.version || 0,
            timestamp: response.timestamp
          };
        }
        // Update local cache with all parameters
        setNodeParameters(prev => ({ ...prev, ...result }));
      }
      return result;
    } catch (error) {
      console.error('[WebSocket] Failed to get all node parameters:', error);
      return {};
    }
  }, [sendRequest]);

  const saveNodeParametersAsync = useCallback(async (
    nodeId: string,
    parameters: Record<string, any>,
    version?: number
  ): Promise<boolean> => {
    try {
      const currentVersion = nodeParameters[nodeId]?.version || version || 0;
      const response = await sendRequest<any>('save_node_parameters', {
        node_id: nodeId,
        parameters,
        version: currentVersion
      });
      if (response.success !== false) {
        // Update local cache
        setNodeParameters(prev => ({
          ...prev,
          [nodeId]: {
            parameters: response.parameters || parameters,
            version: response.version || currentVersion + 1,
            timestamp: response.timestamp
          }
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('[WebSocket] Failed to save node parameters:', error);
      return false;
    }
  }, [sendRequest, nodeParameters]);

  const deleteNodeParametersAsync = useCallback(async (nodeId: string): Promise<boolean> => {
    try {
      await sendRequest<any>('delete_node_parameters', { node_id: nodeId });
      setNodeParameters(prev => {
        const updated = { ...prev };
        delete updated[nodeId];
        return updated;
      });
      return true;
    } catch (error) {
      console.error('[WebSocket] Failed to delete node parameters:', error);
      return false;
    }
  }, [sendRequest]);

  // =========================================================================
  // Node Execution Operations
  // =========================================================================

  const executeNodeAsync = useCallback(async (
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    nodes?: any[],
    edges?: any[]
  ): Promise<any> => {
    try {
      // Trigger nodes wait indefinitely for events - no timeout
      const isTriggerNode = TRIGGER_NODE_TYPES.includes(nodeType);
      const timeoutMs = isTriggerNode ? -1 : undefined;  // -1 = no timeout

      const response = await sendRequest<any>('execute_node', {
        node_id: nodeId,
        node_type: nodeType,
        parameters,
        nodes,
        edges
      }, timeoutMs);
      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to execute node:', error);
      throw error;
    }
  }, [sendRequest]);

  const getNodeOutputAsync = useCallback(async (
    nodeId: string,
    outputName?: string
  ): Promise<any> => {
    try {
      const response = await sendRequest<any>('get_node_output', {
        node_id: nodeId,
        output_name: outputName || 'output_0'
      });
      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('[WebSocket] Failed to get node output:', error);
      return null;
    }
  }, [sendRequest]);

  // Cancel event wait (for trigger nodes)
  const cancelEventWaitAsync = useCallback(async (
    nodeId: string,
    waiterId?: string
  ): Promise<{ success: boolean; cancelled_count?: number }> => {
    try {
      const response = await sendRequest<{ success: boolean; cancelled_count?: number }>('cancel_event_wait', {
        node_id: nodeId,
        waiter_id: waiterId
      });
      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to cancel event wait:', error);
      return { success: false };
    }
  }, [sendRequest]);

  const executeWorkflowAsync = useCallback(async (
    nodes: any[],
    edges: any[],
    sessionId?: string
  ): Promise<any> => {
    try {
      const response = await sendRequest<any>('execute_workflow', {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type || '',
          data: node.data || {}
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined
        })),
        session_id: sessionId || 'default'
      });

      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to execute workflow:', error);
      throw error;
    }
  }, [sendRequest]);

  // =========================================================================
  // Deployment Operations
  // =========================================================================

  const deployWorkflowAsync = useCallback(async (
    workflowId: string,
    nodes: any[],
    edges: any[],
    sessionId?: string
  ): Promise<any> => {
    try {
      const response = await sendRequest<any>('deploy_workflow', {
        workflow_id: workflowId,
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type || '',
          data: node.data || {}
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined
        })),
        session_id: sessionId || 'default'
      });

      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to start deployment:', error);
      throw error;
    }
  }, [sendRequest]);

  const cancelDeploymentAsync = useCallback(async (workflowId?: string): Promise<any> => {
    try {
      const response = await sendRequest<any>('cancel_deployment', {
        workflow_id: workflowId
      });

      // Reset deployment status only if the cancelled workflow matches current
      if (!workflowId || workflowId === deploymentStatus.workflow_id) {
        setDeploymentStatus(defaultDeploymentStatus);
      }

      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to cancel deployment:', error);
      throw error;
    }
  }, [sendRequest, deploymentStatus.workflow_id]);

  const getDeploymentStatusAsync = useCallback(async (workflowId?: string): Promise<{ isRunning: boolean; activeRuns: number; settings?: any; workflow_id?: string }> => {
    try {
      const response = await sendRequest<any>('get_deployment_status', { workflow_id: workflowId });
      return {
        isRunning: response.is_running || false,
        activeRuns: response.active_runs || 0,
        settings: response.settings,
        workflow_id: response.workflow_id
      };
    } catch (error) {
      console.error('[WebSocket] Failed to get deployment status:', error);
      return { isRunning: false, activeRuns: 0 };
    }
  }, [sendRequest]);

  // =========================================================================
  // AI Operations
  // =========================================================================

  const executeAiNodeAsync = useCallback(async (
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    model: string
  ): Promise<any> => {
    try {
      const response = await sendRequest<any>('execute_ai_node', {
        node_id: nodeId,
        node_type: nodeType,
        parameters,
        model
      });
      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to execute AI node:', error);
      throw error;
    }
  }, [sendRequest]);

  const getAiModelsAsync = useCallback(async (provider: string, apiKey: string): Promise<string[]> => {
    try {
      const response = await sendRequest<any>('get_ai_models', {
        provider,
        api_key: apiKey
      });
      return response.models || [];
    } catch (error) {
      console.error('[WebSocket] Failed to get AI models:', error);
      return [];
    }
  }, [sendRequest]);

  // =========================================================================
  // API Key Operations
  // =========================================================================

  const validateApiKeyAsync = useCallback(async (
    provider: string,
    apiKey: string
  ): Promise<{ valid: boolean; message?: string; models?: string[] }> => {
    try {
      const response = await sendRequest<any>('validate_api_key', {
        provider,
        api_key: apiKey
      });
      const result = {
        valid: response.valid || false,
        message: response.message,
        models: response.models
      };

      // Update apiKeyStatuses on successful validation
      if (result.valid) {
        setApiKeyStatuses(prev => ({
          ...prev,
          [provider]: { hasKey: true, valid: true, models: result.models }
        }));
      }

      return result;
    } catch (error) {
      console.error('[WebSocket] Failed to validate API key:', error);
      return { valid: false, message: 'Validation failed' };
    }
  }, [sendRequest]);

  const getStoredApiKeyAsync = useCallback(async (
    provider: string
  ): Promise<{ hasKey: boolean; apiKey?: string; models?: string[] }> => {
    try {
      const response = await sendRequest<any>('get_stored_api_key', { provider });
      const result = {
        hasKey: response.has_key || false,
        apiKey: response.api_key,
        models: response.models
      };

      // Update apiKeyStatuses with stored models
      if (result.hasKey) {
        setApiKeyStatuses(prev => ({
          ...prev,
          [provider]: { hasKey: true, valid: true, models: result.models }
        }));
      }

      return result;
    } catch (error) {
      console.error('[WebSocket] Failed to get stored API key:', error);
      return { hasKey: false };
    }
  }, [sendRequest]);

  const saveApiKeyAsync = useCallback(async (
    provider: string,
    apiKey: string,
    models?: string[]
  ): Promise<boolean> => {
    try {
      const response = await sendRequest<any>('save_api_key', {
        provider,
        api_key: apiKey,
        models
      });
      const success = response.success !== false;

      // Update apiKeyStatuses on successful save
      if (success) {
        setApiKeyStatuses(prev => ({
          ...prev,
          [provider]: { hasKey: true, valid: true, models }
        }));
      }

      return success;
    } catch (error) {
      console.error('[WebSocket] Failed to save API key:', error);
      return false;
    }
  }, [sendRequest]);

  const deleteApiKeyAsync = useCallback(async (provider: string): Promise<boolean> => {
    try {
      await sendRequest<any>('delete_api_key', { provider });

      // Remove from apiKeyStatuses on successful delete
      setApiKeyStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[provider];
        return newStatuses;
      });

      return true;
    } catch (error) {
      console.error('[WebSocket] Failed to delete API key:', error);
      return false;
    }
  }, [sendRequest]);

  // =========================================================================
  // Android Operations
  // =========================================================================

  const getAndroidDevicesAsync = useCallback(async (): Promise<string[]> => {
    try {
      const response = await sendRequest<any>('get_android_devices', {});
      return response.devices || [];
    } catch (error) {
      console.error('[WebSocket] Failed to get Android devices:', error);
      return [];
    }
  }, [sendRequest]);

  const executeAndroidActionAsync = useCallback(async (
    serviceId: string,
    action: string,
    parameters: Record<string, any>,
    deviceId?: string
  ): Promise<any> => {
    try {
      const response = await sendRequest<any>('execute_android_action', {
        service_id: serviceId,
        action,
        parameters,
        device_id: deviceId
      });
      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to execute Android action:', error);
      throw error;
    }
  }, [sendRequest]);

  const setupAndroidDeviceAsync = useCallback(async (
    connectionType: string,
    deviceId?: string,
    websocketUrl?: string
  ): Promise<any> => {
    try {
      const response = await sendRequest<any>('setup_android_device', {
        connection_type: connectionType,
        device_id: deviceId,
        websocket_url: websocketUrl
      });
      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to setup Android device:', error);
      throw error;
    }
  }, [sendRequest]);

  // =========================================================================
  // Maps Operations
  // =========================================================================

  const validateMapsKeyAsync = useCallback(async (
    apiKey: string
  ): Promise<{ valid: boolean; message?: string }> => {
    try {
      const response = await sendRequest<any>('validate_maps_key', { api_key: apiKey });
      return {
        valid: response.valid || false,
        message: response.message
      };
    } catch (error) {
      console.error('[WebSocket] Failed to validate Maps key:', error);
      return { valid: false, message: 'Validation failed' };
    }
  }, [sendRequest]);

  // =========================================================================
  // WhatsApp Operations
  // =========================================================================

  const getWhatsAppStatusAsync = useCallback(async (): Promise<{ connected: boolean; deviceId?: string; data?: any }> => {
    try {
      const response = await sendRequest<any>('whatsapp_status', {});
      return {
        connected: response.connected || false,
        deviceId: response.device_id,
        data: response.data
      };
    } catch (error) {
      console.error('[WebSocket] Failed to get WhatsApp status:', error);
      return { connected: false };
    }
  }, [sendRequest]);

  const getWhatsAppQRAsync = useCallback(async (): Promise<{ connected: boolean; qr?: string; message?: string }> => {
    try {
      const response = await sendRequest<any>('whatsapp_qr', {});
      return {
        connected: response.connected || false,
        qr: response.qr,
        message: response.message
      };
    } catch (error) {
      console.error('[WebSocket] Failed to get WhatsApp QR:', error);
      return { connected: false, message: 'Failed to get QR code' };
    }
  }, [sendRequest]);

  const sendWhatsAppMessageAsync = useCallback(async (
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      const response = await sendRequest<any>('whatsapp_send', { phone, message });
      return {
        success: response.success || false,
        messageId: response.messageId,
        error: response.error
      };
    } catch (error: any) {
      console.error('[WebSocket] Failed to send WhatsApp message:', error);
      return { success: false, error: error.message || 'Send failed' };
    }
  }, [sendRequest]);

  const startWhatsAppConnectionAsync = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await sendRequest<any>('whatsapp_start', {});
      return {
        success: response.success !== false,
        message: response.message
      };
    } catch (error: any) {
      console.error('[WebSocket] Failed to start WhatsApp connection:', error);
      return { success: false, message: error.message || 'Failed to start' };
    }
  }, [sendRequest]);

  const restartWhatsAppConnectionAsync = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await sendRequest<any>('whatsapp_restart', {});
      return {
        success: response.success !== false,
        message: response.message
      };
    } catch (error: any) {
      console.error('[WebSocket] Failed to restart WhatsApp connection:', error);
      return { success: false, message: error.message || 'Failed to restart' };
    }
  }, [sendRequest]);

  const getWhatsAppGroupsAsync = useCallback(async (): Promise<{ success: boolean; groups: Array<{ jid: string; name: string; topic?: string; size?: number }>; error?: string }> => {
    try {
      const response = await sendRequest<any>('whatsapp_groups', {});
      return {
        success: response.success !== false,
        groups: response.groups || [],
        error: response.error
      };
    } catch (error: any) {
      console.error('[WebSocket] Failed to get WhatsApp groups:', error);
      return { success: false, groups: [], error: error.message || 'Failed to get groups' };
    }
  }, [sendRequest]);

  const getWhatsAppGroupInfoAsync = useCallback(async (groupId: string): Promise<{ success: boolean; participants: Array<{ phone: string; name: string; jid: string; is_admin?: boolean }>; name?: string; error?: string }> => {
    try {
      const response = await sendRequest<any>('whatsapp_group_info', { group_id: groupId });
      return {
        success: response.success !== false,
        participants: response.participants || [],
        name: response.name,
        error: response.error
      };
    } catch (error: any) {
      console.error('[WebSocket] Failed to get WhatsApp group info:', error);
      return { success: false, participants: [], error: error.message || 'Failed to get group info' };
    }
  }, [sendRequest]);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Connect only when authenticated (not during auth loading)
  useEffect(() => {
    isMountedRef.current = true;

    // Don't connect if still loading auth or not authenticated
    if (authLoading || !isAuthenticated) {
      return;
    }

    // Skip if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Small delay to avoid React Strict Mode double-connection issues
    const connectTimeout = setTimeout(() => {
      if (isMountedRef.current && isAuthenticated && !wsRef.current) {
        connect();
      }
    }, 100);

    return () => {
      clearTimeout(connectTimeout);
    };
  }, [connect, isAuthenticated, authLoading]);

  // Handle logout - separate effect to avoid reconnect loops
  useEffect(() => {
    if (!isAuthenticated && wsRef.current) {
      wsRef.current.close(1000, 'User logged out');
      wsRef.current = null;
      setIsConnected(false);
    }
  }, [isAuthenticated]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, []);

  const value: WebSocketContextValue = {
    // Connection state
    isConnected,
    reconnecting,

    // Status data
    androidStatus,
    whatsappStatus,
    whatsappMessages,
    lastWhatsAppMessage,
    apiKeyStatuses,
    nodeStatuses,
    nodeParameters,
    variables,
    workflowStatus,
    deploymentStatus,
    workflowLock,

    // Status getters
    getNodeStatus,
    getApiKeyStatus,
    getVariable,
    requestStatus,
    clearNodeStatus,
    clearWhatsAppMessages,

    // Generic request method
    sendRequest,

    // Node Parameters
    getNodeParameters: getNodeParametersAsync,
    getAllNodeParameters: getAllNodeParametersAsync,
    saveNodeParameters: saveNodeParametersAsync,
    deleteNodeParameters: deleteNodeParametersAsync,

    // Node Execution
    executeNode: executeNodeAsync,
    executeWorkflow: executeWorkflowAsync,
    getNodeOutput: getNodeOutputAsync,

    // Trigger/Event Waiting
    cancelEventWait: cancelEventWaitAsync,

    // Deployment Operations
    deployWorkflow: deployWorkflowAsync,
    cancelDeployment: cancelDeploymentAsync,
    getDeploymentStatus: getDeploymentStatusAsync,

    // AI Operations
    executeAiNode: executeAiNodeAsync,
    getAiModels: getAiModelsAsync,

    // API Key Operations
    validateApiKey: validateApiKeyAsync,
    getStoredApiKey: getStoredApiKeyAsync,
    saveApiKey: saveApiKeyAsync,
    deleteApiKey: deleteApiKeyAsync,

    // Android Operations
    getAndroidDevices: getAndroidDevicesAsync,
    executeAndroidAction: executeAndroidActionAsync,
    setupAndroidDevice: setupAndroidDeviceAsync,

    // Maps Operations
    validateMapsKey: validateMapsKeyAsync,

    // WhatsApp Operations
    getWhatsAppStatus: getWhatsAppStatusAsync,
    getWhatsAppQR: getWhatsAppQRAsync,
    sendWhatsAppMessage: sendWhatsAppMessageAsync,
    startWhatsAppConnection: startWhatsAppConnectionAsync,
    restartWhatsAppConnection: restartWhatsAppConnectionAsync,
    getWhatsAppGroups: getWhatsAppGroupsAsync,
    getWhatsAppGroupInfo: getWhatsAppGroupInfoAsync
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook to use WebSocket context
export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Hook specifically for Android status
export const useAndroidStatus = (): AndroidStatus & { isConnected: boolean } => {
  const { androidStatus, isConnected } = useWebSocket();
  return {
    ...androidStatus,
    isConnected
  };
};

// Hook specifically for node status
export const useNodeStatus = (nodeId: string): NodeStatus | undefined => {
  const { getNodeStatus } = useWebSocket();
  return getNodeStatus(nodeId);
};

// Hook specifically for workflow status
export const useWorkflowStatus = (): WorkflowStatus => {
  const { workflowStatus } = useWebSocket();
  return workflowStatus;
};

// Hook specifically for API key status
export const useApiKeyStatus = (provider: string): ApiKeyStatus | undefined => {
  const { getApiKeyStatus } = useWebSocket();
  return getApiKeyStatus(provider);
};

// Hook specifically for WhatsApp status
export const useWhatsAppStatus = (): WhatsAppStatus => {
  const { whatsappStatus } = useWebSocket();
  return whatsappStatus;
};

// Hook specifically for deployment status
export const useDeploymentStatus = (): DeploymentStatus => {
  const { deploymentStatus } = useWebSocket();
  return deploymentStatus;
};

// Hook specifically for workflow lock status
export const useWorkflowLock = (): WorkflowLock => {
  const { workflowLock } = useWebSocket();
  return workflowLock;
};

// Hook specifically for WhatsApp messages (for trigger nodes)
export const useWhatsAppMessages = (): {
  messages: WhatsAppMessage[];
  lastMessage: WhatsAppMessage | null;
  clearMessages: () => void;
} => {
  const { whatsappMessages, lastWhatsAppMessage, clearWhatsAppMessages } = useWebSocket();
  return {
    messages: whatsappMessages,
    lastMessage: lastWhatsAppMessage,
    clearMessages: clearWhatsAppMessages
  };
};

// Hook to check if a tool is currently being executed by any AI Agent
// Used by tool nodes to show spinning indicator when they're being used
export const useIsToolExecuting = (toolName: string): boolean => {
  const { nodeStatuses } = useWebSocket();

  // Debug: Log what we're checking
  if (toolName) {
    const statusCount = Object.keys(nodeStatuses).length;
    if (statusCount > 0) {
      console.log(`[useIsToolExecuting] Checking for tool '${toolName}', nodeStatuses count:`, statusCount, nodeStatuses);
    }
  }

  // Scan all node statuses to find if any AI Agent is executing this tool
  // The status object contains phase and tool_name directly (not nested under data)
  for (const nodeId in nodeStatuses) {
    const status = nodeStatuses[nodeId] as Record<string, any>;
    if (status?.phase === 'executing_tool') {
      console.log(`[useIsToolExecuting] Found executing_tool phase for node ${nodeId}:`, status);
      if (status?.tool_name === toolName) {
        console.log(`[useIsToolExecuting] MATCH! Tool '${toolName}' is executing`);
        return true;
      }
    }
  }
  return false;
};

export default WebSocketContext;
