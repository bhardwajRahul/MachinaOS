"""Tests for runtime OAuth redirect URI derivation.

Locks in invariant 12 from docs-internal/credentials_panel.md:
  - get_redirect_uri strips connection.base_url path and converts ws->http
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from services.oauth_utils import get_base_url, get_redirect_uri


pytestmark = pytest.mark.credentials


def _conn(base_url: str):
    """Mimic Starlette WebSocket / Request which expose .base_url."""
    return SimpleNamespace(base_url=base_url)


class TestGetBaseUrl:
    def test_ws_scheme_becomes_http(self):
        assert get_base_url(_conn("ws://localhost:3010/ws/status")) == "http://localhost:3010"

    def test_wss_scheme_becomes_https(self):
        assert (
            get_base_url(_conn("wss://flow.zeenie.xyz/ws/status"))
            == "https://flow.zeenie.xyz"
        )

    def test_http_scheme_preserved(self):
        assert (
            get_base_url(_conn("http://localhost:3010/api/google"))
            == "http://localhost:3010"
        )

    def test_https_scheme_preserved(self):
        assert get_base_url(_conn("https://example.com/anything")) == "https://example.com"

    def test_strips_trailing_slash(self):
        assert get_base_url(_conn("http://localhost:3010/")) == "http://localhost:3010"

    def test_preserves_non_default_port(self):
        assert (
            get_base_url(_conn("http://localhost:8080/anything"))
            == "http://localhost:8080"
        )


class TestGetRedirectUri:
    @patch("services.oauth_utils.get_callback_paths")
    def test_google_dev_localhost(self, mock_paths):
        mock_paths.return_value = {
            "google": "/api/google/callback",
            "twitter": "/api/twitter/callback",
        }
        uri = get_redirect_uri(_conn("ws://localhost:3010/ws/status"), "google")
        assert uri == "http://localhost:3010/api/google/callback"

    @patch("services.oauth_utils.get_callback_paths")
    def test_twitter_prod_https(self, mock_paths):
        mock_paths.return_value = {
            "google": "/api/google/callback",
            "twitter": "/api/twitter/callback",
        }
        uri = get_redirect_uri(_conn("wss://flow.zeenie.xyz/ws/status"), "twitter")
        assert uri == "https://flow.zeenie.xyz/api/twitter/callback"

    @patch("services.oauth_utils.get_callback_paths")
    def test_unknown_provider_falls_back_to_default_path(self, mock_paths):
        mock_paths.return_value = {}  # no entries at all
        uri = get_redirect_uri(
            _conn("http://localhost:3010/anything"), "newprovider"
        )
        assert uri == "http://localhost:3010/api/newprovider/callback"

    def test_paths_loaded_from_config_not_hardcoded(self):
        """Smoke test: the real config must expose google + twitter paths."""
        from services.google_oauth import get_callback_paths

        paths = get_callback_paths()
        assert "google" in paths
        assert "twitter" in paths
        assert paths["google"].startswith("/api/")
        assert paths["twitter"].startswith("/api/")
