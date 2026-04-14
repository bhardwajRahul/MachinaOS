// Filesystem & Shell Tool Nodes - Dual-purpose (workflow node + AI agent tool)
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const filesystemNodes: Record<string, INodeTypeDescription> = {
  fileRead: {
    displayName: 'File Read',
    name: 'fileRead',
    icon: '\u{1F4C4}',
    group: ['utility', 'tool'],
    version: 1,
    subtitle: 'Read File',
    description: 'Read file contents with line numbers and pagination. Works as workflow node or AI agent tool.',
    defaults: { name: 'File Read', color: '#8be9fd' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' }],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'File contents' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    // Wave 8: schema lives on backend (FileReadParams).
    properties: [],
  },

  fileModify: {
    displayName: 'File Modify',
    name: 'fileModify',
    icon: '\u{270F}\u{FE0F}',
    group: ['utility', 'tool'],
    version: 1,
    subtitle: 'Write / Edit File',
    description: 'Write a new file or edit an existing file with string replacement. Works as workflow node or AI agent tool.',
    defaults: { name: 'File Modify', color: '#50fa7b' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' }],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Operation result' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    // Wave 8: schema lives on backend (FileModifyParams).
    properties: [],
  },

  shell: {
    displayName: 'Shell',
    name: 'shell',
    icon: '\u{1F4BB}',
    group: ['utility', 'tool'],
    version: 1,
    subtitle: 'Execute Command',
    description: 'Execute shell commands and return stdout, stderr, and exit code. Works as workflow node or AI agent tool.',
    defaults: { name: 'Shell', color: '#ff79c6' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' }],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Command output' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    // Wave 8: schema lives on backend (ShellParams).
    properties: [],
  },

  fsSearch: {
    displayName: 'FS Search',
    name: 'fsSearch',
    icon: '\u{1F50D}',
    group: ['utility', 'tool'],
    version: 1,
    subtitle: 'List / Glob / Grep',
    description: 'Search the filesystem: list directories, glob pattern match, or grep file contents. Works as workflow node or AI agent tool.',
    defaults: { name: 'FS Search', color: '#f1fa8c' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' }],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Search results' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    // Wave 8: schema lives on backend (FsSearchParams).
    properties: [],
  },
};

export const FILESYSTEM_NODE_TYPES = ['fileRead', 'fileModify', 'shell', 'fsSearch'];
