// AI Model Node Definitions - Standardized chat model configurations using base factory
import { INodeTypeDescription } from '../types/INodeProperties';
import { createBaseChatModel, ChatModelConfig, STANDARD_PARAMETERS } from '../factories/baseChatModelFactory';
import { dracula } from '../styles/theme';
import { DEEPSEEK_ICON, KIMI_ICON, MISTRAL_ICON } from '../assets/icons/llm';

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
  models: [],
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
        { name: 'Text', value: 'text' },
        { name: 'JSON Object', value: 'json_object' }
      ],
      default: 'text',
      description: 'Format of the response'
    },
    STANDARD_PARAMETERS.presencePenalty,
    {
      ...STANDARD_PARAMETERS.temperature,
      description: 'Controls randomness (0-2). Note: O-series models (o1, o3, o4) only support temperature=1, which is set automatically.'
    },
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
    STANDARD_PARAMETERS.topP,
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
  models: [],
  parameters: [
    {
      ...STANDARD_PARAMETERS.maxTokens,
      default: 4096,
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
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
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
  models: [],
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
    { ...STANDARD_PARAMETERS.topP, default: 0.95 },
    STANDARD_PARAMETERS.topK,
    {
      displayName: 'Safety Settings',
      name: 'safetySettings',
      type: 'options',
      options: [
        { name: 'Default', value: 'default' },
        { name: 'Strict', value: 'strict' },
        { name: 'Permissive', value: 'permissive' }
      ],
      default: 'default',
      description: 'Content safety filtering level'
    },
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
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
  models: [],
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.frequencyPenalty,
    STANDARD_PARAMETERS.presencePenalty,
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
  ]
};

// Groq Chat Model Configuration
const groqConfig: ChatModelConfig = {
  providerId: 'groq',
  displayName: 'Groq',
  icon: '⚡',
  color: '#F55036',
  description: 'Groq - Ultra-fast LLM inference with Llama, Mixtral, and Gemma models',
  models: [],
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
    STANDARD_PARAMETERS.thinkingEnabled,
    STANDARD_PARAMETERS.reasoningFormat
  ]
};

// Cerebras Chat Model Configuration
const cerebrasConfig: ChatModelConfig = {
  providerId: 'cerebras',
  displayName: 'Cerebras',
  icon: '🧬',
  color: dracula.orange,
  description: 'Cerebras - Ultra-fast inference with Llama and Qwen models on custom AI hardware',
  models: [],
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
    STANDARD_PARAMETERS.thinkingEnabled,
    STANDARD_PARAMETERS.thinkingBudget
  ]
};

// DeepSeek Chat Model Configuration
const deepseekConfig: ChatModelConfig = {
  providerId: 'deepseek',
  displayName: 'DeepSeek',
  icon: DEEPSEEK_ICON,
  color: dracula.cyan,
  description: 'DeepSeek V3 models with Chain-of-Thought reasoning (deepseek-chat, deepseek-reasoner)',
  models: [],
  parameters: [
    {
      ...STANDARD_PARAMETERS.temperature,
      description: 'Controls randomness (0-2). Ignored by deepseek-reasoner.'
    },
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.frequencyPenalty,
    STANDARD_PARAMETERS.presencePenalty,
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
    STANDARD_PARAMETERS.thinkingEnabled,
  ]
};

// Kimi (Moonshot AI) Chat Model Configuration
const kimiConfig: ChatModelConfig = {
  providerId: 'kimi',
  displayName: 'Kimi',
  icon: KIMI_ICON,
  color: dracula.purple,
  description: 'Kimi K2 models by Moonshot AI with 256K context and reasoning support',
  models: [],
  parameters: [
    {
      ...STANDARD_PARAMETERS.temperature,
      typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 },
      description: 'Controls randomness (0-1). Fixed at 1.0 for thinking models.'
    },
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
    STANDARD_PARAMETERS.thinkingEnabled,
  ]
};

// Mistral AI Chat Model Configuration
const mistralConfig: ChatModelConfig = {
  providerId: 'mistral',
  displayName: 'Mistral',
  icon: MISTRAL_ICON,
  color: dracula.orange,
  description: 'Mistral AI models for reasoning, coding, and multilingual tasks',
  models: [],
  parameters: [
    {
      ...STANDARD_PARAMETERS.temperature,
      typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 },
      description: 'Controls randomness (0-1)'
    },
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.timeout,
    STANDARD_PARAMETERS.maxRetries,
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
  cerebrasChatModel: createBaseChatModel(cerebrasConfig),
  deepseekChatModel: createBaseChatModel(deepseekConfig),
  kimiChatModel: createBaseChatModel(kimiConfig),
  mistralChatModel: createBaseChatModel(mistralConfig),
};

// Node type names for external reference (Dashboard, SquareNode, etc.)
export const AI_CHAT_MODEL_TYPES = Object.keys(aiModelNodes);

// Map node type -> provider ID for icon/credential lookup
const ALL_CONFIGS = [openaiConfig, claudeConfig, geminiConfig, openrouterConfig, groqConfig, cerebrasConfig, deepseekConfig, kimiConfig, mistralConfig];
export const AI_MODEL_PROVIDER_MAP: Record<string, string> = Object.fromEntries(
  ALL_CONFIGS.map(c => [`${c.providerId}ChatModel`, c.providerId])
);

// Export configurations and factory for external use
export { openaiConfig, claudeConfig, geminiConfig, openrouterConfig, groqConfig, cerebrasConfig, deepseekConfig, kimiConfig, mistralConfig, createBaseChatModel };
