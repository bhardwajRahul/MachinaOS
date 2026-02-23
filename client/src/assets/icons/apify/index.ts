// Official Apify icon from n8n-nodes-apify
// Source: https://github.com/apify/n8n-nodes-apify/blob/master/icons/apify.svg

import apifySvg from './apify.svg?raw';

// Convert SVG to data URI for use in node definitions
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const APIFY_ICON = svgToDataUri(apifySvg);

// Export raw SVG for React component usage
export const ApifyIcons = {
  apify: apifySvg,
};
