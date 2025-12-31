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
  }
};

export const WORKFLOW_NODE_TYPES = ['start'];
