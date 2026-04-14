// Location Node Definitions - GPS, Maps, and Geolocation Services
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// ============================================================================
// LOCATION NODES - GPS, Maps, and Geolocation Services
// ============================================================================

export const locationNodes: Record<string, INodeTypeDescription> = {
  // ============================================================================
  // GOOGLE MAPS NODES - Map Creation and Places Integration
  // ============================================================================

  // GMaps Create - Initialize Google Maps JavaScript API with coordinates
  gmaps_create: {
    displayName: 'GMaps Create',
    name: 'gmaps_create',
    group: ['location', 'service'],
    version: 1,
    subtitle: 'Initialize Google Map',
    description: 'Creates an interactive Google Map using the Maps JavaScript API with customizable center, zoom, and map type',
    defaults: { name: 'GMaps Create', color: '#1A73E8' },
    uiHints: { showLocationPanel: true },
    inputs: [{
      name: 'main',
      displayName: 'Map Configuration',
      type: 'main' as NodeConnectionType,
      description: 'Input configuration for map initialization',
      required: false
    }],
    outputs: [{
      name: 'main',
      displayName: 'Map Output',
      type: 'main' as NodeConnectionType,
      description: 'Map configuration and reference'
    }],
    credentials: [{
      name: 'googleMapsApi',
      required: true,
      displayName: 'Google Maps API Key'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // GMaps Locations - Google Maps Geocoding Service (Dual-purpose: workflow node + AI tool)
  gmaps_locations: {
    displayName: 'GMaps Locations',
    name: 'gmaps_locations',
    group: ['location', 'service', 'tool'],  // 'tool' enables AI Agent tool calling
    version: 1,
    subtitle: 'Geocoding Service',
    description: 'Use Google Maps Geocoding Service for address-to-coordinates conversion and reverse geocoding with detailed location information',
    defaults: { name: 'GMaps Locations', color: '#34A853' },
    inputs: [{
      name: 'main',
      displayName: 'Geocoding Input',
      type: 'main' as NodeConnectionType,
      description: 'Input address or coordinates for geocoding service',
      required: false
    }],
    outputs: [{
      name: 'main',
      displayName: 'Geocoding Results',
      type: 'main' as NodeConnectionType,
      description: 'Geocoding service results with detailed location data'
    }],
    credentials: [{
      name: 'googleMapsApi',
      required: true,
      displayName: 'Google Maps API Key'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // GMaps Nearby Places - Google Maps Places API nearbySearch (Dual-purpose: workflow node + AI tool)
  gmaps_nearby_places: {
    displayName: 'GMaps Nearby Places',
    name: 'gmaps_nearby_places',
    group: ['location', 'service', 'tool'],  // 'tool' enables AI Agent tool calling
    version: 1,
    subtitle: 'Places API nearbySearch',
    description: 'Search for places near a location using Google Maps Places API nearbySearch with detailed place information in JSON format',
    defaults: { name: 'GMaps Nearby Places', color: '#FF6D01' },
    inputs: [{
      name: 'main',
      displayName: 'Search Parameters',
      type: 'main' as NodeConnectionType,
      description: 'Input search parameters for nearby places',
      required: false
    }],
    outputs: [{
      name: 'main',
      displayName: 'Places Results',
      type: 'main' as NodeConnectionType,
      description: 'Places API nearbySearch results with place details JSON'
    }],
    credentials: [{
      name: 'googleMapsApi',
      required: true,
      displayName: 'Google Maps API Key'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  }
};

// List of Google Maps node types for easy identification
export const LOCATION_NODE_TYPES = ['gmaps_create', 'gmaps_locations', 'gmaps_nearby_places'];
