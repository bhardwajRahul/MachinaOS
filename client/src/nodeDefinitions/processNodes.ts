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
    // Wave 8: parameter schema lives on the backend (ProcessManagerParams).
    // Local placeholders retained via the per-property merge in
    // lib/nodeSpec.ts.
    properties: [
      { displayName: 'Process Name', name: 'name', type: 'string', default: '', placeholder: 'my-server' },
      { displayName: 'Command', name: 'command', type: 'string', default: '', placeholder: 'python -m http.server 8080' },
      { displayName: 'Working Directory', name: 'cwd', type: 'string', default: '', placeholder: 'Uses workflow workspace if empty' },
      { displayName: 'Input Text', name: 'input', type: 'string', default: '', placeholder: 'Text to send to stdin' },
    ],
  },
};

export const PROCESS_NODE_TYPES = ['processManager'];
