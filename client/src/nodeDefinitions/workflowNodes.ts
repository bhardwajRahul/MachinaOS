// Workflow Control Nodes - Start, triggers, and flow control
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const workflowNodes: Record<string, INodeTypeDescription> = {
  // Start Node - Entry point for workflows
  start: {
    displayName: 'Start',
    name: 'start',
    group: ['workflow'],
    version: 1,
    subtitle: 'Workflow Entry',
    description: 'Starting point for workflow execution. Provides initial data to connected nodes.',
    defaults: { name: 'Start', color: '#8be9fd' },
    uiHints: { hideInputSection: true, hideOutputSection: true },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Workflow start output'
    }],
    // Wave 8: properties retain the non-empty `default` placeholder
    // blob which the merge in lib/nodeSpec.ts preserves over the
    // backend's "{}"  default. Everything else (type, rows,
    // description) now comes from StartNodeParams.
    properties: [
      {
        displayName: 'Initial Data',
        name: 'initialData',
        type: 'string',
        default: '{}',
        placeholder: '{\n  "message": "Hello World",\n  "value": 123\n}',
      },
    ],
  },

  // Task Trigger - Event-driven trigger for child agent completion
  taskTrigger: {
    displayName: 'Task Completed',
    name: 'taskTrigger',
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
    // Wave 8: parameter schema lives on the backend (TaskTriggerParams).
    properties: [],
  },
};

export const WORKFLOW_NODE_TYPES = ['start', 'taskTrigger'];
