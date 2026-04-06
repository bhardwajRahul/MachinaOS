"""Deep Agent constants and provider mappings."""

# MachinaOs provider -> deepagents model prefix.
# deepagents uses "provider:model" strings (see deepagents.utils.resolve_model).
# Only gemini differs; all others use their MachinaOs name directly.
PROVIDER_PREFIX = {
    "gemini": "google_genai",
}

DEFAULT_MAX_TURNS = 25
