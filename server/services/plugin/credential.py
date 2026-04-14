"""Declarative credential types (n8n + Pipedream pattern).

A :class:`Credential` subclass describes how a provider is authenticated
and how its secret is stored. One Google credential is shared across
gmail / calendar / drive / sheets / tasks / contacts — nodes just
reference the class. The :class:`Connection` facade resolves secrets at
call time; handlers never see tokens.

Two concrete bases:

- :class:`OAuth2Credential` — user-authorised tokens (refresh-capable)
- :class:`ApiKeyCredential` — static secret (header / query injection)

Both are discovered at import time via :data:`CREDENTIAL_REGISTRY`
(populated by ``__init_subclass__``). Nothing else needs to wire them.
"""

from __future__ import annotations

from typing import Any, ClassVar, Dict, Literal, Optional, Sequence


CREDENTIAL_REGISTRY: Dict[str, type] = {}


class Credential:
    """Base class for provider credentials.

    Subclasses set class attributes — the class itself is the
    declaration. Never instantiate directly; use
    :class:`OAuth2Credential` or :class:`ApiKeyCredential`.
    """

    id: ClassVar[str] = ""
    display_name: ClassVar[str] = ""
    auth: ClassVar[Literal["oauth2", "api_key", "basic", "custom"]] = "custom"
    # Icon key for the credentials modal — follows node icon wire format
    # ("lobehub:gmail", "asset:serper", "🔑", etc.)
    icon: ClassVar[str] = ""
    # UI grouping (e.g. "AI", "Search", "Communication")
    category: ClassVar[str] = "Other"
    # Scopes requested / required — OAuth only, but declared uniformly
    scopes: ClassVar[Sequence[str]] = ()
    # Documentation URL for the user (credentials modal link)
    docs_url: ClassVar[Optional[str]] = None

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if cls.id:
            if cls.id in CREDENTIAL_REGISTRY and CREDENTIAL_REGISTRY[cls.id] is not cls:
                # Idempotent on re-import — only warn on genuine conflict.
                existing = CREDENTIAL_REGISTRY[cls.id]
                if existing.__qualname__ != cls.__qualname__:
                    raise ValueError(
                        f"Credential id '{cls.id}' registered by "
                        f"{existing.__qualname__} and now by {cls.__qualname__}"
                    )
            CREDENTIAL_REGISTRY[cls.id] = cls

    @classmethod
    async def resolve(cls, *, user_id: str = "owner") -> Dict[str, Any]:
        """Fetch secrets from the auth service.

        Default implementation is abstract — subclasses override.
        """
        raise NotImplementedError

    @classmethod
    def inject(cls, secrets: Dict[str, Any], request: Dict[str, Any]) -> Dict[str, Any]:
        """Mutate an httpx request dict (headers / params / json / auth)
        to carry authentication. Default is no-op — declarative subclasses
        override to implement their auth scheme.
        """
        return request


class OAuth2Credential(Credential):
    """OAuth 2.0 with refresh-token support.

    Tokens resolved via ``auth_service.get_oauth_tokens(id, user_id)``
    which handles refresh transparently. The :class:`Connection` facade
    retries on 401/403 by re-calling :meth:`resolve`.
    """

    auth: ClassVar[Literal["oauth2"]] = "oauth2"
    authorization_url: ClassVar[str] = ""
    token_url: ClassVar[str] = ""
    # How the access token rides on requests
    token_location: ClassVar[Literal["header", "query"]] = "header"
    token_header: ClassVar[str] = "Authorization"
    token_prefix: ClassVar[str] = "Bearer "
    # Keys the user enters in credentials modal (API-key style rows)
    client_id_api_key: ClassVar[str] = ""       # e.g. "google_client_id"
    client_secret_api_key: ClassVar[str] = ""   # e.g. "google_client_secret"

    @classmethod
    async def resolve(cls, *, user_id: str = "owner") -> Dict[str, Any]:
        from core.container import container

        auth_service = container.auth_service()
        tokens = await auth_service.get_oauth_tokens(cls.id, user_id)
        if not tokens or not tokens.get("access_token"):
            raise PermissionError(
                f"No OAuth tokens for '{cls.id}'. Connect via Credentials modal."
            )
        return tokens

    @classmethod
    def inject(cls, secrets: Dict[str, Any], request: Dict[str, Any]) -> Dict[str, Any]:
        token = secrets.get("access_token", "")
        if cls.token_location == "header":
            headers = dict(request.get("headers") or {})
            headers[cls.token_header] = f"{cls.token_prefix}{token}"
            request = {**request, "headers": headers}
        else:
            qs = dict(request.get("params") or {})
            qs[cls.token_header] = token
            request = {**request, "params": qs}
        return request


class ApiKeyCredential(Credential):
    """Static API key with declarative injection into headers or query.

    Example::

        class BraveCredential(ApiKeyCredential):
            id = "brave_search"
            display_name = "Brave Search"
            category = "Search"
            key_name = "X-Subscription-Token"
            key_location = "header"
    """

    auth: ClassVar[Literal["api_key"]] = "api_key"
    # Where the key goes
    key_name: ClassVar[str] = ""              # header name or query-string key
    key_location: ClassVar[Literal["header", "query", "bearer"]] = "header"
    # Extra fields stored alongside (e.g. "apify_account_id" for Apify)
    extra_fields: ClassVar[Sequence[str]] = ()

    @classmethod
    async def resolve(cls, *, user_id: str = "owner") -> Dict[str, Any]:
        from core.container import container

        auth_service = container.auth_service()
        api_key = await auth_service.get_api_key(cls.id)
        if not api_key:
            raise PermissionError(
                f"No API key for '{cls.id}'. Add via Credentials modal."
            )
        secrets: Dict[str, Any] = {"api_key": api_key}
        for field in cls.extra_fields:
            value = await auth_service.get_api_key(field)
            if value:
                secrets[field] = value
        return secrets

    @classmethod
    def inject(cls, secrets: Dict[str, Any], request: Dict[str, Any]) -> Dict[str, Any]:
        api_key = secrets.get("api_key", "")
        name = cls.key_name or "Authorization"
        if cls.key_location == "header":
            headers = dict(request.get("headers") or {})
            headers[name] = api_key
            request = {**request, "headers": headers}
        elif cls.key_location == "bearer":
            headers = dict(request.get("headers") or {})
            headers["Authorization"] = f"Bearer {api_key}"
            request = {**request, "headers": headers}
        else:  # "query"
            qs = dict(request.get("params") or {})
            qs[name] = api_key
            request = {**request, "params": qs}
        return request
