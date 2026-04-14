// Browser Automation Node - Interactive browser control via agent-browser CLI
// Dual-purpose node: works as standalone workflow node AND AI Agent tool

import {
  INodeTypeDescription,
  NodeConnectionType,
} from '../types/INodeProperties';
import { dracula } from '../styles/theme';
import { BROWSER_ICON } from '../assets/icons/browser';

export const browserNodes: Record<string, INodeTypeDescription> = {
  browser: {
    displayName: 'Browser',
    name: 'browser',
    icon: BROWSER_ICON,
    group: ['browser', 'tool'],
    version: 1,
    subtitle: 'Agent Browser',
    description: 'Interactive browser automation via agent-browser. Navigate, click, type, fill forms, take screenshots, get accessibility snapshots, and execute JavaScript.',
    defaults: { name: 'Browser', color: dracula.cyan },
    inputs: [
      {
        name: 'main',
        displayName: 'Input',
        type: 'main' as NodeConnectionType,
        description: 'Input data',
      },
    ],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Browser operation result',
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle',
      },
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },
};

export const BROWSER_NODE_TYPES = ['browser'];
