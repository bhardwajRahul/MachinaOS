// AI Agent Node Definitions - AI agents and AI processing components
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

// ============================================================================
// AI AGENT AND CHAT NODES
// ============================================================================

export const aiAgentNodes: Record<string, INodeTypeDescription> = {
  // AI Agent Node - n8n official style implementation (first for top position in Agents category)
  aiAgent: {
    displayName: 'AI Agent',
    name: 'aiAgent',
    icon: '🤖',
    group: ['agent'],
    version: 1,
    subtitle: 'Tools Agent',
    description: 'Advanced AI agent with tool calling capabilities, memory, and iterative reasoning',
    defaults: { name: 'AI Agent', color: '#9333EA' },
    inputs: [
      {
        name: 'main',
        displayName: 'Input',
        type: 'main' as NodeConnectionType,
        description: 'Agent input'
      },
      {
        name: 'memory',
        displayName: 'Memory',
        type: 'main' as NodeConnectionType,
        description: 'Memory node connection for conversation history'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Agent output'
    }],
    properties: [
      {
        displayName: 'AI Provider',
        name: 'provider',
        type: 'options',
        options: [
          {
            name: 'OpenAI',
            value: 'openai'
          },
          {
            name: 'Anthropic (Claude)',
            value: 'anthropic'
          },
          {
            name: 'Google (Gemini)',
            value: 'gemini'
          }
        ],
        default: 'openai',
        description: 'The AI provider to use (configure API keys in Credentials)'
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Select a model...',
        description: 'AI model to use for the agent',
        typeOptions: {
          dynamicOptions: true,
          dependsOn: ['provider']
        }
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        default: '{{ $json.chatInput }}',
        required: true,
        typeOptions: {
          rows: 4
        },
        description: 'The prompt template for the AI agent',
        placeholder: 'Enter your prompt or use template variables...'
      },
      {
        displayName: 'System Message',
        name: 'systemMessage',
        type: 'string',
        default: 'You are a helpful assistant',
        typeOptions: {
          rows: 3
        },
        description: 'Define the behavior and personality of the AI agent'
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Temperature',
            name: 'temperature',
            type: 'number',
            default: 0.7,
            typeOptions: { minValue: 0, maxValue: 2, numberStepSize: 0.1 },
            description: 'Controls randomness in responses'
          },
          {
            displayName: 'Maximum Tokens',
            name: 'maxTokens',
            type: 'number',
            default: 1000,
            typeOptions: { minValue: 1, maxValue: 8192 },
            description: 'Maximum number of tokens to generate'
          },
          {
            displayName: 'Thinking/Reasoning',
            name: 'thinkingEnabled',
            type: 'boolean',
            default: false,
            description: 'Enable extended thinking for supported providers (Anthropic, OpenAI o-series, Gemini, Groq, Cerebras)'
          },
          {
            displayName: 'Thinking Budget',
            name: 'thinkingBudget',
            type: 'number',
            default: 2048,
            typeOptions: { minValue: 1024, maxValue: 16000 },
            description: 'Token budget for thinking (Claude, Gemini, Cerebras)',
            displayOptions: { show: { thinkingEnabled: [true] } }
          },
          {
            displayName: 'Reasoning Effort',
            name: 'reasoningEffort',
            type: 'options',
            options: [
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' }
            ],
            default: 'medium',
            description: 'Reasoning effort level (OpenAI o-series, Groq)',
            displayOptions: { show: { thinkingEnabled: [true] } }
          }
        ] as any
      }
    ]
  },

  // Chat Agent Node - Conversational AI agent with memory and skill support (no tools)
  chatAgent: {
    displayName: 'Chat Agent',
    name: 'chatAgent',
    icon: '💬',
    group: ['agent'],
    version: 1,
    subtitle: 'Conversational Agent',
    description: 'Conversational AI agent with memory and skill support for multi-turn chat interactions',
    defaults: { name: 'Chat Agent', color: '#3B82F6' },
    inputs: [
      {
        name: 'main',
        displayName: 'Input',
        type: 'main' as NodeConnectionType,
        description: 'Chat input'
      },
      {
        name: 'memory',
        displayName: 'Memory',
        type: 'main' as NodeConnectionType,
        description: 'Memory node connection for conversation history'
      },
      {
        name: 'skill',
        displayName: 'Skill',
        type: 'main' as NodeConnectionType,
        description: 'AI Skill node connection'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'response, model, provider, timestamp'
    }],
    properties: [
      {
        displayName: 'AI Provider',
        name: 'provider',
        type: 'options',
        options: [
          {
            name: 'OpenAI',
            value: 'openai'
          },
          {
            name: 'Anthropic (Claude)',
            value: 'anthropic'
          },
          {
            name: 'Google (Gemini)',
            value: 'gemini'
          },
          {
            name: 'Groq',
            value: 'groq'
          },
          {
            name: 'OpenRouter',
            value: 'openrouter'
          }
        ],
        default: 'openai',
        description: 'The AI provider to use (configure API keys in Credentials)'
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Select a model...',
        description: 'AI model to use for the chat',
        typeOptions: {
          dynamicOptions: true,
          dependsOn: ['provider']
        }
      }
    ]
  },

  // Simple Memory Node - conversation history storage for AI agents
  // No run button - memory is accessed automatically when AI Agent runs
  simpleMemory: {
    displayName: 'Simple Memory',
    name: 'simpleMemory',
    icon: '🧠',
    group: ['skill', 'memory'],  // 'skill' = appears in AI Skills category
    version: 1,
    description: 'Store conversation history for AI agents',
    defaults: { name: 'Memory', color: '#8b5cf6' },
    inputs: [],  // No input - memory node is passive
    outputs: [{
      name: 'memory',
      displayName: 'Memory',
      type: 'main' as NodeConnectionType,
      description: 'session_id, messages, message_count, memory_type'
    }],
    properties: [
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        description: 'Unique identifier for conversation session. Use different IDs for separate conversations.'
      },
      {
        displayName: 'Memory Type',
        name: 'memoryType',
        type: 'options',
        default: 'buffer',
        options: [
          { name: 'Buffer (All Messages)', value: 'buffer' },
          { name: 'Window (Last N)', value: 'window' }
        ],
        description: 'Buffer keeps all messages, Window keeps only the last N messages'
      },
      {
        displayName: 'Window Size',
        name: 'windowSize',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Number of recent messages to keep (for Window type)',
        displayOptions: {
          show: {
            memoryType: ['window']
          }
        }
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// List of AI-related node types for easy identification (chat models removed - now in aiModelNodes.ts)
export const AI_NODE_TYPES = ['aiAgent', 'chatAgent', 'simpleMemory'];