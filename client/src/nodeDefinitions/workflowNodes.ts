// Workflow Control Nodes - Start, triggers, and flow control
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

export const workflowNodes: Record<string, INodeTypeDescription> = {
  // Start Node - Entry point for workflows
  start: {
    displayName: 'Start',
    name: 'start',
    icon: '▶',
    group: ['workflow'],
    version: 1,
    subtitle: 'Workflow Entry',
    description: 'Starting point for workflow execution. Provides initial data to connected nodes.',
    defaults: { name: 'Start', color: '#8be9fd' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Workflow start output'
    }],
    properties: [
      {
        displayName: 'Initial Data',
        name: 'initialData',
        type: 'string',
        default: '{}',
        typeOptions: {
          rows: 6
        },
        description: 'JSON data to pass to connected nodes',
        placeholder: '{\n  "message": "Hello World",\n  "value": 123\n}'
      }
    ]
  },

  // Task Trigger - Event-driven trigger for child agent completion
  taskTrigger: {
    displayName: 'Task Completed',
    name: 'taskTrigger',
    icon: '📨',
    group: ['trigger', 'workflow'],
    version: 1,
    subtitle: 'Child Agent Completed',
    description: 'Triggers when a delegated child agent completes its task (success or error)',
    defaults: { name: 'Task Completed', color: '#bd93f9' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'task_id, status, agent_name, result/error, parent_node_id'
    }],
    properties: [
      {
        displayName: 'Task ID Filter',
        name: 'task_id',
        type: 'string',
        default: '',
        description: 'Optional: Only trigger for specific task ID'
      },
      {
        displayName: 'Agent Name Filter',
        name: 'agent_name',
        type: 'string',
        default: '',
        description: 'Optional: Only trigger for agents containing this name'
      },
      {
        displayName: 'Status Filter',
        name: 'status_filter',
        type: 'options',
        default: 'all',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Completed Only', value: 'completed' },
          { name: 'Errors Only', value: 'error' }
        ],
        description: 'Filter by completion status'
      },
      {
        displayName: 'Parent Node ID',
        name: 'parent_node_id',
        type: 'string',
        default: '',
        description: 'Optional: Only trigger for delegations from specific parent agent'
      }
    ]
  }
};

export const WORKFLOW_NODE_TYPES = ['start', 'taskTrigger'];
