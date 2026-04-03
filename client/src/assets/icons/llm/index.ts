// LLM provider icons - extracted from @lobehub/icons
// Following the same pattern as assets/icons/google/

import deepseekSvg from './deepseek.svg?raw';
import kimiSvg from './kimi.svg?raw';
import mistralSvg from './mistral.svg?raw';

// Convert SVG to data URI for use in node definitions
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const DEEPSEEK_ICON = svgToDataUri(deepseekSvg);
export const KIMI_ICON = svgToDataUri(kimiSvg);
export const MISTRAL_ICON = svgToDataUri(mistralSvg);
