// Centralized z-index management to prevent conflicts
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  // Specific application layers
  parameterPanel: 1100,
  locationPanel: 1200,
  aiConfigPanel: 1300,
  // Maximum z-index for critical overlays
  alert: 9999
} as const;