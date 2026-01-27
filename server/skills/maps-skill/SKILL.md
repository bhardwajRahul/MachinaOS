---
name: maps-skill
description: Location services including geocoding, nearby places, and maps. Use when user asks about addresses, locations, places nearby, or wants to see a map.
allowed-tools: maps-geocode maps-nearby maps-create
metadata:
  author: machina
  version: "1.0"
  category: location
---

# Location Services

This skill provides location-based capabilities using Google Maps services.

## Capabilities

- Convert addresses to coordinates (geocoding)
- Find nearby places (restaurants, stores, etc.)
- Create and display maps
- Get place details and information

## Tool Reference

### maps-geocode
Convert an address to geographic coordinates.

Parameters:
- `address` (required): Address or location name to geocode

Returns:
- latitude, longitude
- formatted address
- place ID

### maps-nearby
Search for nearby places.

Parameters:
- `location` (required): Center point (address or "lat,lng")
- `type` (required): Place type (restaurant, cafe, hospital, etc.)
- `radius` (optional): Search radius in meters (default: 1000)

Returns:
- List of places with name, address, rating
- Distance from center point

### maps-create
Create an interactive map.

Parameters:
- `center` (required): Map center (address or "lat,lng")
- `zoom` (optional): Zoom level 1-20 (default: 14)
- `markers` (optional): List of markers to add

## Place Types

Common place types for nearby search:
- Food: restaurant, cafe, bakery, bar
- Shopping: store, supermarket, shopping_mall
- Services: bank, atm, gas_station, pharmacy
- Health: hospital, doctor, dentist
- Transport: bus_station, train_station, airport
- Entertainment: movie_theater, gym, park

## Examples

**User**: "What restaurants are near Times Square?"
**Action**: Use maps-nearby with:
- location: "Times Square, New York"
- type: "restaurant"
- radius: 500

**User**: "What's the address of the Eiffel Tower?"
**Action**: Use maps-geocode with:
- address: "Eiffel Tower, Paris"

**User**: "Show me a map of downtown Seattle"
**Action**: Use maps-create with:
- center: "Downtown Seattle, WA"
- zoom: 15

## Response Format

When presenting location results:
1. List the top results with key details
2. Include ratings and distances when available
3. Offer to show more details or refine the search
4. Suggest related searches if appropriate
