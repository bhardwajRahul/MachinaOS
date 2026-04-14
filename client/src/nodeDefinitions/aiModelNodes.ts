// AI Model Node Definitions - Wave 9.2: visual metadata only.
// Schema (temperature, maxTokens, thinking, etc.) lives on backend in
// AIChatModelParams (server/models/nodes.py) per-provider via discriminator.
import { INodeTypeDescription } from '../types/INodeProperties';
import { createBaseChatModel, ChatModelConfig } from '../factories/baseChatModelFactory';
import { dracula } from '../styles/theme';
import { DEEPSEEK_ICON, KIMI_ICON, MISTRAL_ICON } from '../assets/icons/llm';

const openaiConfig: ChatModelConfig = {
  providerId: 'openai',
  displayName: 'OpenAI',
  icon: '🤖',
  color: '#00A67E',
  description: 'OpenAI GPT models for chat completion and generation',
};

const claudeConfig: ChatModelConfig = {
  providerId: 'anthropic',
  displayName: 'Claude',
  icon: '🧠',
  color: '#FF6B35',
  description: 'Anthropic Claude models for conversation and analysis',
};

const geminiConfig: ChatModelConfig = {
  providerId: 'gemini',
  displayName: 'Gemini',
  icon: '⭐',
  color: '#4285F4',
  description: 'Google Gemini models for multimodal AI capabilities',
};

const openrouterConfig: ChatModelConfig = {
  providerId: 'openrouter',
  displayName: 'OpenRouter',
  icon: '🔀',
  color: '#6366F1',
  description: 'OpenRouter unified API - access OpenAI, Claude, Gemini, Llama, and more through one API',
};

const groqConfig: ChatModelConfig = {
  providerId: 'groq',
  displayName: 'Groq',
  icon: '⚡',
  color: '#F55036',
  description: 'Groq - Ultra-fast LLM inference with Llama, Mixtral, and Gemma models',
};

const cerebrasConfig: ChatModelConfig = {
  providerId: 'cerebras',
  displayName: 'Cerebras',
  icon: '🧬',
  color: dracula.orange,
  description: 'Cerebras - Ultra-fast inference with Llama and Qwen models on custom AI hardware',
};

const deepseekConfig: ChatModelConfig = {
  providerId: 'deepseek',
  displayName: 'DeepSeek',
  icon: DEEPSEEK_ICON,
  color: dracula.cyan,
  description: 'DeepSeek V3 models (deepseek-chat, deepseek-reasoner with always-on CoT)',
};

const kimiConfig: ChatModelConfig = {
  providerId: 'kimi',
  displayName: 'Kimi',
  icon: KIMI_ICON,
  color: dracula.purple,
  description: 'Kimi K2 models by Moonshot AI with 256K context (thinking on by default)',
};

const mistralConfig: ChatModelConfig = {
  providerId: 'mistral',
  displayName: 'Mistral',
  icon: MISTRAL_ICON,
  color: dracula.orange,
  description: 'Mistral AI models for reasoning, coding, and multilingual tasks',
};

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

export const AI_CHAT_MODEL_TYPES = Object.keys(aiModelNodes);

const ALL_CONFIGS = [openaiConfig, claudeConfig, geminiConfig, openrouterConfig, groqConfig, cerebrasConfig, deepseekConfig, kimiConfig, mistralConfig];
export const AI_MODEL_PROVIDER_MAP: Record<string, string> = Object.fromEntries(
  ALL_CONFIGS.map(c => [`${c.providerId}ChatModel`, c.providerId])
);

import { AI_PROVIDER_META } from '../components/icons/AIProviderIcons';
export const AI_PROVIDER_OPTIONS = Object.entries(AI_PROVIDER_META).map(([id, meta]) => ({
  name: meta.label,
  value: id,
}));

export { openaiConfig, claudeConfig, geminiConfig, openrouterConfig, groqConfig, cerebrasConfig, deepseekConfig, kimiConfig, mistralConfig, createBaseChatModel };
