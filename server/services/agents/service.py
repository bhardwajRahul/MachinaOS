"""DeepAgent execution service -- orchestration only.

Delegates to adapters for protocol translation and reuses
shared helpers from ai.py for config resolution and memory.
"""

import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from core.logging import get_logger, log_execution_time, log_api_call
from .adapters import ToolAdapter, SubAgentAdapter, ResponseExtractor
from .constants import DEFAULT_MAX_TURNS

logger = get_logger(__name__)


class DeepAgentService:
    """Dedicated service for Deep Agent execution.

    Injected into AIService via composition,
    following the same pattern as RLMService.
    """

    def __init__(self, auth=None, model_factory=None, token_tracker=None):
        self.auth = auth
        self._create_model = model_factory
        self._track_token_usage = token_tracker

    async def execute(
        self,
        node_id: str,
        parameters: Dict[str, Any],
        memory_data: Optional[Dict[str, Any]] = None,
        skill_data: Optional[List[Dict[str, Any]]] = None,
        tool_data: Optional[List[Dict[str, Any]]] = None,
        teammates: Optional[List[Dict[str, Any]]] = None,
        build_tool_fn=None,
        broadcaster=None,
        workflow_id: Optional[str] = None,
        database=None,
    ) -> Dict[str, Any]:
        """Execute Deep Agent via deepagents.create_deep_agent().

        Receives raw tool_data (not pre-built tools). Builds executable
        tools via ToolAdapter, converts teammates via SubAgentAdapter,
        extracts response via ResponseExtractor.
        """
        start_time = time.time()
        provider = 'unknown'
        model = 'unknown'

        async def broadcast_status(phase: str, details: Dict[str, Any] = None):
            if broadcaster:
                await broadcaster.update_node_status(node_id, "executing", {
                    "phase": phase, "agent_type": "deep_agent", **(details or {})
                }, workflow_id=workflow_id)

        try:
            # === Parameter extraction + skill injection ===
            from services.ai import _build_skill_system_prompt
            prompt = parameters.get('prompt', '')
            system_message = parameters.get('systemMessage', 'You are a helpful assistant')

            skill_prompt, has_personality = _build_skill_system_prompt(skill_data, log_prefix="[DeepAgent]")
            if skill_prompt:
                system_message = skill_prompt if has_personality else f"{system_message}\n\n{skill_prompt}"

            # === Provider/model/API key resolution ===
            from services.ai import (
                is_model_valid_for_provider, get_default_model_async,
                _resolve_max_tokens, _resolve_temperature, ThinkingConfig,
            )
            options = parameters.get('options', {})
            flattened = {**parameters, **options}

            provider = parameters.get('provider', 'openai')
            model = parameters.get('model', '')
            if model.startswith('[FREE] '):
                model = model[7:]
            if not model or not is_model_valid_for_provider(model, provider):
                model = await get_default_model_async(provider, database)

            api_key = flattened.get('api_key') or flattened.get('apiKey')
            if not api_key and self.auth:
                api_key = await self.auth.get_api_key(provider)
            if not api_key:
                raise ValueError(f"API key required for Deep Agent (provider: {provider})")

            max_tokens = _resolve_max_tokens(flattened, model, provider)
            thinking_config = None
            if flattened.get('thinkingEnabled'):
                thinking_config = ThinkingConfig(
                    enabled=True,
                    budget=int(flattened.get('thinkingBudget', 2048)),
                    effort=flattened.get('reasoningEffort', 'medium'),
                    level=flattened.get('thinkingLevel', 'medium'),
                    format=flattened.get('reasoningFormat', 'parsed'),
                )
            temperature = _resolve_temperature(flattened, model, provider, bool(thinking_config and thinking_config.enabled))
            proxy_url = await self.auth.get_api_key(f"{provider}_proxy") if self.auth else None

            await broadcast_status("initializing", {"message": f"Initializing Deep Agent with {provider}/{model}", "provider": provider, "model": model})

            # === Model creation ===
            chat_model = self._create_model(provider, api_key, model, temperature, max_tokens, thinking_config, proxy_url)

            # === Build tools via ToolAdapter ===
            executable_tools = []
            if tool_data and build_tool_fn:
                await broadcast_status("building_tools", {"message": f"Building {len(tool_data)} tool(s)..."})
                executable_tools = await ToolAdapter._build_tools_async(tool_data, build_tool_fn, workflow_id, broadcaster)

            # === Convert teammates via SubAgentAdapter ===
            subagents = SubAgentAdapter.convert(teammates) if teammates else None

            # === Load memory ===
            from services.ai import _parse_memory_markdown, _get_memory_vector_store
            session_id = None
            history_count = 0
            memory_content = None
            input_messages = []

            if memory_data and memory_data.get('node_id'):
                session_id = memory_data.get('session_id', 'default')
                memory_content = memory_data.get('memory_content', '# Conversation History\n\n*No messages yet.*\n')

                await broadcast_status("loading_memory", {"message": "Loading conversation history...", "session_id": session_id})

                history_messages = _parse_memory_markdown(memory_content)
                history_count = len(history_messages)

                if memory_data.get('long_term_enabled'):
                    store = _get_memory_vector_store(session_id)
                    if store:
                        try:
                            docs = store.similarity_search(prompt, k=memory_data.get('retrieval_count', 3))
                            if docs:
                                system_message = f"{system_message}\n\nRelevant past context:\n" + "\n---\n".join(d.page_content for d in docs)
                        except Exception as e:
                            logger.debug("[DeepAgent Memory] Long-term retrieval skipped: %s", e)

                for msg in history_messages:
                    input_messages.append({"role": getattr(msg, "type", "user"), "content": msg.content})

            input_messages.append({"role": "user", "content": prompt})

            # === Create and invoke deep agent ===
            from deepagents import create_deep_agent
            max_turns = int(parameters.get('maxTurns', DEFAULT_MAX_TURNS))

            await broadcast_status("executing", {"message": f"Running Deep Agent ({provider}/{model})...", "tool_count": len(executable_tools)})

            agent = create_deep_agent(
                model=chat_model,
                tools=executable_tools or None,
                system_prompt=system_message,
                subagents=subagents,
            )
            result = await agent.ainvoke(
                {"messages": input_messages},
                config={"recursion_limit": max_turns * 2},
            )

            # === Extract response via ResponseExtractor ===
            messages = result.get("messages", [])
            extracted = ResponseExtractor.extract(messages)

            # === Track token usage (same as execute_chat_agent) ===
            compaction_result = None
            if session_id and self._track_token_usage:
                # Find last AI message for usage_metadata
                ai_response = None
                for msg in reversed(messages):
                    if getattr(msg, "type", None) == "ai":
                        ai_response = msg
                        break
                if ai_response:
                    compaction_result = await self._track_token_usage(
                        session_id=session_id,
                        node_id=node_id,
                        provider=provider,
                        model=model,
                        ai_response=ai_response,
                        all_messages=messages,
                        broadcaster=broadcaster,
                        workflow_id=workflow_id,
                        memory_content=memory_content,
                        api_key=api_key,
                        memory_node_id=memory_data.get('node_id') if memory_data else None,
                    )

            # === Save memory ===
            from services.ai import _append_to_memory_markdown, _trim_markdown_window, is_valid_message_content
            if memory_data and memory_data.get('node_id') and is_valid_message_content(prompt) and is_valid_message_content(extracted["response"]):
                await broadcast_status("saving_memory", {"message": "Saving to conversation memory...", "session_id": session_id})

                # If compaction happened, use compacted summary as base
                if compaction_result and compaction_result.get('success') and compaction_result.get('summary'):
                    updated = compaction_result['summary']
                else:
                    updated = memory_content or '# Conversation History\n\n*No messages yet.*\n'
                updated = _append_to_memory_markdown(updated, 'human', prompt)
                updated = _append_to_memory_markdown(updated, 'ai', extracted["response"])
                updated, removed = _trim_markdown_window(updated, memory_data.get('window_size', 10))

                if removed and memory_data.get('long_term_enabled'):
                    store = _get_memory_vector_store(session_id)
                    if store:
                        try:
                            store.add_texts(removed)
                        except Exception as e:
                            logger.warning("[DeepAgent Memory] Failed to archive: %s", e)

                if database:
                    params = await database.get_node_parameters(memory_data['node_id']) or {}
                    params['memoryContent'] = updated
                    await database.save_node_parameters(memory_data['node_id'], params)

            log_execution_time(logger, "deep_agent", start_time, time.time())
            log_api_call(logger, provider, model, "deep_agent", True)

            # === Build result (matches execute_chat_agent format) ===
            agent_type = "deep_agent"
            if skill_data and executable_tools:
                agent_type = "deep_agent_with_skills_and_tools"
            elif skill_data:
                agent_type = "deep_agent_with_skills"
            elif executable_tools:
                agent_type = "deep_agent_with_tools"

            result_data = {
                "response": extracted["response"],
                "thinking": extracted["thinking"],
                "thinking_enabled": thinking_config.enabled if thinking_config else False,
                "model": model, "provider": provider,
                "agent_type": agent_type,
                "iterations": extracted["iterations"],
                "messages_count": len(messages),
                "finish_reason": "stop",
                "timestamp": datetime.now().isoformat(),
                "input": {"prompt": prompt, "system_message": system_message},
            }
            if session_id:
                result_data["memory"] = {"session_id": session_id, "history_loaded": history_count}
            if skill_data:
                result_data["skills"] = {"connected": [s.get('skill_name', s.get('node_type', '')) for s in skill_data], "count": len(skill_data)}
            if executable_tools:
                result_data["tools"] = {"connected": [t.name for t in executable_tools], "count": len(executable_tools)}

            return {"success": True, "node_id": node_id, "node_type": "deep_agent", "result": result_data, "execution_time": time.time() - start_time}

        except Exception as e:
            logger.error("[DeepAgent] Execution failed", node_id=node_id, error=str(e))
            log_api_call(logger, provider, model, "deep_agent", False, error=str(e))
            return {"success": False, "node_id": node_id, "node_type": "deep_agent", "error": str(e), "execution_time": time.time() - start_time, "timestamp": datetime.now().isoformat()}
