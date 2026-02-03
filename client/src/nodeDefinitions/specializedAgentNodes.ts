// Specialized Agent Node Definitions - AI Agents with specialized capabilities
import {
  INodeTypeDescription,
  NodeConnectionType,
  INodeProperties
} from '../types/INodeProperties';

// ============================================================================
// SHARED AI AGENT PROPERTIES - Used by Specialized Agent Nodes
// ============================================================================

// Properties shared by AI Agent and all Specialized Agent nodes
export const AI_AGENT_PROPERTIES: INodeProperties[] = [
  {
    displayName: 'AI Provider',
    name: 'provider',
    type: 'options',
    options: [
      { name: 'OpenAI', value: 'openai' },
      { name: 'Anthropic (Claude)', value: 'anthropic' },
      { name: 'Google (Gemini)', value: 'gemini' },
      { name: 'Groq', value: 'groq' },
      { name: 'OpenRouter', value: 'openrouter' }
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
    typeOptions: { rows: 4 },
    description: 'The prompt template for the AI agent',
    placeholder: 'Enter your prompt or use template variables...'
  },
  {
    displayName: 'System Message',
    name: 'systemMessage',
    type: 'string',
    default: 'You are a helpful assistant',
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
        description: 'Enable extended thinking for supported providers'
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
];

// ============================================================================
// SPECIALIZED AGENT NODES - AI Agents with domain-specific capabilities
// ============================================================================

export const specializedAgentNodes: Record<string, INodeTypeDescription> = {
  // Android Control Agent - AI Agent with Android device control capabilities
  android_agent: {
    displayName: 'Android Control Agent',
    name: 'android_agent',
    icon: '📱',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Device Control',
    description: 'AI Agent specialized for Android device control. Connect skills, memory, and tool nodes to enable Android automation capabilities.',
    defaults: { name: 'Android Control Agent', color: '#3DDC84' },
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
        description: 'Tool nodes for Android device operations'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Agent output'
    }],
    properties: AI_AGENT_PROPERTIES
  },

  // Coding Agent - AI Agent with code execution capabilities
  coding_agent: {
    displayName: 'Coding Agent',
    name: 'coding_agent',
    icon: '💻',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Code Execution',
    description: 'AI Agent specialized for code execution. Connect skills, memory, and code executor nodes to enable coding capabilities.',
    defaults: { name: 'Coding Agent', color: '#61DAFB' },
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
        description: 'Code executor nodes (Python, JavaScript, etc.)'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Agent output'
    }],
    properties: AI_AGENT_PROPERTIES
  },

  // Web Control Agent - AI Agent with web automation capabilities
  web_agent: {
    displayName: 'Web Control Agent',
    name: 'web_agent',
    icon: '🌐',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Browser Automation',
    description: 'AI Agent specialized for web automation. Connect skills, memory, and web control nodes to enable browser automation and HTTP capabilities.',
    defaults: { name: 'Web Control Agent', color: '#FF6B6B' },
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
        description: 'Web control nodes (browser, scraper, HTTP, etc.)'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Agent output'
    }],
    properties: AI_AGENT_PROPERTIES
  },

  // Task Management Agent - AI Agent with task automation capabilities
  task_agent: {
    displayName: 'Task Management Agent',
    name: 'task_agent',
    icon: '📋',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Task Automation',
    description: 'AI Agent specialized for task management. Connect skills, memory, and task nodes to enable scheduling and reminder capabilities.',
    defaults: { name: 'Task Management Agent', color: '#9B59B6' },
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
        description: 'Task management nodes (scheduler, reminders, etc.)'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Agent output'
    }],
    properties: AI_AGENT_PROPERTIES
  },

  // Social Media Agent - AI Agent with social messaging capabilities
  social_agent: {
    displayName: 'Social Media Agent',
    name: 'social_agent',
    icon: '📱',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Social Messaging',
    description: 'AI Agent specialized for social media. Connect skills, memory, and messaging nodes to enable WhatsApp, Telegram, and other social capabilities.',
    defaults: { name: 'Social Media Agent', color: '#25D366' },
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
        description: 'Social media nodes (WhatsApp, Telegram, etc.)'
      }
    ],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Agent output'
    }],
    properties: AI_AGENT_PROPERTIES
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// List of specialized agent node types for identification
export const SPECIALIZED_AGENT_TYPES = ['android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent'];
