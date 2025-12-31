// Modular Parameter Panel Components
export { default as InputSection } from './InputSection';
export { default as MiddleSection } from './MiddleSection';
export { default as OutputSection } from './OutputSection';
export { default as MapsSection } from './MapsSection';
export { default as ParameterPanelLayout } from './ParameterPanelLayout';
export { default as LocationPanelLayout } from './LocationPanelLayout';

// Types defined inline for convenience

// Export interface definitions
export interface InputSectionProps {
  nodeId: string;
  visible?: boolean;
}

export interface MiddleSectionProps {
  nodeDefinition: any;
  parameters: Record<string, any>;
  onParameterChange: (paramName: string, value: any) => void;
}

export interface OutputSectionProps {
  selectedNode: any;
  executionResults: any[];
  onClearResults: () => void;
  visible?: boolean;
}

export interface ParameterPanelLayoutProps {
  selectedNode: any;
  nodeDefinition: any;
  parameters: Record<string, any>;
  hasUnsavedChanges: boolean;
  onParameterChange: (paramName: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  executionResults: any[];
  onClearResults: () => void;
  showInputSection?: boolean;
  showOutputSection?: boolean;
}