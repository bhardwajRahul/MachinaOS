// Utility Nodes - HTTP Request, Webhooks
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

export const utilityNodes: Record<string, INodeTypeDescription> = {
  httpRequest: {
    displayName: 'HTTP Request',
    name: 'httpRequest',
    icon: '🌐',
    group: ['utility', 'tool'],
    version: 1,
    description: 'Make HTTP requests to external APIs',
    defaults: { name: 'HTTP Request', color: '#6366f1' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Trigger input' }],
    outputs: [{
      name: 'main',
      displayName: 'Response',
      type: 'main' as NodeConnectionType,
      description: 'status, data, headers'
    }],
    // Wave 8: schema lives on backend (HttpRequestParams). Only UX
    // placeholders and JSON starter blobs remain here.
    properties: [
      { displayName: 'URL', name: 'url', type: 'string' as any, default: '', placeholder: 'https://api.example.com/endpoint' },
      { displayName: 'Headers', name: 'headers', type: 'string' as any, default: '{}', placeholder: '{"Authorization": "Bearer token"}' },
      { displayName: 'Body', name: 'body', type: 'string' as any, default: '', placeholder: '{"key": "value"}' },
      { displayName: 'Proxy Country', name: 'proxyCountry', type: 'string' as any, default: '', placeholder: 'US' },
      { displayName: 'Proxy Provider', name: 'proxyProvider', type: 'string' as any, default: '', placeholder: 'Auto-select' },
    ],
  },

  webhookTrigger: {
    displayName: 'Webhook Trigger',
    name: 'webhookTrigger',
    icon: '🪝',
    group: ['trigger'],
    version: 1,
    description: 'Start workflow when HTTP request is received',
    defaults: { name: 'Webhook', color: '#f59e0b' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Request',
      type: 'main' as NodeConnectionType,
      description: 'method, path, headers, query, body, json'
    }],
    // Wave 8: schema lives on backend (WebhookTriggerParams).
    properties: [
      { displayName: 'Path', name: 'path', type: 'string' as any, default: '', placeholder: 'my-webhook' },
    ],
  },

  webhookResponse: {
    displayName: 'Webhook Response',
    name: 'webhookResponse',
    icon: '↩️',
    group: ['utility'],
    version: 1,
    description: 'Send response back to webhook caller',
    defaults: { name: 'Response', color: '#10b981' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Trigger input' }],
    outputs: [],
    // Wave 8: schema lives on backend (WebhookResponseParams).
    properties: [
      { displayName: 'Response Body', name: 'responseBody', type: 'string' as any, default: '', placeholder: '{"success": true, "data": ...}' },
    ],
  },

  chatTrigger: {
    displayName: 'Chat Trigger',
    name: 'chatTrigger',
    icon: '💬',
    group: ['utility', 'trigger'],
    version: 1,
    description: 'Trigger workflow when user sends a chat message from the console input',
    defaults: { name: 'Chat Trigger', color: '#10b981' },
    uiHints: { isChatTrigger: true },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Message',
      type: 'main' as NodeConnectionType,
      description: 'message, timestamp, session_id'
    }],
    // Wave 8: schema lives on backend (ChatTriggerParams).
    properties: [],
  },

  console: {
    displayName: 'Console',
    name: 'console',
    icon: '🖥️',
    group: ['utility'],
    version: 1,
    description: 'Log data to console panel for debugging during execution',
    defaults: { name: 'Console', color: '#8b5cf6' },
    uiHints: { isConsoleSink: true },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Data to log' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Passes input through unchanged' }],
    // Wave 8: schema lives on backend (ConsoleParams).
    properties: [
      { displayName: 'Label', name: 'label', type: 'string' as any, default: '', placeholder: 'Debug Point 1' },
      { displayName: 'Field Path', name: 'fieldPath', type: 'string' as any, default: '', placeholder: 'data.items[0].name' },
      { displayName: 'Expression', name: 'expression', type: 'string' as any, default: '', placeholder: '{{input.field}}' },
    ],
  },

  teamMonitor: {
    displayName: 'Team Monitor',
    name: 'teamMonitor',
    icon: '📊',
    group: ['utility', 'agent'],
    version: 1,
    description: 'Monitor agent team operations, tasks, and messages in real-time',
    defaults: { name: 'Team Monitor', color: '#8b5cf6' },
    uiHints: { hideInputSection: true, hideOutputSection: true, isMonitorPanel: true },
    inputs: [{ name: 'team', displayName: 'Team', type: 'main' as NodeConnectionType, description: 'Connect to AI Employee or Orchestrator Agent node' }],
    outputs: [{ name: 'main', displayName: 'Events', type: 'main' as NodeConnectionType, description: 'task_completed, task_failed, message_received, team_status' }],
    // Wave 8: schema lives on backend (TeamMonitorParams).
    properties: [],
  },
};

export const UTILITY_NODE_TYPES = ['httpRequest', 'webhookTrigger', 'webhookResponse', 'chatTrigger', 'console', 'teamMonitor'];
