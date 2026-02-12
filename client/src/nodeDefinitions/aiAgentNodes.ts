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
        name: 'skill',
        displayName: 'Skill',
        type: 'main' as NodeConnectionType,
        description: 'Skill nodes that provide context and instructions'
      },
      {
        name: 'memory',
        displayName: 'Memory',
        type: 'main' as NodeConnectionType,
        description: 'Memory node for conversation history'
      },
      {
        name: 'tools',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Tool nodes for agent capabilities'
      },
      {
        name: 'task',
        displayName: 'Task',
        type: 'main' as NodeConnectionType,
        description: 'Task completion events from taskTrigger'
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

  // Zeenie Agent Node - Conversational AI agent with skill-based tool calling
  chatAgent: {
    displayName: 'Zeenie',
    name: 'chatAgent',
    icon: '🧞',
    group: ['agent'],
    version: 1,
    subtitle: 'Your Personal Assistant',
    description: 'Zeenie - your personal assistant with skill-based tool calling for multi-turn chat interactions',
    defaults: { name: 'Zeenie', color: '#3B82F6' },
    inputs: [
      {
        name: 'main',
        displayName: 'Input',
        type: 'main' as NodeConnectionType,
        description: 'Agent input'
      },
      {
        name: 'skill',
        displayName: 'Skill',
        type: 'main' as NodeConnectionType,
        description: 'Skill nodes that provide context and instructions via SKILL.md'
      },
      {
        name: 'memory',
        displayName: 'Memory',
        type: 'main' as NodeConnectionType,
        description: 'Memory node for conversation history'
      },
      {
        name: 'tools',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Tool nodes (httpRequest, etc.) for LangGraph tool calling'
      },
      {
        name: 'task',
        displayName: 'Task',
        type: 'main' as NodeConnectionType,
        description: 'Task completion events from taskTrigger'
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
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        default: '',
        typeOptions: { rows: 4 },
        description: 'The message to send to the AI. Use {{chatTrigger.message}} or leave empty to auto-use connected node output.',
        placeholder: '{{chatTrigger.message}}'
      },
      {
        displayName: 'System Message',
        name: 'systemMessage',
        type: 'string',
        default: 'You are a helpful assistant.',
        typeOptions: { rows: 3 },
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

  // Simple Memory Node - conversation history storage for AI agents
  // Markdown-based memory visible and editable in UI
  simpleMemory: {
    displayName: 'Simple Memory',
    name: 'simpleMemory',
    icon: '🧠',
    group: ['skill', 'memory'],  // 'skill' = appears in AI Skills category
    version: 1,
    description: 'Markdown-based conversation memory with optional vector DB for long-term retrieval',
    defaults: { name: 'Memory', color: '#8b5cf6' },
    inputs: [],  // No input - memory node is passive
    outputs: [{
      name: 'memory',
      displayName: 'Memory',
      type: 'main' as NodeConnectionType,
      description: 'session_id, messages, message_count'
    }],
    properties: [
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        description: 'Unique identifier for conversation session'
      },
      {
        displayName: 'Window Size',
        name: 'windowSize',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Number of message pairs to keep in short-term memory'
      },
      {
        displayName: 'Conversation History',
        name: 'memoryContent',
        type: 'string',
        default: '# Conversation History\n\n*No messages yet.*\n',
        typeOptions: {
          rows: 15,
          editor: 'code',
          editorLanguage: 'markdown'
        },
        description: 'Recent conversation history (editable)'
      },
      {
        displayName: 'Enable Long-Term Memory',
        name: 'longTermEnabled',
        type: 'boolean',
        default: false,
        description: 'Archive old messages to vector DB for semantic retrieval'
      },
      {
        displayName: 'Retrieval Count',
        name: 'retrievalCount',
        type: 'number',
        default: 3,
        typeOptions: { minValue: 1, maxValue: 10 },
        description: 'Number of relevant memories to retrieve from long-term storage',
        displayOptions: {
          show: {
            longTermEnabled: [true]
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