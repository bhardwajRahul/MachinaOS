"""DeepAgent execution service.

Follows the same interface as RLMService but replaces LangGraph with
deepagents.create_deep_agent() for graph creation.
"""

import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from core.logging import get_logger, log_execution_time, log_api_call

logger = get_logger(__name__)


class DeepAgentService:
    """Dedicated service for Deep Agent execution.

    Injected into AIService via composition,
    following the same pattern as RLMService.
    """

    def __init__(self, auth=None, model_factory=None):
        self.auth = auth
        self._create_model = model_factory

    async def execute(
        self,
        node_id: str,
        parameters: Dict[str, Any],
        memory_data: Optional[Dict[str, Any]] = None,
        skill_data: Optional[List[Dict[str, Any]]] = None,
        tools: Optional[List] = None,
        teammates: Optional[List[Dict[str, Any]]] = None,
        broadcaster=None,
        workflow_id: Optional[str] = None,
        database=None,
    ) -> Dict[str, Any]:
        """Execute Deep Agent via deepagents.create_deep_agent().

        Same interface pattern as RLMService.execute().
        Result structure matches execute_chat_agent for frontend compatibility.
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

            # Strip [FREE] prefix (OpenRouter models)
            if model.startswith('[FREE] '):
                model = model[7:]

            if not model or not is_model_valid_for_provider(model, provider):
                model = await get_default_model_async(provider, database)

            api_key = flattened.get('api_key') or flattened.get('apiKey')
            if not api_key and self.auth:
                api_key = await self.auth.get_api_key(provider)
            if not api_key:
                raise ValueError(f"API key required for Deep Agent (provider: {provider})")

            # Resolve max_tokens, temperature, thinking config (same as execute_chat_agent)
            from services.ai import _resolve_max_tokens, _resolve_temperature, ThinkingConfig
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

            # Check for proxy URL
            proxy_url = await self.auth.get_api_key(f"{provider}_proxy") if self.auth else None

            await broadcast_status("initializing", {
                "message": f"Initializing Deep Agent with {provider}/{model}",
                "provider": provider, "model": model,
            })

            # === Build BaseChatModel with API key baked in ===
            chat_model = self._create_model(provider, api_key, model, temperature, max_tokens, thinking_config, proxy_url)

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

            # === Load memory if connected (same as execute_chat_agent) ===
            from services.ai import (
                _parse_memory_markdown, _get_memory_vector_store,
                _append_to_memory_markdown, _trim_markdown_window,
                is_valid_message_content,
            )

            session_id = None
            history_count = 0
            memory_content = None
            input_messages = []

            if memory_data and memory_data.get('node_id'):
                session_id = memory_data.get('session_id', 'default')
                memory_content = memory_data.get('memory_content', '# Conversation History\n\n*No messages yet.*\n')

                await broadcast_status("loading_memory", {
                    "message": "Loading conversation history...",
                    "session_id": session_id,
                })

                history_messages = _parse_memory_markdown(memory_content)
                history_count = len(history_messages)

                # Long-term memory retrieval
                if memory_data.get('long_term_enabled'):
                    store = _get_memory_vector_store(session_id)
                    if store:
                        try:
                            k = memory_data.get('retrieval_count', 3)
                            docs = store.similarity_search(prompt, k=k)
                            if docs:
                                ctx = "\n---\n".join(d.page_content for d in docs)
                                system_message = f"{system_message}\n\nRelevant past context:\n{ctx}"
                        except Exception as e:
                            logger.debug("[DeepAgent Memory] Long-term retrieval skipped: %s", e)

                # Convert history to dicts for deepagents message format
                for msg in history_messages:
                    input_messages.append({"role": getattr(msg, "type", "user"), "content": msg.content})

                logger.info("[DeepAgent Memory] Loaded %d messages from markdown", history_count)

            # Build input messages: history + current prompt
            input_messages.append({"role": "user", "content": prompt})

            # === Create and invoke deep agent ===
            from deepagents import create_deep_agent

            max_turns = int(parameters.get('maxTurns', 25))

            await broadcast_status("executing", {
                "message": f"Running Deep Agent ({provider}/{model})...",
                "tool_count": len(tools or []),
            })

            agent = create_deep_agent(
                model=chat_model,
                tools=tools or None,
                system_prompt=system_message,
                subagents=subagents,
            )

            result = await agent.ainvoke(
                {"messages": input_messages},
                config={"recursion_limit": max_turns * 2},
            )

            # === Extract response and thinking (same patterns as execute_chat_agent) ===
            messages = result.get("messages", [])
            response_content = ""
            thinking_content = None
            iterations = 0

            # Count iterations (tool-call messages indicate agent loops)
            for msg in messages:
                if getattr(msg, "type", None) == "ai" and getattr(msg, "tool_calls", None):
                    iterations += 1

            # Extract final AI response
            for msg in reversed(messages):
                if getattr(msg, "type", None) == "ai" and hasattr(msg, "content"):
                    raw_content = msg.content

                    # Handle list content (Gemini format: [{type: "text", text: "..."}])
                    if isinstance(raw_content, list):
                        text_parts = []
                        for block in raw_content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                            elif isinstance(block, str):
                                text_parts.append(block)
                        response_content = "\n".join(text_parts)
                    elif isinstance(raw_content, str):
                        response_content = raw_content
                    else:
                        response_content = str(raw_content)

                    # Extract thinking from last AI message
                    from services.ai import extract_thinking_from_response
                    _, thinking_content = extract_thinking_from_response(msg)
                    break

            iterations = max(iterations, 1)

            # === Save memory if connected (same as execute_chat_agent) ===
            if memory_data and memory_data.get('node_id') and is_valid_message_content(prompt) and is_valid_message_content(response_content):
                await broadcast_status("saving_memory", {
                    "message": "Saving to conversation memory...",
                    "session_id": session_id,
                })

                updated_content = memory_content or '# Conversation History\n\n*No messages yet.*\n'
                updated_content = _append_to_memory_markdown(updated_content, 'human', prompt)
                updated_content = _append_to_memory_markdown(updated_content, 'ai', response_content)

                # Trim to window size, archive removed to vector DB
                window_size = memory_data.get('window_size', 10)
                updated_content, removed_texts = _trim_markdown_window(updated_content, window_size)

                if removed_texts and memory_data.get('long_term_enabled'):
                    store = _get_memory_vector_store(session_id)
                    if store:
                        try:
                            store.add_texts(removed_texts)
                        except Exception as e:
                            logger.warning("[DeepAgent Memory] Failed to archive: %s", e)

                # Persist to database
                memory_node_id = memory_data['node_id']
                if database:
                    current_params = await database.get_node_parameters(memory_node_id) or {}
                    current_params['memoryContent'] = updated_content
                    await database.save_node_parameters(memory_node_id, current_params)
                    logger.info("[DeepAgent Memory] Saved markdown to memory node '%s'", memory_node_id)

            log_execution_time(logger, "deep_agent", start_time, time.time())
            log_api_call(logger, provider, model, "deep_agent", True)

            # === Build result matching execute_chat_agent format ===
            agent_type = "deep_agent"
            if skill_data and tools:
                agent_type = "deep_agent_with_skills_and_tools"
            elif skill_data:
                agent_type = "deep_agent_with_skills"
            elif tools:
                agent_type = "deep_agent_with_tools"

            result_data = {
                "response": response_content,
                "thinking": thinking_content,
                "thinking_enabled": thinking_config.enabled if thinking_config else False,
                "model": model,
                "provider": provider,
                "agent_type": agent_type,
                "iterations": iterations,
                "messages_count": len(messages),
                "finish_reason": "stop",
                "timestamp": datetime.now().isoformat(),
                "input": {
                    "prompt": prompt,
                    "system_message": system_message,
                },
            }

            if session_id:
                result_data["memory"] = {
                    "session_id": session_id,
                    "history_loaded": history_count,
                }

            if skill_data:
                result_data["skills"] = {
                    "connected": [s.get('skill_name', s.get('node_type', '')) for s in skill_data],
                    "count": len(skill_data),
                }

            if tools:
                result_data["tools"] = {
                    "connected": [t.name for t in tools],
                    "count": len(tools),
                }

            return {
                "success": True,
                "node_id": node_id,
                "node_type": "deep_agent",
                "result": result_data,
                "execution_time": time.time() - start_time,
            }

        except Exception as e:
            logger.error("[DeepAgent] Execution failed", node_id=node_id, error=str(e))
            log_api_call(logger, provider, model, "deep_agent", False, error=str(e))
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "deep_agent",
                "error": str(e),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }
