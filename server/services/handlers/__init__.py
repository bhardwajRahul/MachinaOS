"""Node handler shims.

Most handler bodies were inlined into their plugin files during Wave
11.D / 11.E. What remains here is the cross-cutting machinery:

- ``tools.py``        — AI-tool dispatcher + plugin fast-path + Android
                         toolkit + agent delegation.
- ``ai.py``           — agent-execution shims (``handle_ai_agent`` etc.)
                         called by the agent plugins via
                         ``nodes/agent/_inline.prepare_agent_call``.
- ``android.py``      — direct Android service execution.
- ``browser.py``      — agent-browser CLI wrapper.
- ``claude_code.py``  — Claude Code SDK wrapper.
- ``deep_agent.py``   — DeepAgents bridge.
- ``rlm.py``          — RLM agent execution.
- ``triggers.py``     — generic trigger node handler.
- ``google_auth.py``  — shared OAuth helper for Google plugins (kept
                         alive by ``credentials/google.GoogleCredential``).

The package ``__init__.py`` deliberately stays empty: nothing imports
from ``services.handlers`` at the package level — every consumer
imports the specific submodule it needs.
"""
