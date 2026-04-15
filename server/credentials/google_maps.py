"""Google Maps API-key credential (Wave 11.E).

Separate from :class:`GoogleCredential` because Maps uses a static API
key (billing-tied to a GCP project) whereas Workspace uses OAuth.
"""

from __future__ import annotations

from services.plugin.credential import ApiKeyCredential


class GoogleMapsCredential(ApiKeyCredential):
    id = "google_maps"
    display_name = "Google Maps"
    category = "Location"
    icon = "asset:google_maps"
    key_name = "key"
    key_location = "query"
    docs_url = "https://developers.google.com/maps/documentation"
