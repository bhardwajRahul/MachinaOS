"""Stripe API key credential.

Used by the two stripe plugins in this folder (stripe_action,
stripe_receive) and by :class:`StripeService` for the supervised
``stripe listen`` daemon.

The webhook signing secret (``whsec_…``) is captured automatically from
the CLI startup banner and stored as the ``stripe_webhook_secret``
extra field — same persistence path as ``telegram_owner_chat_id``.
"""

from __future__ import annotations

from services.plugin.credential import ApiKeyCredential


class StripeCredential(ApiKeyCredential):
    id = "stripe_api_key"
    display_name = "Stripe"
    category = "Payments"
    icon = "asset:stripe"
    key_name = ""  # Stripe CLI takes the key via --api-key flag, not a header
    key_location = "header"
    extra_fields = ("stripe_webhook_secret",)
    docs_url = "https://stripe.com/docs/cli"
