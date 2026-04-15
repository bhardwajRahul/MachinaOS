"""Apify credential (Wave 11.E.1 — per-domain).

The crawlee_scraper plugin in this folder may also add its own Credential
subclasses here in future.
"""

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
