// AI Model Node Definitions - Standardized chat model configurations using base factory
import { INodeTypeDescription } from '../types/INodeProperties';
import { createBaseChatModel, ChatModelConfig, STANDARD_PARAMETERS } from '../factories/baseChatModelFactory';

// ============================================================================
// CHAT MODEL CONFIGURATIONS
// ============================================================================

// OpenAI Chat Model Configuration
const openaiConfig: ChatModelConfig = {
  providerId: 'openai',
  displayName: 'OpenAI',
  icon: '🤖',
  color: '#00A67E',
  description: 'OpenAI GPT models for chat completion and generation',
  models: [], // Models fetched dynamically via API
  parameters: [
    STANDARD_PARAMETERS.frequencyPenalty,
    {
      ...STANDARD_PARAMETERS.maxTokens,
      default: 4096,
      typeOptions: { minValue: 1, maxValue: 128000 },
      description: 'Maximum tokens to generate'
    },
    {
      displayName: 'Response Format',
      name: 'responseFormat',
      type: 'options',
      options: [
        {
          name: 'Text',
          value: 'text'
        },
        {
          name: 'JSON Object',
          value: 'json_object'
        }
      ],
      default: 'text',
      description: 'Format of the response'
    },
    STANDARD_PARAMETERS.presencePenalty,
    {
      ...STANDARD_PARAMETERS.temperature,
      description: 'Controls randomness (0-2). Note: O-series models (o1, o3, o4) only support temperature=1, which is set automatically.'
    },
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: {
        minValue: 1000,
        maxValue: 180000
      },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: {
        minValue: 0,
        maxValue: 5
      },
      description: 'Maximum number of retries'
    },
    STANDARD_PARAMETERS.topP,
    // Thinking/Reasoning for o-series models (o1, o3, o4)
    STANDARD_PARAMETERS.thinkingEnabled,
    STANDARD_PARAMETERS.reasoningEffort
  ]
};

// Claude Chat Model Configuration
const claudeConfig: ChatModelConfig = {
  providerId: 'anthropic',
  displayName: 'Claude',
  icon: '🧠',
  color: '#FF6B35',
  description: 'Anthropic Claude models for conversation and analysis',
  models: [], // Models fetched dynamically via API
  parameters: [
    {
      ...STANDARD_PARAMETERS.maxTokens,
      default: 4096,  // Higher default for Claude to accommodate thinking mode
      typeOptions: { minValue: 1, maxValue: 128000 },
      description: 'Maximum tokens to generate. Must be greater than Thinking Budget when thinking is enabled.'
    },
    {
      ...STANDARD_PARAMETERS.temperature,
      typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 },
      description: 'Controls randomness (0-1). Note: Automatically set to 1 when thinking mode is enabled.'
    },
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.topK,
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: {
        minValue: 1000,
        maxValue: 180000
      },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: {
        minValue: 0,
        maxValue: 5
      },
      description: 'Maximum number of retries'
    },
    // Extended thinking for Claude models
    STANDARD_PARAMETERS.thinkingEnabled,
    {
      ...STANDARD_PARAMETERS.thinkingBudget,
      description: 'Token budget for thinking (1024-16000). Must be less than Maximum Tokens.'
    }
  ]
};

// Gemini Chat Model Configuration
const geminiConfig: ChatModelConfig = {
  providerId: 'gemini',
  displayName: 'Gemini',
  icon: '⭐',
  color: '#4285F4',
  description: 'Google Gemini models for multimodal AI capabilities',
  models: [], // Models fetched dynamically via API
  parameters: [
    {
      ...STANDARD_PARAMETERS.maxTokens,
      default: 4096,
      typeOptions: { minValue: 1, maxValue: 65536 },
      description: 'Maximum tokens to generate'
    },
    {
      ...STANDARD_PARAMETERS.temperature,
      default: 0.9,
      typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 }
    },
    {
      ...STANDARD_PARAMETERS.topP,
      default: 0.95
    },
    STANDARD_PARAMETERS.topK,
    {
      displayName: 'Safety Settings',
      name: 'safetySettings',
      type: 'options',
      options: [
        {
          name: 'Default',
          value: 'default'
        },
        {
          name: 'Strict',
          value: 'strict'
        },
        {
          name: 'Permissive',
          value: 'permissive'
        }
      ],
      default: 'default',
      description: 'Content safety filtering level'
    },
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: {
        minValue: 1000,
        maxValue: 180000
      },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: {
        minValue: 0,
        maxValue: 5
      },
      description: 'Maximum number of retries'
    },
    // Thinking for Gemini models - uses thinking_budget (token count)
    STANDARD_PARAMETERS.thinkingEnabled,
    {
      ...STANDARD_PARAMETERS.thinkingBudget,
      description: 'Token budget for thinking. Works with Gemini 2.5 Flash/Pro and Flash Thinking models.'
    }
  ]
};

// OpenRouter Chat Model Configuration
const openrouterConfig: ChatModelConfig = {
  providerId: 'openrouter',
  displayName: 'OpenRouter',
  icon: '🔀',
  color: '#6366F1',
  description: 'OpenRouter unified API - access OpenAI, Claude, Gemini, Llama, and more through one API',
  models: [], // Models fetched dynamically via API
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.frequencyPenalty,
    STANDARD_PARAMETERS.presencePenalty,
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: {
        minValue: 1000,
        maxValue: 180000
      },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: {
        minValue: 0,
        maxValue: 5
      },
      description: 'Maximum number of retries'
    }
  ]
};

// Groq Chat Model Configuration
const groqConfig: ChatModelConfig = {
  providerId: 'groq',
  displayName: 'Groq',
  icon: '⚡',
  color: '#F55036',
  description: 'Groq - Ultra-fast LLM inference with Llama, Mixtral, and Gemma models',
  models: [], // Models fetched dynamically via API
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: {
        minValue: 1000,
        maxValue: 180000
      },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: {
        minValue: 0,
        maxValue: 5
      },
      description: 'Maximum number of retries'
    },
    // Reasoning for Groq models (Qwen3, QwQ)
    STANDARD_PARAMETERS.thinkingEnabled,
    STANDARD_PARAMETERS.reasoningFormat
  ]
};

// Cerebras Chat Model Configuration
const cerebrasConfig: ChatModelConfig = {
  providerId: 'cerebras',
  displayName: 'Cerebras',
  icon: '🧬',
  color: '#FF6600',
  description: 'Cerebras - Ultra-fast inference with Llama and Qwen models on custom AI hardware',
  models: [], // Models fetched dynamically via API
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: {
        minValue: 1000,
        maxValue: 180000
      },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: {
        minValue: 0,
        maxValue: 5
      },
      description: 'Maximum number of retries'
    },
    // Thinking for Cerebras models (Qwen, Llama)
    STANDARD_PARAMETERS.thinkingEnabled,
    STANDARD_PARAMETERS.thinkingBudget
  ]
};

// ============================================================================
// GENERATED CHAT MODEL NODES
// ============================================================================

export const aiModelNodes: Record<string, INodeTypeDescription> = {
  openaiChatModel: createBaseChatModel(openaiConfig),
  anthropicChatModel: createBaseChatModel(claudeConfig),
  geminiChatModel: createBaseChatModel(geminiConfig),
  openrouterChatModel: createBaseChatModel(openrouterConfig),
  groqChatModel: createBaseChatModel(groqConfig),
  cerebrasChatModel: createBaseChatModel(cerebrasConfig)
};

// Export configurations and factory for external use
export { openaiConfig, claudeConfig, geminiConfig, openrouterConfig, groqConfig, cerebrasConfig, createBaseChatModel };

