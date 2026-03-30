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

// Centralized provider metadata (icon, brand color, display label)
export const AI_PROVIDER_META: Record<string, { Icon: React.FC<{ size?: number }>; color: string; label: string }> = {
  openai:     { Icon: OpenAIIcon,     color: '#10a37f', label: 'OpenAI' },
  anthropic:  { Icon: ClaudeIcon,     color: '#d97706', label: 'Anthropic' },
  gemini:     { Icon: GeminiIcon,     color: '#4285f4', label: 'Gemini' },
  groq:       { Icon: GroqIcon,       color: '#F55036', label: 'Groq' },
  cerebras:   { Icon: CerebrasIcon,   color: '#FF6600', label: 'Cerebras' },
  openrouter: { Icon: OpenRouterIcon, color: '#6366f1', label: 'OpenRouter' },
};

// Get icon component by provider ID
export const getAIProviderIcon = (providerId: string): React.FC<{ size?: number }> | null => {
  return AI_PROVIDER_ICONS[providerId] || null;
};
