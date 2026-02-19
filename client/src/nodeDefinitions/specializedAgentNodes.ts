// Specialized Agent Node Definitions - AI Agents with specialized capabilities
import {
  INodeTypeDescription,
  NodeConnectionType,
  INodeProperties
} from '../types/INodeProperties';
import { dracula } from '../styles/theme';

// ============================================================================
// SHARED AI AGENT INPUTS - Used by Specialized Agent Nodes
// ============================================================================

// Inputs shared by AI Agent and all Specialized Agent nodes
export const AI_AGENT_INPUTS = [
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
];

// Outputs shared by AI Agent and all Specialized Agent nodes
export const AI_AGENT_OUTPUTS = [
  {
    name: 'main',
    displayName: 'Output',
    type: 'main' as NodeConnectionType,
    description: 'Agent output'
  }
];

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
      { name: 'OpenRouter', value: 'openrouter' },
      { name: 'Cerebras', value: 'cerebras' }
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
        default: 4096,
        typeOptions: { minValue: 1, maxValue: 128000 },
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
    defaults: { name: 'Android Control Agent', color: dracula.green },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
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
    defaults: { name: 'Coding Agent', color: dracula.cyan },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
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
    defaults: { name: 'Web Control Agent', color: dracula.pink },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
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
    defaults: { name: 'Task Management Agent', color: dracula.purple },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
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
    defaults: { name: 'Social Media Agent', color: dracula.green },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Travel Agent - AI Agent with travel planning capabilities
  travel_agent: {
    displayName: 'Travel Agent',
    name: 'travel_agent',
    icon: '✈️',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Travel Planning',
    description: 'AI Agent specialized for travel planning. Connect skills, memory, and tool nodes to enable itinerary building, location lookups, and travel recommendations.',
    defaults: { name: 'Travel Agent', color: dracula.orange },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Tool Agent - AI Agent for orchestrating multiple tools
  tool_agent: {
    displayName: 'Tool Agent',
    name: 'tool_agent',
    icon: '🔧',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Tool Orchestration',
    description: 'AI Agent specialized for tool orchestration. Connect skills, memory, and multiple tool nodes to enable multi-tool workflows and complex task execution.',
    defaults: { name: 'Tool Agent', color: dracula.yellow },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Productivity Agent - AI Agent for productivity and time management
  productivity_agent: {
    displayName: 'Productivity Agent',
    name: 'productivity_agent',
    icon: '⏰',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Productivity',
    description: 'AI Agent specialized for productivity. Connect skills, memory, and tool nodes to enable scheduling, reminders, note-taking, and workflow automation.',
    defaults: { name: 'Productivity Agent', color: dracula.cyan },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Payments Agent - AI Agent for payment processing and financial operations
  payments_agent: {
    displayName: 'Payments Agent',
    name: 'payments_agent',
    icon: '💳',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Payment Processing',
    description: 'AI Agent specialized for payment processing. Connect skills, memory, and tool nodes to enable payment workflows, invoice generation, and financial operations.',
    defaults: { name: 'Payments Agent', color: dracula.green },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Consumer Agent - AI Agent for consumer interactions and support
  consumer_agent: {
    displayName: 'Consumer Agent',
    name: 'consumer_agent',
    icon: '🛒',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Consumer Support',
    description: 'AI Agent specialized for consumer interactions. Connect skills, memory, and tool nodes to enable customer support, product recommendations, and order management.',
    defaults: { name: 'Consumer Agent', color: dracula.purple },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Autonomous Agent - AI Agent for autonomous operations with Code Mode patterns
  autonomous_agent: {
    displayName: 'Autonomous Agent',
    name: 'autonomous_agent',
    icon: '🎯',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Autonomous Operations',
    description: 'AI Agent specialized for autonomous operations. Uses Code Mode patterns (81-98% token savings), agentic loops, progressive discovery, error recovery, and multi-tool orchestration.',
    defaults: { name: 'Autonomous Agent', color: dracula.purple },
    inputs: AI_AGENT_INPUTS,
    outputs: AI_AGENT_OUTPUTS,
    properties: AI_AGENT_PROPERTIES
  },

  // Orchestrator Agent - Coordinates multiple agents for complex workflows
  orchestrator_agent: {
    displayName: 'Orchestrator Agent',
    name: 'orchestrator_agent',
    icon: '🎼',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Agent Coordination',
    description: 'AI Agent specialized for orchestrating multiple agents. Coordinates complex multi-agent workflows by delegating tasks to specialized agents and synthesizing their results.',
    defaults: { name: 'Orchestrator Agent', color: dracula.cyan },
    inputs: [
      ...AI_AGENT_INPUTS,
      { name: 'teammates', displayName: 'Team', type: 'main' as NodeConnectionType, description: 'Connect teammate agents for team mode' }
    ],
    outputs: AI_AGENT_OUTPUTS,
    properties: [
      ...AI_AGENT_PROPERTIES,
      {
        displayName: 'Team Mode',
        name: 'teamMode',
        type: 'options',
        options: [
          { name: 'Disabled', value: '' },
          { name: 'Parallel', value: 'parallel' },
          { name: 'Sequential', value: 'sequential' }
        ],
        default: '',
        description: 'Enable team mode to coordinate connected teammate agents'
      }
    ]
  },

  // AI Employee - Team lead node for coordinating multiple agents
  ai_employee: {
    displayName: 'AI Employee',
    name: 'ai_employee',
    icon: '👥',
    group: ['agent', 'ai'],
    version: 1,
    subtitle: 'Team Orchestration',
    description: 'AI Employee for coordinating multiple AI agents. Connect teammate agents to enable shared task lists, messaging, and coordinated execution.',
    defaults: { name: 'AI Employee', color: dracula.purple },
    inputs: [
      ...AI_AGENT_INPUTS,
      { name: 'teammates', displayName: 'Team', type: 'main' as NodeConnectionType, description: 'Connect teammate agents' }
    ],
    outputs: AI_AGENT_OUTPUTS,
    properties: [
      ...AI_AGENT_PROPERTIES,
      {
        displayName: 'Team Mode',
        name: 'teamMode',
        type: 'options',
        options: [
          { name: 'Parallel', value: 'parallel' },
          { name: 'Sequential', value: 'sequential' }
        ],
        default: 'parallel',
        description: 'How teammates process tasks'
      },
      {
        displayName: 'Max Concurrent',
        name: 'maxConcurrent',
        type: 'number',
        default: 5,
        typeOptions: { minValue: 1, maxValue: 20 },
        description: 'Maximum concurrent task executions'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// List of specialized agent node types for identification
export const SPECIALIZED_AGENT_TYPES = ['android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent', 'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent', 'autonomous_agent', 'orchestrator_agent', 'ai_employee'];
