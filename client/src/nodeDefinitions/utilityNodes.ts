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
    group: ['utility'],
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
    properties: [
      {
        displayName: 'Method',
        name: 'method',
        type: 'options',
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' }
        ]
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://api.example.com/endpoint'
      },
      {
        displayName: 'Headers',
        name: 'headers',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 3 },
        placeholder: '{"Authorization": "Bearer token"}'
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        default: '',
        typeOptions: { rows: 4 },
        placeholder: '{"key": "value"}',
        displayOptions: { show: { method: ['POST', 'PUT', 'PATCH'] } }
      },
      {
        displayName: 'Timeout (seconds)',
        name: 'timeout',
        type: 'number',
        default: 30
      }
    ]
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
    properties: [
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'my-webhook',
        description: 'URL: http://localhost:3010/webhook/{path}'
      },
      {
        displayName: 'HTTP Method',
        name: 'method',
        type: 'options',
        default: 'POST',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'Any', value: 'ALL' }
        ]
      },
      {
        displayName: 'Response Mode',
        name: 'responseMode',
        type: 'options',
        default: 'immediate',
        options: [
          { name: 'Immediate (200 OK)', value: 'immediate' },
          { name: 'Wait for Response Node', value: 'responseNode' }
        ]
      },
      {
        displayName: 'Authentication',
        name: 'authentication',
        type: 'options',
        default: 'none',
        options: [
          { name: 'None', value: 'none' },
          { name: 'Header Auth', value: 'header' }
        ]
      },
      {
        displayName: 'Header Name',
        name: 'headerName',
        type: 'string',
        default: 'X-API-Key',
        displayOptions: { show: { authentication: ['header'] } }
      },
      {
        displayName: 'Header Value',
        name: 'headerValue',
        type: 'string',
        default: '',
        displayOptions: { show: { authentication: ['header'] } }
      }
    ]
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
    properties: [
      {
        displayName: 'Status Code',
        name: 'statusCode',
        type: 'number',
        default: 200
      },
      {
        displayName: 'Response Body',
        name: 'responseBody',
        type: 'string',
        default: '',
        typeOptions: { rows: 4 },
        placeholder: '{"success": true, "data": ...}'
      },
      {
        displayName: 'Content Type',
        name: 'contentType',
        type: 'options',
        default: 'application/json',
        options: [
          { name: 'JSON', value: 'application/json' },
          { name: 'Text', value: 'text/plain' },
          { name: 'HTML', value: 'text/html' }
        ]
      }
    ]
  },

  console: {
    displayName: 'Console',
    name: 'console',
    icon: '🖥️',
    group: ['utility'],
    version: 1,
    description: 'Log data to console panel for debugging during execution',
    defaults: { name: 'Console', color: '#8b5cf6' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Data to log' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Passes input through unchanged' }],
    properties: [
      {
        displayName: 'Label',
        name: 'label',
        type: 'string',
        default: '',
        placeholder: 'Debug Point 1',
        description: 'Optional label to identify this log entry'
      },
      {
        displayName: 'Log Mode',
        name: 'logMode',
        type: 'options',
        default: 'all',
        options: [
          { name: 'Log All Input', value: 'all' },
          { name: 'Log Specific Field', value: 'field' },
          { name: 'Log Expression', value: 'expression' }
        ],
        description: 'What to log from the input data'
      },
      {
        displayName: 'Field Path',
        name: 'fieldPath',
        type: 'string',
        default: '',
        placeholder: 'data.items[0].name',
        displayOptions: { show: { logMode: ['field'] } },
        description: 'Path to specific field to log (e.g., data.items[0].name)'
      },
      {
        displayName: 'Expression',
        name: 'expression',
        type: 'string',
        default: '',
        placeholder: '{{input.field}}',
        displayOptions: { show: { logMode: ['expression'] } },
        description: 'Template expression to evaluate and log'
      },
      {
        displayName: 'Format',
        name: 'format',
        type: 'options',
        default: 'json',
        options: [
          { name: 'JSON (Pretty)', value: 'json' },
          { name: 'JSON (Compact)', value: 'json_compact' },
          { name: 'Text', value: 'text' },
          { name: 'Table', value: 'table' }
        ],
        description: 'Output format for the log'
      }
    ]
  }
};

export const UTILITY_NODE_TYPES = ['httpRequest', 'webhookTrigger', 'webhookResponse', 'console'];
