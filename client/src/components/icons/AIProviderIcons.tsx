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

// Centralized provider metadata (icon ref, theme color, display label).
// `iconRef` uses the prefix-dispatch contract resolved by `<NodeIcon>` —
// `lobehub:<brand>` picks the package's `.Color` (or `.Avatar`)
// component. `Icon` stays as a pre-built FC for the remaining direct
// consumers (e.g. ApiKeyStep onboarding cards).
export const AI_PROVIDER_META: Record<string, { iconRef: string; Icon: React.FC<{ size?: number }>; color: string; label: string }> = {
  openai:     { iconRef: 'lobehub:OpenAI',     Icon: OpenAIIcon,     color: dracula.green,    label: 'OpenAI' },
  anthropic:  { iconRef: 'lobehub:Claude',     Icon: ClaudeIcon,     color: dracula.orange,   label: 'Anthropic' },
  gemini:     { iconRef: 'lobehub:Gemini',     Icon: GeminiIcon,     color: solarized.blue,   label: 'Gemini' },
  groq:       { iconRef: 'lobehub:Groq',       Icon: GroqIcon,       color: dracula.red,      label: 'Groq' },
  cerebras:   { iconRef: 'lobehub:Cerebras',   Icon: CerebrasIcon,   color: dracula.orange,   label: 'Cerebras' },
  openrouter: { iconRef: 'lobehub:OpenRouter', Icon: OpenRouterIcon, color: solarized.violet, label: 'OpenRouter' },
  deepseek:   { iconRef: 'lobehub:DeepSeek',   Icon: DeepSeekIcon,   color: dracula.cyan,     label: 'DeepSeek' },
  kimi:       { iconRef: 'lobehub:Kimi',       Icon: KimiIcon,       color: dracula.purple,   label: 'Kimi' },
  mistral:    { iconRef: 'lobehub:Mistral',    Icon: MistralIcon,    color: dracula.pink,     label: 'Mistral' },
};

// Get icon component by provider ID
export const getAIProviderIcon = (providerId: string): React.FC<{ size?: number }> | null => {
  return AI_PROVIDER_ICONS[providerId] || null;
};
