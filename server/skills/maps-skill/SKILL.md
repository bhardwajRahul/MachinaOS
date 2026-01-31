---
name: maps-skill
description: Location services including geocoding, nearby places, and maps. Use when user asks about addresses, locations, places nearby, or wants to see a map.
metadata:
  author: machina
  version: "3.0"
  category: location
---

# Location Services

This skill provides context for location-based capabilities using Google Maps services.

## How It Works

This skill provides instructions and context. To execute location actions, connect the appropriate **tool nodes** to the Zeenie's `input-tools` handle:

- **Add Locations** node - Geocode addresses to coordinates or reverse geocode
- **Show Nearby Places** node - Search for nearby places

## add_locations Tool (Geocoding)

Convert addresses to coordinates or coordinates to addresses.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| service_type | string | Yes | "geocode" (address to coordinates) or "reverse_geocode" (coordinates to address) |
| address | string | If geocode | Address to geocode (e.g., "1600 Amphitheatre Parkway, Mountain View, CA") |
| lat | float | If reverse_geocode | Latitude coordinate |
| lng | float | If reverse_geocode | Longitude coordinate |

### Examples

**Geocode address:**
```json
{
  "service_type": "geocode",
  "address": "Eiffel Tower, Paris"
}
```

**Reverse geocode:**
```json
{
  "service_type": "reverse_geocode",
  "lat": 48.8584,
  "lng": 2.2945
}
```

### Response Format

```json
{
  "success": true,
  "service_type": "geocoding",
  "input": {"address": "Eiffel Tower, Paris"},
  "results": [
    {
      "formatted_address": "Champ de Mars, 5 Av. Anatole France, 75007 Paris, France",
      "geometry": {
        "location": {"lat": 48.8583701, "lng": 2.2944813}
      },
      "address_components": [...]
    }
  ],
  "status": "OK"
}
```

## show_nearby_places Tool

Search for places near a location.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| lat | float | Yes | Center latitude for search |
| lng | float | Yes | Center longitude for search |
| radius | int | No | Search radius in meters (default: 500, max: 50000) |
| type | string | No | Place type (default: "restaurant") |
| keyword | string | No | Optional keyword to filter results |

### Examples

**Find nearby restaurants:**
```json
{
  "lat": 40.7484,
  "lng": -73.9857,
  "radius": 500,
  "type": "restaurant"
}
```

**Find coffee shops near a location:**
```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "type": "cafe",
  "keyword": "starbucks"
}
```

### Response Format

```json
{
  "success": true,
  "type": "restaurant",
  "search_parameters": {
    "location": {"lat": 40.7484, "lng": -73.9857},
    "radius": 500,
    "type": "restaurant"
  },
  "results": [
    {
      "name": "Example Restaurant",
      "vicinity": "123 Main St",
      "rating": 4.5,
      "user_ratings_total": 150,
      "price_level": 2,
      "geometry": {
        "location": {"lat": 40.7485, "lng": -73.9860}
      },
      "types": ["restaurant", "food"],
      "opening_hours": {"open_now": true}
    }
  ],
  "total_results": 10,
  "status": "OK"
}
```

## Place Types

Common place types for nearby search:
- Food: restaurant, cafe, bakery, bar, meal_takeaway
- Shopping: store, supermarket, shopping_mall, clothing_store
- Services: bank, atm, gas_station, pharmacy, post_office
- Health: hospital, doctor, dentist, pharmacy
- Transport: bus_station, train_station, airport, taxi_stand
- Entertainment: movie_theater, gym, park, museum, zoo

## Common Workflows

### Find nearby places by address
1. Use `add_locations` with service_type="geocode" to get coordinates
2. Use `show_nearby_places` with the returned lat/lng

### Get address from coordinates
1. Use `add_locations` with service_type="reverse_geocode"

## Response Guidelines

When presenting location results:
1. List the top results with name, rating, and address
2. Include distance if available
3. Mention if places are currently open
4. Offer to search for different types or expand radius

## Setup Requirements

1. Connect this skill to Zeenie's `input-skill` handle
2. Connect location tool nodes to Zeenie's `input-tools` handle
3. Ensure Google Maps API key is configured in credentials
