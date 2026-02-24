// Official Search provider icons
// Based on n8n's implementation using SVG files

import braveSvg from './brave.svg?raw';
import googleSvg from './google.svg?raw';
import perplexitySvg from './perplexity.svg?raw';

// Convert SVG to data URI for use in node definitions
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const BRAVE_SEARCH_ICON = svgToDataUri(braveSvg);
export const SERPER_ICON = svgToDataUri(googleSvg);
export const PERPLEXITY_ICON = svgToDataUri(perplexitySvg);

// Export raw SVGs for React component usage
export const SearchIcons = {
  brave: braveSvg,
  serper: googleSvg,
  perplexity: perplexitySvg,
};
