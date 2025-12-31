export interface NodeParameter {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'slider' | 'percentage' | 'file' | 'text' | 'array' | 'options' | 'multiOptions' | 'collection' | 'fixedCollection' | 'color' | 'dateTime' | 'notice' | 'hidden' | 'resourceLocator' | 'code' | 'json';
  default?: any;
  placeholder?: string;
  description?: string;
  options?: Array<{ value: any; label?: string; name?: string }>;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface NodeOutput {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'array' | 'object' | string;
  description: string;
}


export interface NodeData {
  label?: string;
  disabled?: boolean; // Skip execution when true (n8n-style disable)
  customIcon?: string; // Custom icon: emoji, text, or image URL (http://, https://, data:, or /)
  [key: string]: any;
}