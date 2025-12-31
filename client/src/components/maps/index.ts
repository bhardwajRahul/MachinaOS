// Maps Components
export { default as GoogleMapsPicker } from './GoogleMapsPicker';
export { default as MapsPreviewPanel } from './MapsPreviewPanel';

// Re-export types for convenience
export interface GoogleMapsPickerProps {
  lat: number;
  lng: number;
  onLocationClick: (lat: number, lng: number) => void;
  apiKey?: string;
  zoom?: number;
  mapTypeId?: string;
  height?: string;
  width?: string;
}

export interface MapsPreviewPanelProps {
  lat: number;
  lng: number;
  zoom?: number;
  mapTypeId?: string;
  apiKey?: string;
  onLocationClick: (lat: number, lng: number) => void;
  title?: string;
  description?: string;
}