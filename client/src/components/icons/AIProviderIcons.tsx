// AI Provider Icons - Using @lobehub/icons for official brand logos
import React from 'react';
import { OpenAI, Claude, Gemini, Groq, OpenRouter, Cerebras } from '@lobehub/icons';

// Icon size constant for consistency
const ICON_SIZE = 28;

// Export icon components with consistent sizing
// Each provider has different available variants - use Avatar for consistency
export const OpenAIIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <OpenAI.Avatar size={size} />
);

export const ClaudeIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Claude.Color size={size} />
);

export const GeminiIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Gemini.Color size={size} />
);

// Groq uses Avatar variant (no Color variant available)
export const GroqIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Groq.Avatar size={size} />
);

// OpenRouter uses Avatar variant (no Color variant available)
export const OpenRouterIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <OpenRouter.Avatar size={size} />
);

// Cerebras uses Color variant
export const CerebrasIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Cerebras.Color size={size} />
);

// Map provider IDs to their icon components
export const AI_PROVIDER_ICONS: Record<string, React.FC<{ size?: number }>> = {
  openai: OpenAIIcon,
  anthropic: ClaudeIcon,
  gemini: GeminiIcon,
  groq: GroqIcon,
  openrouter: OpenRouterIcon,
  cerebras: CerebrasIcon,
};

// Get icon component by provider ID
export const getAIProviderIcon = (providerId: string): React.FC<{ size?: number }> | null => {
  return AI_PROVIDER_ICONS[providerId] || null;
};
