// Official Google Workspace service icons
// Based on n8n's implementation using SVG files

import gmailSvg from './gmail.svg?raw';
import calendarSvg from './calendar.svg?raw';
import driveSvg from './drive.svg?raw';
import sheetsSvg from './sheets.svg?raw';
import tasksSvg from './tasks.svg?raw';
import contactsSvg from './contacts.svg?raw';

// Convert SVG to data URI for use in node definitions
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

export const GMAIL_ICON = svgToDataUri(gmailSvg);
export const CALENDAR_ICON = svgToDataUri(calendarSvg);
export const DRIVE_ICON = svgToDataUri(driveSvg);
export const SHEETS_ICON = svgToDataUri(sheetsSvg);
export const TASKS_ICON = svgToDataUri(tasksSvg);
export const CONTACTS_ICON = svgToDataUri(contactsSvg);

// Export raw SVGs for React component usage
export const GoogleIcons = {
  gmail: gmailSvg,
  calendar: calendarSvg,
  drive: driveSvg,
  sheets: sheetsSvg,
  tasks: tasksSvg,
  contacts: contactsSvg,
};
