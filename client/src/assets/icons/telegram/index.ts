// Official Telegram icon
// Based on n8n's implementation using SVG files

import telegramSvg from './telegram.svg?raw';

// Convert SVG to data URI for use in node definitions
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const TELEGRAM_ICON = svgToDataUri(telegramSvg);

// Export raw SVG for React component usage
export const TelegramIcons = {
  telegram: telegramSvg,
};
