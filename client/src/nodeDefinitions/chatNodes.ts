// Chat Node Definitions - JSON-RPC 2.0 WebSocket chat integration
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// Chat icon (speech bubble)
const CHAT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234A90D9'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z'/%3E%3C/svg%3E";

export const chatNodes: Record<string, INodeTypeDescription> = {
  // Chat Send Message Node
  chatSend: {
    displayName: 'Chat Send',
    name: 'chatSend',
    icon: CHAT_ICON,
    group: ['chat'],
    version: 1,
    subtitle: 'Send Chat Message',
    description: 'Send a message to the chat backend via JSON-RPC 2.0 WebSocket',
    defaults: { name: 'Chat Send', color: '#4A90D9' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger input'
    }],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'message_id, status, timestamp'
    }],
    properties: [
      // Connection settings
      {
        displayName: 'Host',
        name: 'host',
        type: 'string',
        default: 'localhost',
        description: 'Chat server host'
      },
      {
        displayName: 'Port',
        name: 'port',
        type: 'number',
        default: 8080,
        description: 'Chat server port'
      },
      {
        displayName: 'Session ID',
        name: 'session_id',
        type: 'string',
        default: 'default',
        description: 'Chat session identifier'
      },
      {
        displayName: 'API Key',
        name: 'api_key',
        type: 'string',
        default: '',
        description: 'API key for authentication'
      },
      // Message
      {
        displayName: 'Message',
        name: 'content',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 3 },
        description: 'Message content to send'
      }
    ]
  },

  // Chat Get History Node
  chatHistory: {
    displayName: 'Chat History',
    name: 'chatHistory',
    icon: CHAT_ICON,
    group: ['chat'],
    version: 1,
    subtitle: 'Get Chat History',
    description: 'Retrieve chat message history from the backend',
    defaults: { name: 'Chat History', color: '#4A90D9' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger input'
    }],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'messages array'
    }],
    properties: [
      {
        displayName: 'Host',
        name: 'host',
        type: 'string',
        default: 'localhost',
        description: 'Chat server host'
      },
      {
        displayName: 'Port',
        name: 'port',
        type: 'number',
        default: 8080,
        description: 'Chat server port'
      },
      {
        displayName: 'Session ID',
        name: 'session_id',
        type: 'string',
        default: 'default',
        description: 'Chat session identifier'
      },
      {
        displayName: 'API Key',
        name: 'api_key',
        type: 'string',
        default: '',
        description: 'API key for authentication'
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        description: 'Maximum number of messages to retrieve'
      }
    ]
  }
};

export const CHAT_NODE_TYPES = ['chatSend', 'chatHistory'];
