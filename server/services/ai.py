"""AI service for managing language models with LangGraph state machine support."""

import time
import httpx
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Type, TypedDict, Annotated, Sequence
import operator

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, END

from core.config import Settings
from core.logging import get_logger, log_execution_time, log_api_call
from services.auth import AuthService

logger = get_logger(__name__)


# =============================================================================
# AI PROVIDER REGISTRY - Single source of truth for provider configurations
# =============================================================================

@dataclass
class ProviderConfig:
    """Configuration for an AI provider."""
    name: str
    model_class: Type
    api_key_param: str  # Parameter name for API key in model constructor
    max_tokens_param: str  # Parameter name for max tokens
    detection_patterns: tuple  # Patterns to detect this provider from model name
    default_model: str  # Default model when none specified
    models_endpoint: str  # API endpoint to fetch models
    models_header_fn: Callable[[str], dict]  # Function to create headers


def _openai_headers(api_key: str) -> dict:
    return {'Authorization': f'Bearer {api_key}'}


def _anthropic_headers(api_key: str) -> dict:
    return {'x-api-key': api_key, 'anthropic-version': '2023-06-01'}


def _gemini_headers(api_key: str) -> dict:
    return {}  # API key in URL for Gemini


# Provider configurations
PROVIDER_CONFIGS: Dict[str, ProviderConfig] = {
    'openai': ProviderConfig(
        name='openai',
        model_class=ChatOpenAI,
        api_key_param='openai_api_key',
        max_tokens_param='max_tokens',
        detection_patterns=('gpt', 'openai', 'o1'),
        default_model='gpt-4o-mini',
        models_endpoint='https://api.openai.com/v1/models',
        models_header_fn=_openai_headers
    ),
    'anthropic': ProviderConfig(
        name='anthropic',
        model_class=ChatAnthropic,
        api_key_param='anthropic_api_key',
        max_tokens_param='max_tokens',
        detection_patterns=('claude', 'anthropic'),
        default_model='claude-3-5-sonnet-20241022',
        models_endpoint='https://api.anthropic.com/v1/models',
        models_header_fn=_anthropic_headers
    ),
    'gemini': ProviderConfig(
        name='gemini',
        model_class=ChatGoogleGenerativeAI,
        api_key_param='google_api_key',
        max_tokens_param='max_output_tokens',
        detection_patterns=('gemini', 'google'),
        default_model='gemini-1.5-pro',
        models_endpoint='https://generativelanguage.googleapis.com/v1beta/models',
        models_header_fn=_gemini_headers
    ),
}


def detect_provider_from_model(model: str) -> str:
    """Detect AI provider from model name using registry patterns."""
    model_lower = model.lower()
    for provider_name, config in PROVIDER_CONFIGS.items():
        if any(pattern in model_lower for pattern in config.detection_patterns):
            return provider_name
    return 'openai'  # default


def is_model_valid_for_provider(model: str, provider: str) -> bool:
    """Check if model name matches the provider's patterns."""
    config = PROVIDER_CONFIGS.get(provider)
    if not config:
        return True
    model_lower = model.lower()
    return any(pattern in model_lower for pattern in config.detection_patterns)


def get_default_model(provider: str) -> str:
    """Get default model for a provider."""
    config = PROVIDER_CONFIGS.get(provider)
    return config.default_model if config else 'gpt-4o-mini'


# =============================================================================
# LANGGRAPH STATE MACHINE DEFINITIONS
# =============================================================================

class AgentState(TypedDict):
    """State for the LangGraph agent workflow.

    Uses Annotated with operator.add to accumulate messages over steps.
    This is the core pattern from LangGraph for stateful conversations.
    """
    messages: Annotated[Sequence[BaseMessage], operator.add]
    # Tool outputs for future tool integration
    tool_outputs: Dict[str, Any]
    # Agent metadata
    iteration: int
    max_iterations: int
    should_continue: bool


def create_agent_node(chat_model):
    """Create the agent node function for LangGraph.

    The agent node:
    1. Receives current state with messages
    2. Invokes the LLM
    3. Returns updated state with new AI message
    """
    def agent_node(state: AgentState) -> Dict[str, Any]:
        """Process messages through the LLM and return response."""
        messages = state["messages"]
        iteration = state.get("iteration", 0)
        max_iterations = state.get("max_iterations", 10)

        # Invoke the model
        response = chat_model.invoke(list(messages))

        # Check if we should continue (for future tool use)
        # Currently we just do single turn, but structure supports multi-turn
        should_continue = False

        return {
            "messages": [response],  # Will be appended via operator.add
            "tool_outputs": {},
            "iteration": iteration + 1,
            "max_iterations": max_iterations,
            "should_continue": should_continue
        }

    return agent_node


