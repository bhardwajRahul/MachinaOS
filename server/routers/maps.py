"""Google Maps service routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import httpx

from core.container import container
from services.maps import MapsService
from services.status_broadcaster import get_status_broadcaster
from core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/python", tags=["maps"])


class GoogleMapsRequest(BaseModel):
    node_id: str
    node_type: str
    parameters: Dict[str, Any]
    api_key: Optional[str] = None


class ApiKeyValidationRequest(BaseModel):
    api_key: str


@router.post("/maps/validate-key")
async def validate_google_maps_key(request: ApiKeyValidationRequest):
    """Validate Google Maps API key and broadcast status via WebSocket."""
    broadcaster = get_status_broadcaster()

    try:
        api_key = request.api_key.strip()
        if not api_key:
            await broadcaster.update_api_key_status(
                provider="google_maps",
                valid=False,
                message="API key is required"
            )
            raise HTTPException(status_code=400, detail="API key is required")

        # Test the API key with a simple geocoding request
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": "1600 Amphitheatre Parkway, Mountain View, CA",
                    "key": api_key
                },
                timeout=10.0
            )

            data = response.json()

            if data.get("status") == "OK":
                await broadcaster.update_api_key_status(
                    provider="google_maps",
                    valid=True,
                    message="API key validated successfully"
                )
                return {
                    "success": True,
                    "valid": True,
                    "message": "Google Maps API key is valid"
                }
            elif data.get("status") == "REQUEST_DENIED":
                error_msg = data.get("error_message", "Invalid API key")
                await broadcaster.update_api_key_status(
                    provider="google_maps",
                    valid=False,
                    message=error_msg
                )
                return {
                    "success": True,
                    "valid": False,
                    "message": error_msg
                }
            else:
                # Other statuses like ZERO_RESULTS still mean the key works
                await broadcaster.update_api_key_status(
                    provider="google_maps",
                    valid=True,
                    message="API key validated"
                )
                return {
                    "success": True,
                    "valid": True,
                    "message": f"API key is valid (status: {data.get('status')})"
                }

    except httpx.TimeoutException:
        await broadcaster.update_api_key_status(
            provider="google_maps",
            valid=False,
            message="Validation request timed out"
        )
        raise HTTPException(status_code=504, detail="Validation request timed out")
    except httpx.RequestError as e:
        await broadcaster.update_api_key_status(
            provider="google_maps",
            valid=False,
            message=f"Network error: {str(e)}"
        )
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API key validation error: {e}")
        await broadcaster.update_api_key_status(
            provider="google_maps",
            valid=False,
            message=f"Validation failed: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.post("/createmap/execute")
async def execute_createmap_node(
    request: GoogleMapsRequest,
    maps_service: MapsService = Depends(lambda: container.maps_service())
):
    """Execute Create Map node - Google Maps initialization."""
    return await maps_service.create_map(request.node_id, request.parameters)


@router.post("/addlocations/execute")
async def execute_addlocations_node(
    request: GoogleMapsRequest,
    maps_service: MapsService = Depends(lambda: container.maps_service())
):
    """Execute Add Locations node - Google Maps Geocoding."""
    return await maps_service.geocode_location(request.node_id, request.parameters)


@router.post("/shownearbyplaces/execute")
async def execute_shownearbyplaces_node(
    request: GoogleMapsRequest,
    maps_service: MapsService = Depends(lambda: container.maps_service())
):
    """Execute Show Nearby Places node - Google Places API."""
    return await maps_service.find_nearby_places(request.node_id, request.parameters)