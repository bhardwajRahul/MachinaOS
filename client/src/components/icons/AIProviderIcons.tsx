// AI Provider Icons - Using @lobehub/icons for official brand logos
import React from 'react';
import { OpenAI, Claude, Gemini } from '@lobehub/icons';

// Icon size constant for consistency
const ICON_SIZE = 28;

// Export icon components with consistent sizing
// OpenAI uses Avatar (no Color variant), Claude and Gemini use Color variant
export const OpenAIIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <OpenAI.Avatar size={size} />
);

export const ClaudeIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Claude.Color size={size} />
);

export const GeminiIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Gemini.Color size={size} />
);

// Map provider IDs to their icon components
export const AI_PROVIDER_ICONS: Record<string, React.FC<{ size?: number }>> = {
  openai: OpenAIIcon,
  anthropic: ClaudeIcon,
  gemini: GeminiIcon,
};

// Get icon component by provider ID
export const getAIProviderIcon = (providerId: string): React.FC<{ size?: number }> | null => {
  return AI_PROVIDER_ICONS[providerId] || null;
};
