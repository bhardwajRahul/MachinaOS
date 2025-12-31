// Base Chat Model Factory - Standardized node definition generator
import {
  INodeTypeDescription,
  NodeConnectionType,
  INodeProperties
} from '../types/INodeProperties';

// ============================================================================
// BASE CHAT MODEL CONFIGURATION INTERFACE
// ============================================================================

export interface ChatModelConfig {
  providerId: string;
  displayName: string;
  icon: string;
  color: string;
  description: string;
  nodeName?: string;
  models: Array<{
    name: string;
    value: string;
    maxTokens?: number;
  }>;
  parameters: INodeProperties[];
}

// ============================================================================
// BASE CHAT MODEL FACTORY FUNCTION
// ============================================================================

export function createBaseChatModel(config: ChatModelConfig): INodeTypeDescription {
  return {
    displayName: `${config.displayName} Chat Model`,
    name: config.nodeName || `${config.providerId}ChatModel`,
    icon: config.icon,
    group: ['ai', 'model'],
    version: 1,
    subtitle: '={{$parameter["model"]}}',
    description: config.description,
    defaults: {
      name: `${config.displayName} Chat Model`,
      color: config.color
    },
    inputs: [{
      name: 'prompt',
      displayName: 'Prompt',
      type: 'string' as NodeConnectionType,
      description: 'Input prompt or message for the AI model',
      required: false
    }],
    outputs: [{
      name: 'model',
      displayName: 'Model',
      type: 'ai' as NodeConnectionType,
      description: `${config.displayName} configuration for AI agents`,
      dataStructure: {
        properties: {
          provider: {
            type: 'string',
            description: `Model provider (${config.providerId})`,
            required: true
          },
          model: {
            type: 'string',
            description: 'Model name',
            required: true
          },
          apiKey: {
            type: 'string',
            description: `${config.displayName} API key`,
            required: true
          },
          temperature: {
            type: 'number',
            description: 'Sampling temperature'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response tokens'
          },
          topP: {
            type: 'number',
            description: 'Top-p sampling parameter'
          }
        }
      }
    }],
    properties: [
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: '',
        required: true,
        placeholder: `Select a ${config.displayName} model...`,
        description: `${config.displayName} model to use (configure API key in Credentials)`,
        typeOptions: {
          dynamicOptions: true
        }
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        default: '{{ $json.message }}',
        required: true,
        typeOptions: {
          rows: 4
        },
        description: 'The message to send to the AI model',
        placeholder: 'Enter your prompt or use template variables...'
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'System Message',
            name: 'systemMessage',
            type: 'string',
            default: '',
            typeOptions: {
              rows: 3
            },
            description: 'System message to define AI behavior and personality'
          },
          ...config.parameters
        ] as any
      }
    ]
  };
}

// ============================================================================
// STANDARD PARAMETER SETS
// ============================================================================

export const STANDARD_PARAMETERS = {
  temperature: {
    displayName: 'Temperature',
    name: 'temperature',
    type: 'number' as const,
    default: 0.7,
    typeOptions: { minValue: 0, maxValue: 2, numberStepSize: 0.1 },
    description: 'Controls randomness in responses'
  },

  maxTokens: {
    displayName: 'Maximum Tokens',
    name: 'maxTokens',
    type: 'number' as const,
    default: 1000,
    typeOptions: { minValue: 1, maxValue: 8192 },
    description: 'Maximum number of tokens to generate'
  },

  topP: {
    displayName: 'Top P',
    name: 'topP',
    type: 'number' as const,
    default: 1,
    typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 },
    description: 'Controls diversity via nucleus sampling'
  },

  topK: {
    displayName: 'Top K',
    name: 'topK',
    type: 'number' as const,
    default: 40,
    typeOptions: { minValue: 1, maxValue: 100 },
    description: 'Limits token selection to top K candidates'
  },

  frequencyPenalty: {
    displayName: 'Frequency Penalty',
    name: 'frequencyPenalty',
    type: 'number' as const,
    default: 0,
    typeOptions: { minValue: -2, maxValue: 2, numberStepSize: 0.1 },
    description: 'Penalty for frequency of token usage'
  },

  presencePenalty: {
    displayName: 'Presence Penalty',
    name: 'presencePenalty',
    type: 'number' as const,
    default: 0,
    typeOptions: { minValue: -2, maxValue: 2, numberStepSize: 0.1 },
    description: 'Penalty for presence of tokens'
  }
};