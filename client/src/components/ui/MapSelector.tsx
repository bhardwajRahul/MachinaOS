import React, { useState, useCallback, useEffect, useRef } from 'react';
import { theme } from '../../styles/theme';
import { loadGoogleMaps } from '../../utils/googleMapsLoader';

// Google Maps API Key from environment variable
const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';

interface MapSelectorProps {
  initialLatitude?: number;
  initialLongitude?: number;
  onLocationSelect: (latitude: number, longitude: number) => void;
  onClose: () => void;
  apiKey?: string;
}

// Google Maps Component for Location Selection
const GoogleMapsLocationPicker: React.FC<{
  lat: number;
  lng: number;
  onLocationClick: (lat: number, lng: number) => void;
  apiKey?: string;
}> = ({ lat, lng, onLocationClick, apiKey }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || !apiKey || apiKey === 'YOUR_API_KEY_HERE') return;

    // Load Google Maps API using centralized loader
    const loadAndInitialize = async () => {
      try {
        await loadGoogleMaps({
          apiKey,
          libraries: ['geometry']
        });
        initializeMap();
      } catch (error) {
        console.error('Failed to load Google Maps API:', error);
      }
    };

    loadAndInitialize();

    function initializeMap() {
      if (!mapRef.current) return;

      const mapOptions: google.maps.MapOptions = {
        center: { lat, lng },
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        clickableIcons: false,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
      };

      mapInstanceRef.current = new google.maps.Map(mapRef.current, mapOptions);

      // Create marker
      markerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        draggable: true,
        title: 'Selected Location - Click or drag to change'
      });

      // Add click listeners
      mapInstanceRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          onLocationClick(newLat, newLng);
        }
      });

      // Add marker drag listener
      markerRef.current.addListener('dragend', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          onLocationClick(newLat, newLng);
        }
      });
    }
  }, [apiKey]);

  // Update marker position when coordinates change
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      const newPosition = { lat, lng };
      markerRef.current.setPosition(newPosition);
      mapInstanceRef.current.setCenter(newPosition);
    }
  }, [lat, lng]);

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        color: theme.colors.textSecondary,
        fontSize: theme.fontSize.sm,
        textAlign: 'center',
        padding: theme.spacing.lg
      }}>
        Google Maps API key required for map display
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{
        height: '100%',
        width: '100%'
      }}
    />
  );
};

const MapSelector: React.FC<MapSelectorProps> = ({
  initialLatitude = 37.7749,
  initialLongitude = -122.4194,
  onLocationSelect,
  onClose,
  apiKey = GOOGLE_MAPS_API_KEY
}) => {
  const [selectedPosition, setSelectedPosition] = useState<[number, number]>([
    initialLatitude,
    initialLongitude
  ]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    onLocationSelect(lat, lng);
  }, [onLocationSelect]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2000,
          pointerEvents: 'none',
        }}
      />

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#dc2626';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ef4444';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        style={{
          position: 'fixed',
          top: 'calc(50% - 40vh + 10px)',
          right: '60px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)',
          zIndex: 2002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
        title="Close Map Selector"
      >
        ✕
      </button>

      {/* Map Window */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '490px',
          right: '50px',
          transform: 'translateY(-50%)',
          height: '80vh',
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 2001,
        }}
      >
        {/* Header */}
        <div style={{
          padding: theme.spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundPanel,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text
          }}>
            📍 Select Location
          </h3>
          <p style={{
            margin: `${theme.spacing.xs} 0 0 0`,
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary
          }}>
            Click on the map or drag the marker to select coordinates
          </p>
        </div>

        {/* Coordinates Display */}
        <div style={{
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.background,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: theme.fontSize.sm,
            fontFamily: 'monospace',
            color: theme.colors.text,
            fontWeight: theme.fontWeight.medium
          }}>
            📌 {selectedPosition[0].toFixed(6)}, {selectedPosition[1].toFixed(6)}
          </div>
          <div style={{
            fontSize: theme.fontSize.xs,
            color: theme.colors.textSecondary,
            fontStyle: 'italic'
          }}>
            Google Maps
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <GoogleMapsLocationPicker
            lat={selectedPosition[0]}
            lng={selectedPosition[1]}
            onLocationClick={handleMapClick}
            apiKey={apiKey}
          />
        </div>
      </div>
    </>
  );
};

export default MapSelector;