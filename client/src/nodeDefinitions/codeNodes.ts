// Code Execution Nodes
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const codeNodes: Record<string, INodeTypeDescription> = {
  pythonExecutor: {
    displayName: 'Python Executor',
    name: 'pythonExecutor',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    group: ['code', 'tool'],
    version: 1,
    subtitle: 'Run Python Code',
    description: 'Execute Python code with input data access',
    defaults: { name: 'Python Executor', color: '#3776AB' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data as input_data variable' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Python execution result' }],
    properties: [
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '# Python Executor - Transform and process data\n#\n# Available:\n#   input_data - dict with connected node outputs\n#   math, json - imported modules\n#   print() - for debugging\n#\n# Set the "output" variable with your result\n\n# Example: Get data from connected node\ndata = input_data.get("start", {}) or input_data\n\n# Process data\nresult = {\n    "message": "Hello from Python!",\n    "input_received": data,\n    "processed": True\n}\n\n# Set output (required)\noutput = result',
        required: true,
        typeOptions: { rows: 5, editor: 'code', editorLanguage: 'python' },
        placeholder: '# Write your Python code here...'
      }
    ]
  },

  javascriptExecutor: {
    displayName: 'JavaScript Executor',
    name: 'javascriptExecutor',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    group: ['code', 'tool'],
    version: 1,
    subtitle: 'Run JavaScript Code',
    description: 'Execute JavaScript code with input data access',
    defaults: { name: 'JavaScript Executor', color: '#F7DF1E' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data as input_data variable' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'JavaScript execution result' }],
    properties: [
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '// JavaScript Executor - Transform and process data\n//\n// Available:\n//   input_data - object with connected node outputs\n//   console.log() - for debugging\n//\n// Set the "output" variable with your result\n\n// Example: Get data from connected node\nconst data = input_data?.start || input_data || {};\n\n// Process data\nconst result = {\n    message: "Hello from JavaScript!",\n    input_received: data,\n    processed: true\n};\n\n// Set output (required)\noutput = result;',
        required: true,
        typeOptions: { rows: 5, editor: 'code', editorLanguage: 'javascript' },
        placeholder: '// Write your JavaScript code here...'
      }
    ]
  }
};

export const CODE_NODE_TYPES = ['pythonExecutor', 'javascriptExecutor'];