def should_continue(state: AgentState) -> str:
    """Determine if the agent should continue or end.

    This is the conditional edge function for LangGraph.
    Returns "continue" to loop back to tools, or "end" to finish.
    """
    if state.get("should_continue", False):
        if state.get("iteration", 0) < state.get("max_iterations", 10):
            return "continue"
    return "end"


def build_agent_graph(chat_model):
    """Build the LangGraph agent workflow.

    Architecture:
        START -> agent -> (conditional) -> END
                   ^            |
                   |            v
                   +--- tools --+  (future: tool execution loop)

    For now, this is a simple single-node graph that can be extended
    with tool nodes when tool integration is added.
    """
    # Create the graph with our state schema
    graph = StateGraph(AgentState)

    # Add the agent node
    agent_fn = create_agent_node(chat_model)
    graph.add_node("agent", agent_fn)

    # Set entry point
    graph.set_entry_point("agent")

    # Add conditional edge - currently always ends, but structured for tools
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "continue": "agent",  # Loop back for multi-turn (future tools)
            "end": END
        }
    )

    # Compile the graph
    return graph.compile()


class AIService:
    """AI model service for LangChain operations."""

    def __init__(self, auth_service: AuthService, database, cache, settings: Settings):
        self.auth = auth_service
        self.database = database
        self.cache = cache
        self.settings = settings

    def detect_provider(self, model: str) -> str:
        """Detect AI provider from model name."""
        return detect_provider_from_model(model)

    def create_model(self, provider: str, api_key: str, model: str,
                    temperature: float, max_tokens: int):
        """Create LangChain model instance using provider registry."""
        config = PROVIDER_CONFIGS.get(provider)
        if not config:
            raise ValueError(f"Unsupported provider: {provider}")

        # Build kwargs dynamically from registry config
        kwargs = {
            config.api_key_param: api_key,
            'model': model,
            'temperature': temperature,
            config.max_tokens_param: max_tokens
        }

        return config.model_class(**kwargs)

    async def fetch_models(self, provider: str, api_key: str) -> List[str]:
        """Fetch available models from provider API."""
        async with httpx.AsyncClient(timeout=self.settings.ai_timeout) as client:
            if provider == 'openai':
                response = await client.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                response.raise_for_status()
                data = response.json()

                # Filter for chat models
                models = []
                for model in data.get('data', []):
                    model_id = model['id'].lower()
                    if (('gpt' in model_id or 'o1' in model_id) and
                        'instruct' not in model_id and 'embedding' not in model_id):
                        models.append(model['id'])

                # Sort by priority
                priority = {'gpt-4o': 1, 'gpt-4o-mini': 2, 'gpt-4-turbo': 3, 'gpt-4': 4}
                return sorted(models, key=lambda x: priority.get(x, 99))

            elif provider == 'anthropic':
                response = await client.get(
                    'https://api.anthropic.com/v1/models',
                    headers={
                        'x-api-key': api_key,
                        'anthropic-version': '2023-06-01'
                    }
                )
                response.raise_for_status()
                data = response.json()
                return [model['id'] for model in data.get('data', [])
                       if model.get('type') == 'model']

            elif provider == 'gemini':
                response = await client.get(
                    f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}'
                )
                response.raise_for_status()
                data = response.json()

                models = []
                for model in data.get('models', []):
                    name = model.get('name', '')
                    if ('gemini' in name and
                        'generateContent' in model.get('supportedGenerationMethods', [])):
                        models.append(name.replace('models/', ''))

                return sorted(models)

            else:
                raise ValueError(f"Unsupported provider: {provider}")

    async def execute_chat(self, node_id: str, node_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI chat model."""
        start_time = time.time()

        try:
            # Flatten options collection from frontend
            options = parameters.get('options', {})
            flattened = {**parameters, **options}

            # Extract parameters with camelCase/snake_case support for LangChain
            api_key = flattened.get('api_key') or flattened.get('apiKey')
            model = flattened.get('model', 'gpt-3.5-turbo')
            prompt = flattened.get('prompt', 'Hello')

            # System prompt/message - support multiple naming conventions
            system_prompt = (flattened.get('system_prompt') or
                           flattened.get('systemMessage') or
                           flattened.get('systemPrompt') or '')

            # Max tokens - support camelCase from frontend
            max_tokens = int(flattened.get('max_tokens') or
                           flattened.get('maxTokens') or 1000)

            temperature = float(flattened.get('temperature', 0.7))

            if not api_key:
                raise ValueError("API key is required")

            # Create model
            provider = self.detect_provider(model)
            chat_model = self.create_model(provider, api_key, model, temperature, max_tokens)

            # Prepare messages
            messages = []
            if system_prompt:
                messages.append(SystemMessage(content=system_prompt))
            messages.append(HumanMessage(content=prompt))

            # Execute
            response = chat_model.invoke(messages)

            result = {
                "response": response.content,
                "model": model,
                "provider": provider,
                "finish_reason": "stop",
                "timestamp": datetime.now().isoformat(),
                "input": {
                    "prompt": prompt,
                    "system_prompt": system_prompt,
                }
            }

            log_execution_time(logger, "ai_chat", start_time, time.time())
            log_api_call(logger, provider, model, "chat", True)

            return {
                "success": True,
                "node_id": node_id,
                "node_type": node_type,
                "result": result,
                "execution_time": time.time() - start_time
            }

        except Exception as e:
            logger.error("AI execution failed", node_id=node_id, error=str(e))
            log_api_call(logger, provider if 'provider' in locals() else 'unknown',
                        model if 'model' in locals() else 'unknown', "chat", False, error=str(e))

            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": str(e),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

    async def execute_agent(self, node_id: str, parameters: Dict[str, Any],
                            memory_data: Optional[Dict[str, Any]] = None,
                            broadcaster = None) -> Dict[str, Any]:
        """Execute AI Agent using LangGraph state machine.

        This method uses LangGraph for structured agent execution with:
        - State management via TypedDict
        - Conditional edges for future tool integration
        - Message accumulation via operator.add pattern
        - Real-time status broadcasts for UI animations

        Args:
            node_id: The node identifier
            parameters: Node parameters including prompt, model, etc.
            memory_data: Optional memory data from connected simpleMemory node
                        containing session_id, window_size for conversation history
            broadcaster: Optional StatusBroadcaster for real-time UI updates
        """
        start_time = time.time()
        provider = 'unknown'
        model = 'unknown'

        # Helper to broadcast status updates
        async def broadcast_status(phase: str, details: Dict[str, Any] = None):
            if broadcaster:
                await broadcaster.update_node_status(node_id, "executing", {
                    "phase": phase,
                    "agent_type": "langgraph",
                    **(details or {})
                })

        try:
            # Extract top-level parameters (always visible in UI)
            prompt = parameters.get('prompt', 'Hello')
            system_message = parameters.get('systemMessage', 'You are a helpful assistant')

            # Flatten options collection from frontend
            options = parameters.get('options', {})
            flattened = {**parameters, **options}

            # Extract parameters with camelCase/snake_case support
            api_key = flattened.get('api_key') or flattened.get('apiKey')
            provider = parameters.get('provider', 'openai')
            model = parameters.get('model', '')
            temperature = float(flattened.get('temperature', 0.7))
            max_tokens = int(flattened.get('max_tokens') or flattened.get('maxTokens') or 1000)

            logger.info(f"[LangGraph] AI Agent execution - Provider: {provider}, Model: {model}, Memory: {bool(memory_data)}")

            # If no model specified or model doesn't match provider, use default from registry
            if not model or not is_model_valid_for_provider(model, provider):
                old_model = model
                model = get_default_model(provider)
                if old_model:
                    logger.warning(f"Model '{old_model}' invalid for provider '{provider}', using default: {model}")
                else:
                    logger.info(f"No model specified, using default: {model}")

            if not api_key:
                raise ValueError("API key is required for AI Agent")

            # Broadcast: Initializing model
            await broadcast_status("initializing", {
                "message": f"Initializing {provider} model...",
                "provider": provider,
                "model": model
            })

            # Create LLM using the provider from node configuration
            logger.info(f"[LangGraph] Creating {provider} model: {model}")
            chat_model = self.create_model(provider, api_key, model, temperature, max_tokens)

            # Build initial messages for state
            initial_messages: List[BaseMessage] = []
            if system_message:
                initial_messages.append(SystemMessage(content=system_message))

            # Add memory history if connected simpleMemory node provided data
            session_id = None
            history_count = 0
            if memory_data and memory_data.get('session_id'):
                session_id = memory_data['session_id']
                window_size = memory_data.get('window_size')

                # Broadcast: Loading memory
                await broadcast_status("loading_memory", {
                    "message": f"Loading conversation history...",
                    "session_id": session_id,
                    "has_memory": True
                })

                # Get conversation history from database
                history_data = await self.database.get_conversation_messages(session_id, window_size)
                history_count = len(history_data)

                # Convert to LangChain messages
                for m in history_data:
                    if m['role'] == 'human':
                        initial_messages.append(HumanMessage(content=m['content']))
                    elif m['role'] == 'ai':
                        initial_messages.append(AIMessage(content=m['content']))

                logger.info(f"[LangGraph Memory] Loaded {history_count} messages from session '{session_id}'")

                # Broadcast: Memory loaded
                await broadcast_status("memory_loaded", {
                    "message": f"Loaded {history_count} messages from memory",
                    "session_id": session_id,
                    "history_count": history_count
                })

            # Add current user prompt
            initial_messages.append(HumanMessage(content=prompt))

            # Broadcast: Building graph
            await broadcast_status("building_graph", {
                "message": "Building LangGraph agent...",
                "message_count": len(initial_messages),
                "has_memory": bool(session_id),
                "history_count": history_count
            })

            # Build and execute LangGraph agent
            logger.info(f"[LangGraph] Building agent graph with {len(initial_messages)} initial messages")
            agent_graph = build_agent_graph(chat_model)

            # Create initial state
            initial_state: AgentState = {
                "messages": initial_messages,
                "tool_outputs": {},
                "iteration": 0,
                "max_iterations": 10,
                "should_continue": False
            }

            # Broadcast: Executing graph
            await broadcast_status("invoking_llm", {
                "message": f"Invoking {provider} LLM...",
                "provider": provider,
                "model": model,
                "iteration": 1,
                "has_memory": bool(session_id),
                "history_count": history_count
            })

            # Execute the graph
            final_state = agent_graph.invoke(initial_state)

            # Extract the AI response (last message in the accumulated messages)
            all_messages = final_state["messages"]
            ai_response = all_messages[-1] if all_messages else None

            if not ai_response or not hasattr(ai_response, 'content'):
                raise ValueError("No response generated from agent")

            response_content = ai_response.content
            iterations = final_state.get("iteration", 1)

            logger.info(f"[LangGraph] Agent completed in {iterations} iteration(s)")

            # Save to memory if connected (persist to database)
            if session_id:
                # Broadcast: Saving to memory
                await broadcast_status("saving_memory", {
                    "message": "Saving to conversation memory...",
                    "session_id": session_id,
                    "has_memory": True,
                    "history_count": history_count
                })

                await self.database.add_conversation_message(session_id, 'human', prompt)
                await self.database.add_conversation_message(session_id, 'ai', response_content)
                logger.info(f"[LangGraph Memory] Saved exchange to session '{session_id}'")

            result = {
                "response": response_content,
                "model": model,
                "provider": provider,
                "agent_type": "langgraph",
                "iterations": iterations,
                "finish_reason": "stop",
                "timestamp": datetime.now().isoformat(),
                "input": {
                    "prompt": prompt,
                    "system_message": system_message,
                }
            }

            # Add memory info if used
            if session_id:
                result["memory"] = {
                    "session_id": session_id,
                    "history_loaded": history_count
                }

            log_execution_time(logger, "ai_agent_langgraph", start_time, time.time())
            log_api_call(logger, provider, model, "agent", True)

            return {
                "success": True,
                "node_id": node_id,
                "node_type": "aiAgent",
                "result": result,
                "execution_time": time.time() - start_time
            }

        except Exception as e:
            logger.error("[LangGraph] AI agent execution failed", node_id=node_id, error=str(e))
            log_api_call(logger, provider, model, "agent", False, error=str(e))

            return {
                "success": False,
                "node_id": node_id,
                "node_type": "aiAgent",
                "error": str(e),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }