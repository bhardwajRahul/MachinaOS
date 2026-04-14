// Tool Node Definitions - Tool nodes for AI Agent tool calling
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// ============================================================================
// TOOL NODES - Connect to AI Agent's input-tools handle
// ============================================================================

export const toolNodes: Record<string, INodeTypeDescription> = {
  // Calculator Tool - allows AI Agent to perform mathematical calculations
  calculatorTool: {
    displayName: 'Calculator Tool',
    name: 'calculatorTool',
    group: ['tool', 'ai'],
    version: 1,
    subtitle: 'Math Operations',
    description: 'Allow AI Agent to perform mathematical calculations',
    defaults: { name: 'Calculator', color: '#50fa7b' },
    inputs: [],  // No input - tool node is passive
    outputs: [{
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // Current Time Tool - allows AI Agent to get current date and time
  currentTimeTool: {
    displayName: 'Current Time Tool',
    name: 'currentTimeTool',
    group: ['tool', 'ai'],
    version: 1,
    subtitle: 'Date & Time',
    description: 'Allow AI Agent to get current date and time',
    defaults: { name: 'Current Time', color: '#ffb86c' },
    inputs: [],
    outputs: [{
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // DuckDuckGo Search Tool - allows AI Agent to search the web (free, no API key)
  duckduckgoSearch: {
    displayName: 'DuckDuckGo Search',
    name: 'duckduckgoSearch',
    group: ['tool', 'ai'],
    version: 1,
    subtitle: 'Free Web Search',
    description: 'Allow AI Agent to search the web for free via DuckDuckGo (no API key required)',
    defaults: { name: 'DuckDuckGo', color: '#DE5833' },
    inputs: [],
    outputs: [{
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // Task Manager Tool - allows AI Agent to track and manage delegated tasks
  taskManager: {
    displayName: 'Task Manager',
    name: 'taskManager',
    group: ['tool', 'ai'],
    version: 1,
    subtitle: 'Track Delegated Tasks',
    description: 'Manage and track delegated sub-agent tasks. Works as AI tool OR standalone workflow node.',
    defaults: { name: 'Task Manager', color: '#8B5CF6' },
    inputs: [],
    outputs: [
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      },
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Task list output for workflow use'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // Write Todos Tool - allows AI Agent to plan and track complex multi-step tasks
  writeTodos: {
    displayName: 'Write Todos',
    name: 'writeTodos',
    group: ['tool', 'ai'],
    version: 1,
    subtitle: 'Task Planning',
    description: 'Create and manage a structured task list for complex multi-step operations. Works as AI tool OR standalone workflow node.',
    defaults: { name: 'Write Todos', color: '#bd93f9' },
    inputs: [],
    outputs: [
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      },
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Todo list output for workflow use'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// List of tool node types for identification
export const TOOL_NODE_TYPES = ['calculatorTool', 'currentTimeTool', 'duckduckgoSearch', 'taskManager', 'writeTodos'];
