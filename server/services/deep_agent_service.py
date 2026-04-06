"""DeepAgent execution service.

Follows the same interface as RLMService but replaces LangGraph with
deepagents.create_deep_agent() for graph creation.
"""

import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from core.logging import get_logger, log_execution_time, log_api_call

logger = get_logger(__name__)

# MachinaOs provider -> deepagents model prefix.
# deepagents uses "provider:model" strings (see deepagents.utils.resolve_model).
# Only gemini differs; all others use their MachinaOs name directly.
_PROVIDER_PREFIX = {"gemini": "google_genai"}


class DeepAgentService:
    """Dedicated service for Deep Agent execution.

    Injected into AIService via composition,
    following the same pattern as RLMService.
    """

    def __init__(self, auth=None):
        self.auth = auth

    async def execute(
        self,
        node_id: str,
        parameters: Dict[str, Any],
        skill_data: Optional[List[Dict[str, Any]]] = None,
        tools: Optional[List] = None,
        teammates: Optional[List[Dict[str, Any]]] = None,
        broadcaster=None,
        workflow_id: Optional[str] = None,
        database=None,
    ) -> Dict[str, Any]:
        """Execute Deep Agent via deepagents.create_deep_agent().

        Same interface pattern as RLMService.execute().
        Reuses existing MachinaOS utilities for shared concerns.
        """
        start_time = time.time()

        async def broadcast_status(phase: str, details: Dict[str, Any] = None):
            if broadcaster:
                await broadcaster.update_node_status(node_id, "executing", {
                    "phase": phase, "agent_type": "deep_agent", **(details or {})
                }, workflow_id=workflow_id)

        try:
            # === Parameter extraction (same pattern as RLMService) ===
            prompt = parameters.get('prompt', '')
            system_message = parameters.get('systemMessage', 'You are a helpful assistant')

            # Skill injection (reuse ai.py _build_skill_system_prompt)
            from services.ai import _build_skill_system_prompt
            skill_prompt, has_personality = _build_skill_system_prompt(
                skill_data, log_prefix="[DeepAgent]"
            )
            if skill_prompt:
                if has_personality:
                    system_message = skill_prompt
                else:
                    system_message = f"{system_message}\n\n{skill_prompt}"

            # Options flattening (same as execute_chat_agent)
            options = parameters.get('options', {})
            flattened = {**parameters, **options}

            # Provider/model resolution (reuse ai.py module-level helpers)
            from services.ai import is_model_valid_for_provider, get_default_model_async
            provider = parameters.get('provider', 'openai')
            model = parameters.get('model', '')

            if not model or not is_model_valid_for_provider(model, provider):
                model = await get_default_model_async(provider, database)

            api_key = flattened.get('api_key') or flattened.get('apiKey')
            if not api_key and self.auth:
                api_key = await self.auth.get_api_key(provider)
            if not api_key:
                raise ValueError(f"API key required for Deep Agent (provider: {provider})")

            await broadcast_status("initializing", {
                "message": f"Initializing Deep Agent with {provider}/{model}",
                "provider": provider, "model": model,
            })

            # === Build deepagents model string ===
            prefix = _PROVIDER_PREFIX.get(provider, provider)
            model_id = f"{prefix}:{model}"

            # === Convert teammates to deepagents SubAgent dicts ===
            subagents = None
            if teammates:
                subagents = [
                    {
                        "name": tm.get("label", tm.get("node_type", "agent")),
                        "description": f"Delegate tasks to {tm.get('label', tm.get('node_type', 'agent'))}",
                        "system_prompt": tm.get("system_prompt", ""),
                    }
                    for tm in teammates
                ]

            # === Create and invoke deep agent ===
            from deepagents import create_deep_agent

            max_turns = int(parameters.get('maxTurns', 25))

            await broadcast_status("executing", {
                "message": f"Running Deep Agent ({model_id})...",
                "tool_count": len(tools or []),
            })

            agent = create_deep_agent(
                model=model_id,
                tools=tools or None,
                system_prompt=system_message,
                subagents=subagents,
            )

            result = await agent.ainvoke(
                {"messages": [{"role": "user", "content": prompt}]},
                config={"recursion_limit": max_turns * 2},
            )

            # === Extract final AI response ===
            messages = result.get("messages", [])
            response_content = ""
            for msg in reversed(messages):
                if getattr(msg, "type", None) == "ai" and hasattr(msg, "content"):
                    response_content = msg.content if isinstance(msg.content, str) else str(msg.content)
                    break

            log_execution_time(logger, "deep_agent", start_time, time.time())
            log_api_call(logger, provider, model, "deep_agent", True)

            return {
                "success": True,
                "node_id": node_id,
                "node_type": "deep_agent",
                "result": {
                    "response": response_content,
                    "model": model,
                    "provider": provider,
                    "messages_count": len(messages),
                    "finish_reason": "stop",
                    "timestamp": datetime.now().isoformat(),
                },
                "execution_time": time.time() - start_time,
            }

        except Exception as e:
            logger.error("[DeepAgent] Execution failed", node_id=node_id, error=str(e))
            log_api_call(logger, provider if 'provider' in dir() else 'unknown',
                         model if 'model' in dir() else 'unknown',
                         "deep_agent", False, error=str(e))
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "deep_agent",
                "error": str(e),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }
