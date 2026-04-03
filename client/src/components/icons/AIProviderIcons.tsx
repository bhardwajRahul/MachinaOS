// AI Provider Icons - Using @lobehub/icons for official brand logos
import React from 'react';
import { OpenAI, Claude, Gemini, Groq, OpenRouter, Cerebras, DeepSeek, Kimi, Mistral } from '@lobehub/icons';
import { dracula, solarized } from '../../styles/theme';

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

export const DeepSeekIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <DeepSeek.Color size={size} />
);

export const KimiIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Kimi.Color size={size} />
);

export const MistralIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Mistral.Color size={size} />
);

// Map provider IDs to their icon components
export const AI_PROVIDER_ICONS: Record<string, React.FC<{ size?: number }>> = {
  openai: OpenAIIcon,
  anthropic: ClaudeIcon,
  gemini: GeminiIcon,
  groq: GroqIcon,
  openrouter: OpenRouterIcon,
  cerebras: CerebrasIcon,
  deepseek: DeepSeekIcon,
  kimi: KimiIcon,
  mistral: MistralIcon,
};

// Centralized provider metadata (icon, theme color, display label)
// Colors use dracula/solarized palette for consistency with the rest of the UI
export const AI_PROVIDER_META: Record<string, { Icon: React.FC<{ size?: number }>; color: string; label: string }> = {
  openai:     { Icon: OpenAIIcon,     color: dracula.green,      label: 'OpenAI' },
  anthropic:  { Icon: ClaudeIcon,     color: dracula.orange,     label: 'Anthropic' },
  gemini:     { Icon: GeminiIcon,     color: solarized.blue,     label: 'Gemini' },
  groq:       { Icon: GroqIcon,       color: dracula.red,        label: 'Groq' },
  cerebras:   { Icon: CerebrasIcon,   color: dracula.orange,     label: 'Cerebras' },
  openrouter: { Icon: OpenRouterIcon, color: solarized.violet,   label: 'OpenRouter' },
  deepseek:   { Icon: DeepSeekIcon,   color: dracula.cyan,       label: 'DeepSeek' },
  kimi:       { Icon: KimiIcon,       color: dracula.purple,     label: 'Kimi' },
  mistral:    { Icon: MistralIcon,    color: dracula.pink,       label: 'Mistral' },
};

// Get icon component by provider ID
export const getAIProviderIcon = (providerId: string): React.FC<{ size?: number }> | null => {
  return AI_PROVIDER_ICONS[providerId] || null;
};
