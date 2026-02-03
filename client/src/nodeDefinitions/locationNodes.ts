// Location Node Definitions - GPS, Maps, and Geolocation Services
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

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
    icon: '🗺️',
    group: ['location', 'service'],
    version: 1,
    subtitle: 'Initialize Google Map',
    description: 'Creates an interactive Google Map using the Maps JavaScript API with customizable center, zoom, and map type',
    defaults: { name: 'GMaps Create', color: '#1A73E8' },
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
    properties: [
      { displayName: 'Center Latitude', name: 'lat', type: 'number', typeOptions: { minValue: -90, maxValue: 90, numberStepSize: 0.000001 }, default: 40.7128, required: true, description: 'Latitude for map center (decimal degrees)' },
      { displayName: 'Center Longitude', name: 'lng', type: 'number', typeOptions: { minValue: -180, maxValue: 180, numberStepSize: 0.000001 }, default: -74.0060, required: true, description: 'Longitude for map center (decimal degrees)' },
      { displayName: 'Zoom Level', name: 'zoom', type: 'number', typeOptions: { minValue: 0, maxValue: 21 }, default: 13, description: 'Map zoom level (0-21, where 21 is building level)' },
      { displayName: 'Map Type', name: 'map_type_id', type: 'options', options: [
        { name: 'Roadmap', value: 'ROADMAP' },
        { name: 'Satellite', value: 'SATELLITE' },
        { name: 'Hybrid', value: 'HYBRID' },
        { name: 'Terrain', value: 'TERRAIN' }
      ], default: 'ROADMAP', description: 'Google Maps display type' },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Disable Default UI',
            name: 'disable_default_ui',
            type: 'boolean',
            default: false,
            description: 'Disable default Google Maps UI controls'
          },
          {
            displayName: 'Zoom Control',
            name: 'zoom_control',
            type: 'boolean',
            default: true,
            description: 'Enable zoom control buttons'
          },
          {
            displayName: 'Map Type Control',
            name: 'map_type_control',
            type: 'boolean',
            default: true,
            description: 'Enable map type selection control'
          },
          {
            displayName: 'Street View Control',
            name: 'street_view_control',
            type: 'boolean',
            default: true,
            description: 'Enable street view control'
          },
          {
            displayName: 'Fullscreen Control',
            name: 'fullscreen_control',
            type: 'boolean',
            default: true,
            description: 'Enable fullscreen control'
          }
        ] as any
      }
    ]
  },

  // GMaps Locations - Google Maps Geocoding Service (Dual-purpose: workflow node + AI tool)
  gmaps_locations: {
    displayName: 'GMaps Locations',
    name: 'gmaps_locations',
    icon: '🌍',
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
    properties: [
      { displayName: 'Service Type', name: 'service_type', type: 'options', options: [
        { name: 'Geocoding (Address → LatLng)', value: 'geocode' },
        { name: 'Reverse Geocoding (LatLng → Address)', value: 'reverse_geocode' }
      ], default: 'geocode', required: true, description: 'Google Maps Geocoding service operation' },

      // Geocoding Request Parameters
      { displayName: 'Address Query', name: 'address', type: 'string', default: '', placeholder: 'e.g., "1600 Amphitheatre Parkway, Mountain View, CA"', required: true, displayOptions: { show: { service_type: ['geocode'] } }, description: 'The address to geocode' },

      // Reverse Geocoding Parameters
      { displayName: 'Location Latitude', name: 'lat', type: 'number', typeOptions: { minValue: -90, maxValue: 90, numberStepSize: 0.000001 }, default: 37.4224, required: true, displayOptions: { show: { service_type: ['reverse_geocode'] } }, description: 'Latitude for reverse geocoding' },
      { displayName: 'Location Longitude', name: 'lng', type: 'number', typeOptions: { minValue: -180, maxValue: 180, numberStepSize: 0.000001 }, default: -122.0842, required: true, displayOptions: { show: { service_type: ['reverse_geocode'] } }, description: 'Longitude for reverse geocoding' },

      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Result Types',
            name: 'result_types',
            type: 'multiOptions',
            options: [
              { name: 'Street Address', value: 'street_address' },
              { name: 'Route', value: 'route' },
              { name: 'Intersection', value: 'intersection' },
              { name: 'Political', value: 'political' },
              { name: 'Country', value: 'country' },
              { name: 'Administrative Area Level 1', value: 'administrative_area_level_1' },
              { name: 'Administrative Area Level 2', value: 'administrative_area_level_2' },
              { name: 'Locality', value: 'locality' },
              { name: 'Sublocality', value: 'sublocality' },
              { name: 'Postal Code', value: 'postal_code' }
            ],
            default: [],
            description: 'Filter results by address component types'
          },
          {
            displayName: 'Location Types',
            name: 'location_types',
            type: 'multiOptions',
            options: [
              { name: 'Rooftop', value: 'ROOFTOP' },
              { name: 'Range Interpolated', value: 'RANGE_INTERPOLATED' },
              { name: 'Geometric Center', value: 'GEOMETRIC_CENTER' },
              { name: 'Approximate', value: 'APPROXIMATE' }
            ],
            default: [],
            description: 'Filter by location precision type'
          },
          {
            displayName: 'Language',
            name: 'language',
            type: 'options',
            options: [
              { name: 'English', value: 'en' },
              { name: 'Spanish', value: 'es' },
              { name: 'French', value: 'fr' },
              { name: 'German', value: 'de' },
              { name: 'Italian', value: 'it' },
              { name: 'Portuguese', value: 'pt' },
              { name: 'Japanese', value: 'ja' },
              { name: 'Korean', value: 'ko' },
              { name: 'Chinese (Simplified)', value: 'zh-CN' },
              { name: 'Russian', value: 'ru' },
              { name: 'Arabic', value: 'ar' }
            ],
            default: 'en',
            description: 'Language for returned results'
          },
          {
            displayName: 'Region Bias',
            name: 'region',
            type: 'string',
            default: '',
            placeholder: 'e.g., "us", "uk", "jp"',
            description: 'Region code for biasing results (ccTLD format)'
          },
          {
            displayName: 'Component Restrictions',
            name: 'component_restrictions',
            type: 'string',
            default: '',
            placeholder: 'e.g., "country:US|administrative_area:CA"',
            description: 'Component-based filtering (pipe-separated)'
          }
        ] as any
      }
    ]
  },

  // GMaps Nearby Places - Google Maps Places API nearbySearch (Dual-purpose: workflow node + AI tool)
  gmaps_nearby_places: {
    displayName: 'GMaps Nearby Places',
    name: 'gmaps_nearby_places',
    icon: '🔍',
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
    properties: [
      // Required Parameters (matching Places API nearbySearch)
      { displayName: 'Location Latitude', name: 'lat', type: 'number', typeOptions: { minValue: -90, maxValue: 90, numberStepSize: 0.000001 }, default: 40.7484, required: true, description: 'Center latitude for nearbySearch (required)' },
      { displayName: 'Location Longitude', name: 'lng', type: 'number', typeOptions: { minValue: -180, maxValue: 180, numberStepSize: 0.000001 }, default: -73.9857, required: true, description: 'Center longitude for nearbySearch (required)' },
      { displayName: 'Radius (meters)', name: 'radius', type: 'number', typeOptions: { minValue: 1, maxValue: 50000 }, default: 500, required: true, description: 'Search radius in meters (max 50,000m)' },

      // Place Types (official Google Places API types)
      { displayName: 'Place Type', name: 'type', type: 'options', options: [
        { name: 'Accounting', value: 'accounting' },
        { name: 'Airport', value: 'airport' },
        { name: 'Amusement Park', value: 'amusement_park' },
        { name: 'Aquarium', value: 'aquarium' },
        { name: 'Art Gallery', value: 'art_gallery' },
        { name: 'ATM', value: 'atm' },
        { name: 'Bakery', value: 'bakery' },
        { name: 'Bank', value: 'bank' },
        { name: 'Bar', value: 'bar' },
        { name: 'Beauty Salon', value: 'beauty_salon' },
        { name: 'Bicycle Store', value: 'bicycle_store' },
        { name: 'Book Store', value: 'book_store' },
        { name: 'Bowling Alley', value: 'bowling_alley' },
        { name: 'Bus Station', value: 'bus_station' },
        { name: 'Cafe', value: 'cafe' },
        { name: 'Campground', value: 'campground' },
        { name: 'Car Dealer', value: 'car_dealer' },
        { name: 'Car Rental', value: 'car_rental' },
        { name: 'Car Repair', value: 'car_repair' },
        { name: 'Car Wash', value: 'car_wash' },
        { name: 'Casino', value: 'casino' },
        { name: 'Cemetery', value: 'cemetery' },
        { name: 'Church', value: 'church' },
        { name: 'City Hall', value: 'city_hall' },
        { name: 'Clothing Store', value: 'clothing_store' },
        { name: 'Convenience Store', value: 'convenience_store' },
        { name: 'Courthouse', value: 'courthouse' },
        { name: 'Dentist', value: 'dentist' },
        { name: 'Department Store', value: 'department_store' },
        { name: 'Doctor', value: 'doctor' },
        { name: 'Drugstore', value: 'drugstore' },
        { name: 'Electrician', value: 'electrician' },
        { name: 'Electronics Store', value: 'electronics_store' },
        { name: 'Embassy', value: 'embassy' },
        { name: 'Fire Station', value: 'fire_station' },
        { name: 'Florist', value: 'florist' },
        { name: 'Funeral Home', value: 'funeral_home' },
        { name: 'Furniture Store', value: 'furniture_store' },
        { name: 'Gas Station', value: 'gas_station' },
        { name: 'Gym', value: 'gym' },
        { name: 'Hair Care', value: 'hair_care' },
        { name: 'Hardware Store', value: 'hardware_store' },
        { name: 'Hindu Temple', value: 'hindu_temple' },
        { name: 'Home Goods Store', value: 'home_goods_store' },
        { name: 'Hospital', value: 'hospital' },
        { name: 'Insurance Agency', value: 'insurance_agency' },
        { name: 'Jewelry Store', value: 'jewelry_store' },
        { name: 'Laundry', value: 'laundry' },
        { name: 'Lawyer', value: 'lawyer' },
        { name: 'Library', value: 'library' },
        { name: 'Light Rail Station', value: 'light_rail_station' },
        { name: 'Liquor Store', value: 'liquor_store' },
        { name: 'Local Government Office', value: 'local_government_office' },
        { name: 'Locksmith', value: 'locksmith' },
        { name: 'Lodging', value: 'lodging' },
        { name: 'Meal Delivery', value: 'meal_delivery' },
        { name: 'Meal Takeaway', value: 'meal_takeaway' },
        { name: 'Mosque', value: 'mosque' },
        { name: 'Movie Rental', value: 'movie_rental' },
        { name: 'Movie Theater', value: 'movie_theater' },
        { name: 'Moving Company', value: 'moving_company' },
        { name: 'Museum', value: 'museum' },
        { name: 'Night Club', value: 'night_club' },
        { name: 'Painter', value: 'painter' },
        { name: 'Park', value: 'park' },
        { name: 'Parking', value: 'parking' },
        { name: 'Pet Store', value: 'pet_store' },
        { name: 'Pharmacy', value: 'pharmacy' },
        { name: 'Physiotherapist', value: 'physiotherapist' },
        { name: 'Plumber', value: 'plumber' },
        { name: 'Police', value: 'police' },
        { name: 'Post Office', value: 'post_office' },
        { name: 'Primary School', value: 'primary_school' },
        { name: 'Real Estate Agency', value: 'real_estate_agency' },
        { name: 'Restaurant', value: 'restaurant' },
        { name: 'Roofing Contractor', value: 'roofing_contractor' },
        { name: 'RV Park', value: 'rv_park' },
        { name: 'School', value: 'school' },
        { name: 'Secondary School', value: 'secondary_school' },
        { name: 'Shoe Store', value: 'shoe_store' },
        { name: 'Shopping Mall', value: 'shopping_mall' },
        { name: 'Spa', value: 'spa' },
        { name: 'Stadium', value: 'stadium' },
        { name: 'Storage', value: 'storage' },
        { name: 'Store', value: 'store' },
        { name: 'Subway Station', value: 'subway_station' },
        { name: 'Supermarket', value: 'supermarket' },
        { name: 'Synagogue', value: 'synagogue' },
        { name: 'Taxi Stand', value: 'taxi_stand' },
        { name: 'Tourist Attraction', value: 'tourist_attraction' },
        { name: 'Train Station', value: 'train_station' },
        { name: 'Transit Station', value: 'transit_station' },
        { name: 'Travel Agency', value: 'travel_agency' },
        { name: 'University', value: 'university' },
        { name: 'Veterinary Care', value: 'veterinary_care' },
        { name: 'Zoo', value: 'zoo' }
      ], default: 'restaurant', description: 'Google Places API place type filter' },

      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Keyword',
            name: 'keyword',
            type: 'string',
            default: '',
            placeholder: 'e.g., "pizza", "italian", "24 hour"',
            description: 'Keyword to match against place names and types'
          },
          {
            displayName: 'Name Filter',
            name: 'name',
            type: 'string',
            default: '',
            placeholder: 'e.g., "Starbucks", "McDonald\'s"',
            description: 'Match places with this name (equivalent to keyword but for names only)'
          },
          {
            displayName: 'Min Price Level',
            name: 'min_price',
            type: 'options',
            options: [
              { name: 'Any', value: '' },
              { name: 'Free (0)', value: 0 },
              { name: 'Inexpensive (1)', value: 1 },
              { name: 'Moderate (2)', value: 2 },
              { name: 'Expensive (3)', value: 3 },
              { name: 'Very Expensive (4)', value: 4 }
            ],
            default: '',
            description: 'Minimum price level (0-4)'
          },
          {
            displayName: 'Max Price Level',
            name: 'max_price',
            type: 'options',
            options: [
              { name: 'Any', value: '' },
              { name: 'Free (0)', value: 0 },
              { name: 'Inexpensive (1)', value: 1 },
              { name: 'Moderate (2)', value: 2 },
              { name: 'Expensive (3)', value: 3 },
              { name: 'Very Expensive (4)', value: 4 }
            ],
            default: '',
            description: 'Maximum price level (0-4)'
          },
          {
            displayName: 'Open Now',
            name: 'open_now',
            type: 'boolean',
            default: false,
            description: 'Only return places open at query time'
          },
          {
            displayName: 'Language',
            name: 'language',
            type: 'options',
            options: [
              { name: 'English', value: 'en' },
              { name: 'Spanish', value: 'es' },
              { name: 'French', value: 'fr' },
              { name: 'German', value: 'de' },
              { name: 'Italian', value: 'it' },
              { name: 'Portuguese', value: 'pt' },
              { name: 'Japanese', value: 'ja' },
              { name: 'Korean', value: 'ko' },
              { name: 'Chinese (Simplified)', value: 'zh-CN' },
              { name: 'Russian', value: 'ru' },
              { name: 'Arabic', value: 'ar' },
              { name: 'Hindi', value: 'hi' }
            ],
            default: 'en',
            description: 'Language for place names and information'
          },
          {
            displayName: 'Rank By',
            name: 'rank_by',
            type: 'options',
            options: [
              { name: 'Prominence (Default)', value: 'prominence' },
              { name: 'Distance', value: 'distance' }
            ],
            default: 'prominence',
            description: 'How to rank the results. When using distance, radius parameter is ignored.'
          },
          {
            displayName: 'Page Size',
            name: 'page_size',
            type: 'number',
            typeOptions: { minValue: 1, maxValue: 20 },
            default: 20,
            description: 'Number of results per page (max 20)'
          }
        ] as any
      }
    ]
  }
};

// List of Google Maps node types for easy identification
export const LOCATION_NODE_TYPES = ['gmaps_create', 'gmaps_locations', 'gmaps_nearby_places'];
