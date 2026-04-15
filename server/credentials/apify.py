"""Apify API-token credential (Wave 11.E)."""

from __future__ import annotations

from services.plugin.credential import ApiKeyCredential


class ApifyCredential(ApiKeyCredential):
    id = "apify"
    display_name = "Apify"
    category = "Scrapers"
    icon = "asset:apify"
    key_name = "Authorization"
    key_location = "bearer"
    docs_url = "https://docs.apify.com/api/v2"
