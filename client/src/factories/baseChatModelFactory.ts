// Base Chat Model Factory - Wave 9.2: visual metadata only.
// Schema (Model, Prompt, Options + per-provider tuning) lives on backend
// as AIChatModelParams -- see server/models/nodes.py. resolveNodeDescription
// merges backend schema with the top-level visual fields below.
import {
  INodeTypeDescription,
  NodeConnectionType,
} from '../types/INodeProperties';

export interface ChatModelConfig {
  providerId: string;
  displayName: string;
  icon: string;
  color: string;
  description: string;
  nodeName?: string;
}

export function createBaseChatModel(config: ChatModelConfig): INodeTypeDescription {
  return {
    displayName: `${config.displayName} Chat Model`,
    name: config.nodeName || `${config.providerId}ChatModel`,
    icon: config.icon,
    group: ['model'],
    version: 1,
    subtitle: '={{$parameter["model"]}}',
    description: config.description,
    defaults: {
      name: `${config.displayName} Chat Model`,
      color: config.color,
    },
    inputs: [{
      name: 'prompt',
      displayName: 'Prompt',
      type: 'string' as NodeConnectionType,
      description: 'Input prompt or message for the AI model',
      required: false,
    }],
    outputs: [{
      name: 'model',
      displayName: 'Model',
      type: 'ai' as NodeConnectionType,
      description: `${config.displayName} configuration for AI agents`,
    }],
    // Wave 8/9.2: schema lives on backend (AIChatModelParams in nodes.py).
    properties: [],
  };
}
