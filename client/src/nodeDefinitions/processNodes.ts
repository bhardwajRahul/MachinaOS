// Process Manager Node -- start, stop, and manage long-running processes
// Dual-purpose: workflow node AND AI Agent tool

import {
  INodeTypeDescription,
  NodeConnectionType,
} from '../types/INodeProperties';
import { dracula } from '../styles/theme';

export const processNodes: Record<string, INodeTypeDescription> = {
  processManager: {
    displayName: 'Process Manager',
    name: 'processManager',
    icon: '\u{2699}\u{FE0F}',
    group: ['utility', 'tool'],
    version: 1,
    subtitle: 'Manage Processes',
    description: 'Start, stop, and manage long-running processes (dev servers, watchers, build tools). Streams output to Terminal tab.',
    defaults: { name: 'Process Manager', color: dracula.orange },
    inputs: [
      { name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' },
    ],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Process operation result' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    properties: [
      // Tool config
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'process_manager',
        description: 'Name of this tool when used by AI Agent',
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Start, stop, and manage long-running processes. Use for dev servers, watchers, build tools. Output streams to Terminal.',
        typeOptions: { rows: 2 },
        description: 'Description shown to AI Agent',
      },

      // Operation
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: 'start',
        options: [
          { name: 'Start', value: 'start', description: 'Start a new process' },
          { name: 'Stop', value: 'stop', description: 'Stop a running process' },
          { name: 'Restart', value: 'restart', description: 'Restart a process' },
          { name: 'Send Input', value: 'send_input', description: 'Send text to process stdin' },
          { name: 'List', value: 'list', description: 'List running processes' },
          { name: 'Get Output', value: 'get_output', description: 'Get buffered output history' },
        ],
        description: 'Process operation to perform',
      },

      // Conditional parameters
      {
        displayName: 'Process Name',
        name: 'name',
        type: 'string',
        default: '',
        placeholder: 'my-server',
        description: 'Unique name for this process',
        displayOptions: { show: { operation: ['start', 'stop', 'restart', 'send_input', 'get_output'] } },
      },
      {
        displayName: 'Command',
        name: 'command',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'python -m http.server 8080',
        description: 'Shell command to run as a long-lived process',
        displayOptions: { show: { operation: ['start'] } },
      },
      {
        displayName: 'Working Directory',
        name: 'working_directory',
        type: 'string',
        default: '',
        placeholder: 'Uses workflow workspace if empty',
        description: 'Working directory for the process',
        displayOptions: { show: { operation: ['start'] } },
      },
      {
        displayName: 'Input Text',
        name: 'text',
        type: 'string',
        default: '',
        placeholder: 'Text to send to stdin',
        description: 'Text to write to the process stdin (newline appended automatically)',
        displayOptions: { show: { operation: ['send_input'] } },
      },
    ],
  },
};

export const PROCESS_NODE_TYPES = ['processManager'];
