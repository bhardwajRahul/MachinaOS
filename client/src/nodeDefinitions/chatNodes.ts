// Chat Node Definitions - JSON-RPC 2.0 WebSocket chat integration
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const chatNodes: Record<string, INodeTypeDescription> = {
  // Chat Send Message Node
  chatSend: {
    displayName: 'Chat Send',
    name: 'chatSend',
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
    // Wave 8: schema lives on backend (ChatSendParams).
    properties: [],
  },

  // Chat Get History Node
  chatHistory: {
    displayName: 'Chat History',
    name: 'chatHistory',
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
    // Wave 8: schema lives on backend (ChatHistoryParams).
    properties: [],
  },
};

export const CHAT_NODE_TYPES = ['chatSend', 'chatHistory'];
