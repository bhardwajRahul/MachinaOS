"""Concrete `AICliProvider` implementations.

- `anthropic_claude.AnthropicClaudeProvider` — full v1 surface
- `openai_codex.OpenAICodexProvider` — sandbox-first, no session
- `google_gemini.GoogleGeminiProvider` — v2 stub raising NotImplementedError

Imports are intentionally not eager — `factory.create_cli_provider()`
lazy-imports each one.
"""
