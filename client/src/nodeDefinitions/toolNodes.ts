// Tool Node Definitions - Tool nodes for AI Agent tool calling
import {
  INodeTypeDescription,
  NodeConnectionType,
} from '../types/INodeProperties';

// ============================================================================
// TOOL NODES - Connect to AI Agent's input-tools handle
// ============================================================================

export const toolNodes: Record<string, INodeTypeDescription> = {
  // Calculator Tool - allows AI Agent to perform mathematical calculations
  calculatorTool: {
    displayName: 'Calculator Tool',
    name: 'calculatorTool',
    icon: '🔢',
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
    properties: [
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'calculator',
        required: true,
        description: 'Name the AI will use to call this tool'
      },
      {
        displayName: 'Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Perform mathematical calculations. Operations: add, subtract, multiply, divide, power, sqrt, mod, abs',
        typeOptions: { rows: 2 },
        description: 'Describe the tool capabilities for the AI'
      }
    ]
  },

  // Current Time Tool - allows AI Agent to get current date and time
  currentTimeTool: {
    displayName: 'Current Time Tool',
    name: 'currentTimeTool',
    icon: '🕐',
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
    properties: [
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'get_current_time',
        required: true,
        description: 'Name the AI will use to call this tool'
      },
      {
        displayName: 'Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Get the current date and time. Optionally specify timezone.',
        typeOptions: { rows: 2 },
        description: 'Describe the tool capabilities for the AI'
      },
      {
        displayName: 'Default Timezone',
        name: 'timezone',
        type: 'string',
        default: 'UTC',
        placeholder: 'America/New_York',
        description: 'Default timezone (e.g., UTC, America/New_York, Europe/London)'
      }
    ]
  },

  // Web Search Tool - allows AI Agent to search the web
  webSearchTool: {
    displayName: 'Web Search Tool',
    name: 'webSearchTool',
    icon: '🔍',
    group: ['tool', 'ai'],
    version: 1,
    subtitle: 'Web Search',
    description: 'Allow AI Agent to search the web for information',
    defaults: { name: 'Web Search', color: '#bd93f9' },
    inputs: [],
    outputs: [{
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }],
    properties: [
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'web_search',
        required: true,
        description: 'Name the AI will use to call this tool'
      },
      {
        displayName: 'Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Search the web for information. Returns relevant search results.',
        typeOptions: { rows: 2 },
        description: 'Describe the tool capabilities for the AI'
      },
      {
        displayName: 'Search Provider',
        name: 'provider',
        type: 'options',
        options: [
          { name: 'DuckDuckGo (Free)', value: 'duckduckgo' },
          { name: 'Serper API', value: 'serper' },
          { name: 'Google Custom Search', value: 'google' }
        ],
        default: 'duckduckgo',
        description: 'Search provider to use'
      },
      {
        displayName: 'API Key',
        name: 'apiKey',
        type: 'string',
        default: '',
        description: 'API key for Serper or Google (not needed for DuckDuckGo)',
        displayOptions: {
          show: {
            provider: ['serper', 'google']
          }
        }
      },
      {
        displayName: 'Max Results',
        name: 'maxResults',
        type: 'number',
        default: 5,
        typeOptions: { minValue: 1, maxValue: 10 },
        description: 'Maximum number of results to return'
      }
    ]
  },

  // Task Manager Tool - allows AI Agent to track and manage delegated tasks
  taskManager: {
    displayName: 'Task Manager',
    name: 'taskManager',
    icon: '📋',
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
    properties: [
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'task_manager',
        description: 'Name visible to the AI agent'
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Manage delegated tasks - list active/completed tasks, check task status, mark tasks done',
        typeOptions: { rows: 2 },
        description: 'Description for the AI agent'
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          { name: 'List Tasks', value: 'list_tasks' },
          { name: 'Get Task', value: 'get_task' },
          { name: 'Mark Done', value: 'mark_done' }
        ],
        default: 'list_tasks',
        description: 'Operation to perform when run as workflow node'
      },
      {
        displayName: 'Task ID',
        name: 'task_id',
        type: 'string',
        default: '',
        description: 'Task ID for get_task/mark_done operations',
        displayOptions: {
          show: {
            operation: ['get_task', 'mark_done']
          }
        }
      },
      {
        displayName: 'Status Filter',
        name: 'status_filter',
        type: 'options',
        options: [
          { name: 'All', value: '' },
          { name: 'Running', value: 'running' },
          { name: 'Completed', value: 'completed' },
          { name: 'Error', value: 'error' }
        ],
        default: '',
        description: 'Filter tasks by status',
        displayOptions: {
          show: {
            operation: ['list_tasks']
          }
        }
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// List of tool node types for identification
export const TOOL_NODE_TYPES = ['calculatorTool', 'currentTimeTool', 'webSearchTool', 'taskManager'];
