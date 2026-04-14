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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // Simple Memory Node - conversation history storage for AI agents
  // Markdown-based memory visible and editable in UI
  simpleMemory: {
    displayName: 'Simple Memory',
    name: 'simpleMemory',
    icon: '🧠',
    group: ['tool', 'memory'],  // 'tool' = appears in AI Tools category
    version: 1,
    description: 'Markdown-based conversation memory with optional vector DB for long-term retrieval',
    defaults: { name: 'Memory', color: '#8b5cf6' },
    uiHints: { isMemoryPanel: true, hasCodeEditor: true, hideRunButton: true },
    inputs: [],  // No input - memory node is passive
    outputs: [{
      name: 'memory',
      displayName: 'Memory',
      type: 'main' as NodeConnectionType,
      description: 'session_id, messages, message_count'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// List of AI-related node types for easy identification (chat models removed - now in aiModelNodes.ts)
export const AI_NODE_TYPES = ['aiAgent', 'chatAgent', 'simpleMemory'];
