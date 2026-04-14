// Code Execution Nodes
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const codeNodes: Record<string, INodeTypeDescription> = {
  pythonExecutor: {
    displayName: 'Python Executor',
    name: 'pythonExecutor',
    group: ['code', 'tool'],
    version: 1,
    subtitle: 'Run Python Code',
    description: 'Execute Python code with input data access',
    defaults: { name: 'Python Executor', color: '#3776AB' },
    uiHints: { hasCodeEditor: true },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data as input_data variable' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Python execution result' }],
    // Wave 8: schema lives on backend (PythonExecutorParams).
    // Starter code preserved via per-property merge.
    properties: [
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '# Python Executor - Transform and process data\n#\n# Available:\n#   input_data - dict with connected node outputs\n#   math, json - imported modules\n#   print() - for debugging\n#\n# Set the "output" variable with your result\n\n# Example: Get data from connected node\ndata = input_data.get("start", {}) or input_data\n\n# Process data\nresult = {\n    "message": "Hello from Python!",\n    "input_received": data,\n    "processed": True\n}\n\n# Set output (required)\noutput = result',
        typeOptions: { rows: 5, editor: 'code', editorLanguage: 'python' },
        placeholder: '# Write your Python code here...',
      },
    ],
  },

  javascriptExecutor: {
    displayName: 'JavaScript Executor',
    name: 'javascriptExecutor',
    group: ['code', 'tool'],
    version: 1,
    subtitle: 'Run JavaScript Code',
    description: 'Execute JavaScript code with input data access',
    defaults: { name: 'JavaScript Executor', color: '#F7DF1E' },
    uiHints: { hasCodeEditor: true },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data as input_data variable' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'JavaScript execution result' }],
    // Wave 8: schema lives on backend (JavaScriptExecutorParams).
    properties: [
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '// JavaScript Executor - Transform and process data\n//\n// Available:\n//   input_data - object with connected node outputs\n//   console.log() - for debugging\n//\n// Set the "output" variable with your result\n\n// Example: Get data from connected node\nconst data = input_data?.start || input_data || {};\n\n// Process data\nconst result = {\n    message: "Hello from JavaScript!",\n    input_received: data,\n    processed: true\n};\n\n// Set output (required)\noutput = result;',
        typeOptions: { rows: 5, editor: 'code', editorLanguage: 'javascript' },
        placeholder: '// Write your JavaScript code here...',
      },
    ],
  },

  typescriptExecutor: {
    displayName: 'TypeScript Executor',
    name: 'typescriptExecutor',
    group: ['code', 'tool'],
    version: 1,
    subtitle: 'Run TypeScript Code',
    description: 'Execute TypeScript code with input data access and type safety',
    defaults: { name: 'TypeScript Executor', color: '#3178C6' },
    uiHints: { hasCodeEditor: true },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data as input_data variable' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'TypeScript execution result' }],
    // Wave 8: schema lives on backend (TypeScriptExecutorParams).
    properties: [
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '// TypeScript Executor - Transform and process data with type safety\n//\n// Available:\n//   input_data - object with connected node outputs\n//   console.log() - for debugging\n//\n// Set the "output" variable with your result\n\ninterface Result {\n    message: string;\n    input_received: unknown;\n    processed: boolean;\n}\n\n// Example: Get data from connected node\nconst data = input_data?.start || input_data || {};\n\n// Process data with type safety\nconst result: Result = {\n    message: "Hello from TypeScript!",\n    input_received: data,\n    processed: true\n};\n\n// Set output (required)\noutput = result;',
        typeOptions: { rows: 5, editor: 'code', editorLanguage: 'typescript' },
        placeholder: '// Write your TypeScript code here...',
      },
    ],
  },
};

export const CODE_NODE_TYPES = ['pythonExecutor', 'javascriptExecutor', 'typescriptExecutor'];
