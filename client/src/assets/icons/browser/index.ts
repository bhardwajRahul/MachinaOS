// Browser automation icons
// Chrome icon sourced from @ant-design/icons-svg (ChromeOutlined)

import chromeSvg from './chrome.svg?raw';

const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const BROWSER_ICON = svgToDataUri(chromeSvg);

export const BrowserIcons = {
  chrome: chromeSvg,
};
