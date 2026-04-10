// Email icons for Himalaya IMAP/SMTP nodes

import sendSvg from './send.svg?raw';
import readSvg from './read.svg?raw';
import receiveSvg from './receive.svg?raw';

const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const EMAIL_SEND_ICON = svgToDataUri(sendSvg);
export const EMAIL_READ_ICON = svgToDataUri(readSvg);
export const EMAIL_RECEIVE_ICON = svgToDataUri(receiveSvg);

export const EmailIcons = {
  send: sendSvg,
  read: readSvg,
  receive: receiveSvg,
};
