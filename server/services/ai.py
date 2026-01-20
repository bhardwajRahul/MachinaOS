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
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage, ToolMessage

# Conditional import for Cerebras (requires Python <3.13)
try:
    from langchain_cerebras import ChatCerebras
    CEREBRAS_AVAILABLE = True
except ImportError:
    ChatCerebras = None
    CEREBRAS_AVAILABLE = False
from langchain_core.tools import StructuredTool
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field, create_model
import json

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


def _openrouter_headers(api_key: str) -> dict:
    return {
        'Authorization': f'Bearer {api_key}',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'MachinaOS'
    }


def _groq_headers(api_key: str) -> dict:
    return {'Authorization': f'Bearer {api_key}'}


def _cerebras_headers(api_key: str) -> dict:
    return {'Authorization': f'Bearer {api_key}'}


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
    'openrouter': ProviderConfig(
        name='openrouter',
        model_class=ChatOpenAI,  # OpenRouter is OpenAI API compatible
        api_key_param='api_key',  # ChatOpenAI accepts 'api_key' as alias
        max_tokens_param='max_tokens',
        detection_patterns=('openrouter',),
        default_model='openai/gpt-4o-mini',
        models_endpoint='https://openrouter.ai/api/v1/models',
        models_header_fn=_openrouter_headers
    ),
    'groq': ProviderConfig(
        name='groq',
        model_class=ChatGroq,
        api_key_param='api_key',
        max_tokens_param='max_tokens',
        detection_patterns=('groq',),
        default_model='llama-3.3-70b-versatile',
        models_endpoint='https://api.groq.com/openai/v1/models',
        models_header_fn=_groq_headers
    ),
}

# Add Cerebras only if available (requires Python <3.13)
if CEREBRAS_AVAILABLE:
    PROVIDER_CONFIGS['cerebras'] = ProviderConfig(
        name='cerebras',
        model_class=ChatCerebras,
        api_key_param='api_key',
        max_tokens_param='max_tokens',
        detection_patterns=('cerebras',),
        default_model='llama-3.3-70b',
        models_endpoint='https://api.cerebras.ai/v1/models',
        models_header_fn=_cerebras_headers
    )


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
# MESSAGE FILTERING UTILITIES - Standardized for all providers
# =============================================================================

def is_valid_message_content(content: Any) -> bool:
    """Check if message content is valid (non-empty) for API calls.

    This is a standardized utility for validating message content before:
    - Saving to conversation memory
    - Including in API requests
    - Building message history

    Args:
        content: The message content to validate (str, list, or other)

    Returns:
        True if content is valid and non-empty, False otherwise
    """
    if content is None:
        return False

    # Handle list content format (Gemini returns [{"type": "text", "text": "..."}])
    if isinstance(content, list):
        return any(
            (isinstance(block, dict) and block.get('text', '').strip()) or
            (isinstance(block, str) and block.strip())
            for block in content
        )

    # Handle string content (most common)
    if isinstance(content, str):
        return bool(content.strip())

    # Other truthy content types
    return bool(content)


def filter_empty_messages(messages: Sequence[BaseMessage]) -> List[BaseMessage]:
    """Filter out messages with empty content to prevent API errors.

    This is a standardized utility that handles empty message filtering for all
    AI providers (OpenAI, Anthropic/Claude, Google Gemini, and future providers).

    Different providers have different sensitivities:
    - Gemini: Emits "HumanMessage with empty content was removed" warning
    - Claude/Anthropic: Throws errors for empty HumanMessage content
    - OpenAI: Generally tolerant but empty messages waste tokens

    This filter preserves:
    - ToolMessage: Always kept (contains tool execution results)
    - AIMessage with tool_calls: Kept even if content empty (tool calls are content)
    - SystemMessage: Kept only if has non-empty content
    - HumanMessage/others: Filtered if content is empty

    Args:
        messages: Sequence of LangChain BaseMessage objects

    Returns:
        Filtered list of messages with empty content removed
    """
    filtered = []

    for m in messages:
        # ToolMessage - always keep (contains tool execution results from LangGraph)
        if isinstance(m, ToolMessage):
            filtered.append(m)
            continue

        # AIMessage with tool_calls - keep even if content is empty
        # (the tool calls themselves are the meaningful content)
        if isinstance(m, AIMessage) and hasattr(m, 'tool_calls') and m.tool_calls:
            filtered.append(m)
            continue

        # SystemMessage - keep only if has non-empty content
        if isinstance(m, SystemMessage):
            if hasattr(m, 'content') and m.content and str(m.content).strip():
                filtered.append(m)
            continue

        # HumanMessage and other message types - filter out empty content
        if hasattr(m, 'content'):
            content = m.content

            # Handle list content format (Gemini returns [{"type": "text", "text": "..."}])
            if isinstance(content, list):
                has_content = any(
                    (isinstance(block, dict) and block.get('text', '').strip()) or
                    (isinstance(block, str) and block.strip())
                    for block in content
                )
                if has_content:
                    filtered.append(m)

            # Handle string content (most common)
            elif isinstance(content, str) and content.strip():
                filtered.append(m)

            # Handle other non-empty content types (keep if truthy)
            elif content:
                filtered.append(m)
        else:
            # Message without content attr - keep it (might be special message type)
            filtered.append(m)

    return filtered


# =============================================================================
# LANGGRAPH STATE MACHINE DEFINITIONS
# =============================================================================

class AgentState(TypedDict):
    """State for the LangGraph agent workflow.

    Uses Annotated with operator.add to accumulate messages over steps.
    This is the core pattern from LangGraph for stateful conversations.
    """
    messages: Annotated[Sequence[BaseMessage], operator.add]
    # Tool outputs storage
    tool_outputs: Dict[str, Any]
    # Tool calling support
    pending_tool_calls: List[Dict[str, Any]]  # Tool calls from LLM to execute
    # Agent metadata
    iteration: int
    max_iterations: int
    should_continue: bool


def create_agent_node(chat_model):
    """Create the agent node function for LangGraph.

    The agent node:
    1. Receives current state with messages
    2. Invokes the LLM
    3. Checks for tool calls in response
    4. Returns updated state with new AI message and pending tool calls
    """
    def agent_node(state: AgentState) -> Dict[str, Any]:
        """Process messages through the LLM and return response."""
        messages = state["messages"]
        iteration = state.get("iteration", 0)
        max_iterations = state.get("max_iterations", 10)

        logger.debug(f"[LangGraph] Agent node invoked, iteration={iteration}, messages={len(messages)}")

        # Filter out messages with empty content using standardized utility
        # Prevents API errors/warnings from Gemini, Claude, and other providers
        filtered_messages = filter_empty_messages(messages)

        if len(filtered_messages) != len(messages):
            logger.debug(f"[LangGraph] Filtered out {len(messages) - len(filtered_messages)} empty messages")

        # Invoke the model
        response = chat_model.invoke(filtered_messages)

        logger.debug(f"[LangGraph] LLM response type: {type(response).__name__}")

        # Check for Gemini-specific response attributes (safety ratings, block reason)
        if hasattr(response, 'response_metadata'):
            meta = response.response_metadata
            if meta.get('finish_reason') == 'SAFETY':
                logger.warning("[LangGraph] Gemini response blocked by safety filters")
            if meta.get('block_reason'):
                logger.warning(f"[LangGraph] Gemini block reason: {meta.get('block_reason')}")

        # Check for tool calls in the response
        pending_tool_calls = []
        should_continue = False

        if hasattr(response, 'tool_calls') and response.tool_calls:
            # Model wants to use tools
            pending_tool_calls = response.tool_calls
            should_continue = True
            logger.debug(f"[LangGraph] Agent requesting {len(pending_tool_calls)} tool call(s)")

        return {
            "messages": [response],  # Will be appended via operator.add
            "tool_outputs": {},
            "pending_tool_calls": pending_tool_calls,
            "iteration": iteration + 1,
            "max_iterations": max_iterations,
            "should_continue": should_continue
        }

    return agent_node


def create_tool_node(tool_executor: Callable):
    """Create an async tool execution node for LangGraph.

    The tool node:
    1. Receives pending tool calls from agent
    2. Executes each tool via the async tool_executor callback
    3. Returns ToolMessages with results for the agent

    Note: This returns an async function for use with ainvoke().
    LangGraph supports async node functions natively.
    """
    async def tool_node(state: AgentState) -> Dict[str, Any]:
        """Execute pending tool calls and return results as ToolMessages."""
        tool_messages = []

        for tool_call in state.get("pending_tool_calls", []):
            tool_name = tool_call.get("name", "unknown")
            tool_args = tool_call.get("args", {})
            tool_id = tool_call.get("id", "")

            logger.info(f"[LangGraph] Executing tool: {tool_name} (args={tool_args})")

            try:
                # Directly await the async tool executor (proper async pattern)
                result = await tool_executor(tool_name, tool_args)
                logger.info(f"[LangGraph] Tool {tool_name} returned: {str(result)[:100]}")
            except Exception as e:
                logger.error(f"[LangGraph] Tool execution failed: {tool_name}", error=str(e))
                result = {"error": str(e)}

            # Create ToolMessage with result
            tool_messages.append(ToolMessage(
                content=json.dumps(result, default=str),
                tool_call_id=tool_id,
                name=tool_name
            ))

            logger.info(f"[LangGraph] Tool {tool_name} completed, result added to messages")

        return {
            "messages": tool_messages,
            "pending_tool_calls": [],  # Clear pending after execution
        }

    return tool_node


def should_continue(state: AgentState) -> str:
    """Determine if the agent should continue or end.

    This is the conditional edge function for LangGraph.
    Returns "tools" to execute pending tool calls, or "end" to finish.
    """
    if state.get("should_continue", False):
        if state.get("iteration", 0) < state.get("max_iterations", 10):
            return "tools"
    return "end"


def build_agent_graph(chat_model, tools: List = None, tool_executor: Callable = None):
    """Build the LangGraph agent workflow with optional tool support.

    Architecture (with tools):
        START -> agent -> (conditional) -> tools -> agent -> ... -> END
                             |
                             +-> END (no tool calls)

    Architecture (without tools):
        START -> agent -> END

    Args:
        chat_model: The LangChain chat model
        tools: Optional list of LangChain tools to bind to the model
        tool_executor: Optional async callback to execute tools
    """
    # Create the graph with our state schema
    graph = StateGraph(AgentState)

    # Bind tools to model if provided
    model_with_tools = chat_model
    if tools:
        model_with_tools = chat_model.bind_tools(tools)
        logger.debug(f"[LangGraph] Bound {len(tools)} tools to model")

    # Add the agent node
    agent_fn = create_agent_node(model_with_tools)
    graph.add_node("agent", agent_fn)

    # Set entry point
    graph.set_entry_point("agent")

    if tools and tool_executor:
        # Add tool execution node
        tool_fn = create_tool_node(tool_executor)
        graph.add_node("tools", tool_fn)

        # Conditional routing: agent -> tools or end
        graph.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",
                "end": END
            }
        )

        # Tools always route back to agent
        graph.add_edge("tools", "agent")

        logger.debug("[LangGraph] Built graph with tool execution loop")
    else:
        # Simple graph without tools
        graph.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "agent",  # Fallback loop (shouldn't happen without tools)
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

    def _extract_text_content(self, content, ai_response=None) -> str:
        """Extract text content from various response formats.

        Handles:
        - String content (OpenAI, Anthropic)
        - List of content blocks (Gemini 3+ models)
        - Empty/None content with error details from metadata

        Args:
            content: The raw content from response (str, list, or None)
            ai_response: The full AIMessage for metadata inspection

        Returns:
            Extracted text string

        Raises:
            ValueError: If content is empty with details about why
        """
        # Handle list content (Gemini format: [{"type": "text", "text": "..."}])
        if isinstance(content, list):
            text_parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get('type') == 'text' and block.get('text'):
                        text_parts.append(block['text'])
                    elif 'text' in block:
                        text_parts.append(str(block['text']))
                elif isinstance(block, str):
                    text_parts.append(block)
            extracted = '\n'.join(text_parts)
            if extracted.strip():
                return extracted
            # List was present but no text extracted
            logger.warning(f"[LangGraph] Content was list but no text extracted: {content}")

        # Handle string content
        if isinstance(content, str) and content.strip():
            return content

        # Content is empty - try to get error details from metadata
        error_details = []
        if ai_response and hasattr(ai_response, 'response_metadata'):
            meta = ai_response.response_metadata
            finish_reason = meta.get('finish_reason', '')

            if finish_reason == 'SAFETY':
                error_details.append("Content blocked by safety filters")
                # Try to get specific blocked categories
                safety_ratings = meta.get('safety_ratings', [])
                blocked = [r.get('category') for r in safety_ratings if r.get('blocked')]
                if blocked:
                    error_details.append(f"Blocked categories: {', '.join(blocked)}")

            elif finish_reason == 'MAX_TOKENS':
                # Check if reasoning consumed all tokens
                token_details = meta.get('output_token_details', {})
                reasoning_tokens = token_details.get('reasoning', 0)
                output_tokens = meta.get('usage_metadata', {}).get('candidates_token_count', 0)
                if reasoning_tokens > 0 and output_tokens == 0:
                    error_details.append(f"Model used all tokens for reasoning ({reasoning_tokens} tokens). Try increasing max_tokens or simplifying the prompt.")
                else:
                    error_details.append("Response truncated due to max_tokens limit")

            elif finish_reason == 'MALFORMED_FUNCTION_CALL':
                error_details.append("Model returned malformed function call. Tool schema may be incompatible.")

            if meta.get('block_reason'):
                error_details.append(f"Block reason: {meta.get('block_reason')}")

        if error_details:
            raise ValueError(f"AI returned empty response. {'; '.join(error_details)}")

        # Generic empty response
        logger.warning(f"[LangGraph] Empty response with no error details. Content type: {type(content)}, value: {content}")
        raise ValueError("AI generated empty response. Try rephrasing your prompt or using a different model.")

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

        # OpenRouter uses OpenAI-compatible API with custom base_url
        if provider == 'openrouter':
            kwargs['base_url'] = 'https://openrouter.ai/api/v1'
            kwargs['default_headers'] = {
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'MachinaOS'
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

            elif provider == 'openrouter':
                response = await client.get(
                    'https://openrouter.ai/api/v1/models',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                response.raise_for_status()
                data = response.json()

                free_models = []
                paid_models = []
                for model in data.get('data', []):
                    model_id = model.get('id', '')
                    arch = model.get('architecture', {})
                    modality = arch.get('modality', '')
                    if 'text' in modality and model_id:
                        pricing = model.get('pricing', {})
                        prompt_price = float(pricing.get('prompt', '0') or '0')
                        completion_price = float(pricing.get('completion', '0') or '0')
                        is_free = prompt_price == 0 and completion_price == 0
                        # Add [FREE] tag to free models
                        display_name = f"[FREE] {model_id}" if is_free else model_id
                        if is_free:
                            free_models.append(display_name)
                        else:
                            paid_models.append(display_name)

                # Return free models first, then paid models (both sorted)
                return sorted(free_models) + sorted(paid_models)

            elif provider == 'groq':
                response = await client.get(
                    'https://api.groq.com/openai/v1/models',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                response.raise_for_status()
                data = response.json()

                models = []
                for model in data.get('data', []):
                    model_id = model.get('id', '')
                    # Include all models from Groq API
                    if model_id:
                        models.append(model_id)

                return sorted(models)

            elif provider == 'cerebras':
                response = await client.get(
                    'https://api.cerebras.ai/v1/models',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                response.raise_for_status()
                data = response.json()

                models = []
                for model in data.get('data', []):
                    model_id = model.get('id', '')
                    # Include all models from Cerebras API
                    if model_id:
                        models.append(model_id)

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
            # Strip [FREE] prefix if present (added by OpenRouter model list for display)
            if model.startswith('[FREE] '):
                model = model[7:]
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

            # Validate prompt is not empty (prevents wasted API calls for all providers)
            if not is_valid_message_content(prompt):
                raise ValueError("Prompt cannot be empty")

            # Determine provider from node_type (more reliable than model name detection)
            # OpenRouter models have format like "openai/gpt-4o" which would incorrectly detect as openai
            if node_type == 'openrouterChatModel':
                provider = 'openrouter'
            elif node_type == 'groqChatModel':
                provider = 'groq'
            elif node_type == 'cerebrasChatModel':
                provider = 'cerebras'
            else:
                provider = self.detect_provider(model)
            chat_model = self.create_model(provider, api_key, model, temperature, max_tokens)

            # Prepare messages
            messages = []
            if system_prompt and is_valid_message_content(system_prompt):
                messages.append(SystemMessage(content=system_prompt))
            messages.append(HumanMessage(content=prompt))

            # Filter messages using standardized utility (handles all providers consistently)
            filtered_messages = filter_empty_messages(messages)

            # Execute
            response = chat_model.invoke(filtered_messages)

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
                            tool_data: Optional[List[Dict[str, Any]]] = None,
                            broadcaster = None,
                            workflow_id: Optional[str] = None) -> Dict[str, Any]:
        """Execute AI Agent using LangGraph state machine.

        This method uses LangGraph for structured agent execution with:
        - State management via TypedDict
        - Tool calling via bind_tools and tool execution node
        - Message accumulation via operator.add pattern
        - Real-time status broadcasts for UI animations

        Args:
            node_id: The node identifier
            parameters: Node parameters including prompt, model, etc.
            memory_data: Optional memory data from connected simpleMemory node
                        containing session_id, window_size for conversation history
            tool_data: Optional list of tool configurations from connected tool nodes
            broadcaster: Optional StatusBroadcaster for real-time UI updates
            workflow_id: Optional workflow ID for scoped status broadcasts
        """
        start_time = time.time()
        provider = 'unknown'
        model = 'unknown'

        # EARLY LOG: Entry point for debugging
        logger.info(f"[AIAgent] execute_agent called: node_id={node_id}, workflow_id={workflow_id}, tool_data_count={len(tool_data) if tool_data else 0}")
        if tool_data:
            for i, td in enumerate(tool_data):
                logger.info(f"[AIAgent] Tool {i}: type={td.get('node_type')}, node_id={td.get('node_id')}")

        # Helper to broadcast status updates with workflow_id for proper scoping
        async def broadcast_status(phase: str, details: Dict[str, Any] = None):
            if broadcaster:
                await broadcaster.update_node_status(node_id, "executing", {
                    "phase": phase,
                    "agent_type": "langgraph",
                    **(details or {})
                }, workflow_id=workflow_id)

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

            logger.info(f"[LangGraph] Agent: {provider}/{model}, tools={len(tool_data) if tool_data else 0}")

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
            logger.debug(f"[LangGraph] Creating {provider} model: {model}")
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

                # Convert to LangChain messages using standardized content validation
                for m in history_data:
                    content = m.get('content', '')
                    if not is_valid_message_content(content):
                        logger.debug(f"[LangGraph Memory] Skipping empty {m['role']} message")
                        continue
                    if m['role'] == 'human':
                        initial_messages.append(HumanMessage(content=content))
                    elif m['role'] == 'ai':
                        initial_messages.append(AIMessage(content=content))

                logger.info(f"[LangGraph Memory] Loaded {history_count} messages from session '{session_id}'")

                # Broadcast: Memory loaded
                await broadcast_status("memory_loaded", {
                    "message": f"Loaded {history_count} messages from memory",
                    "session_id": session_id,
                    "history_count": history_count
                })

            # Add current user prompt
            initial_messages.append(HumanMessage(content=prompt))

            # Build tools if provided
            tools = []
            tool_configs = {}

            if tool_data:
                await broadcast_status("building_tools", {
                    "message": f"Building {len(tool_data)} tool(s)...",
                    "tool_count": len(tool_data)
                })

                for tool_info in tool_data:
                    tool, config = await self._build_tool_from_node(tool_info)
                    if tool:
                        tools.append(tool)
                        tool_configs[tool.name] = config
                        logger.info(f"[LangGraph] Registered tool: name={tool.name}, node_id={config.get('node_id')}")

                logger.debug(f"[LangGraph] Built {len(tools)} tools")

            # Create tool executor callback
            async def tool_executor(tool_name: str, tool_args: Dict) -> Any:
                """Execute a tool by name."""
                from services.handlers.tools import execute_tool

                config = tool_configs.get(tool_name, {})
                tool_node_id = config.get('node_id')

                logger.info(f"[LangGraph] tool_executor called: tool_name={tool_name}, node_id={tool_node_id}, workflow_id={workflow_id}")

                # Broadcast executing status to the AI Agent node
                await broadcast_status("executing_tool", {
                    "message": f"Executing tool: {tool_name}",
                    "tool_name": tool_name,
                    "tool_args": tool_args
                })

                # Also broadcast executing status directly to the tool node so it glows
                if tool_node_id and broadcaster:
                    await broadcaster.update_node_status(
                        tool_node_id,
                        "executing",
                        {"message": f"Executing {tool_name}"},
                        workflow_id=workflow_id
                    )

                # Include workflow_id in config so tool handlers can broadcast with proper scoping
                config['workflow_id'] = workflow_id

                try:
                    result = await execute_tool(tool_name, tool_args, config)

                    # Broadcast completion to AI Agent node
                    await broadcast_status("tool_completed", {
                        "message": f"Tool completed: {tool_name}",
                        "tool_name": tool_name,
                        "result_preview": str(result)[:100]
                    })

                    # Broadcast success status to the tool node
                    if tool_node_id and broadcaster:
                        logger.info(f"[LangGraph] Broadcasting success to tool node: node_id={tool_node_id}, workflow_id={workflow_id}")
                        await broadcaster.update_node_status(
                            tool_node_id,
                            "success",
                            {"message": f"{tool_name} completed", "result": result},
                            workflow_id=workflow_id
                        )
                    else:
                        logger.warning(f"[LangGraph] Cannot broadcast success: tool_node_id={tool_node_id}, broadcaster={broadcaster is not None}")

                    return result

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"[LangGraph] Tool execution failed: {tool_name}", error=error_msg)

                    # Broadcast error status to the tool node so UI shows failure
                    if tool_node_id and broadcaster:
                        await broadcaster.update_node_status(
                            tool_node_id,
                            "error",
                            {"message": f"{tool_name} failed", "error": error_msg},
                            workflow_id=workflow_id
                        )

                    # Re-raise to let LangGraph handle the error
                    raise

            # Broadcast: Building graph
            await broadcast_status("building_graph", {
                "message": "Building LangGraph agent...",
                "message_count": len(initial_messages),
                "has_memory": bool(session_id),
                "history_count": history_count,
                "tool_count": len(tools)
            })

            # Build and execute LangGraph agent
            logger.debug(f"[LangGraph] Building agent graph with {len(initial_messages)} messages")
            agent_graph = build_agent_graph(
                chat_model,
                tools=tools if tools else None,
                tool_executor=tool_executor if tools else None
            )

            # Create initial state
            initial_state: AgentState = {
                "messages": initial_messages,
                "tool_outputs": {},
                "pending_tool_calls": [],
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

            # Execute the graph using ainvoke for proper async support
            # This allows async tool nodes and WebSocket broadcasts to work correctly
            final_state = await agent_graph.ainvoke(initial_state)

            # Extract the AI response (last message in the accumulated messages)
            all_messages = final_state["messages"]
            ai_response = all_messages[-1] if all_messages else None

            if not ai_response or not hasattr(ai_response, 'content'):
                raise ValueError("No response generated from agent")

            # Handle different content formats (Gemini can return list of content blocks)
            raw_content = ai_response.content
            response_content = self._extract_text_content(raw_content, ai_response)
            iterations = final_state.get("iteration", 1)

            logger.info(f"[LangGraph] Agent completed in {iterations} iteration(s)")

            # Save to memory if connected (persist to database)
            # Only save non-empty messages using standardized validation
            if session_id and is_valid_message_content(prompt) and is_valid_message_content(response_content):
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

    async def _build_tool_from_node(self, tool_info: Dict[str, Any]) -> tuple:
        """Convert a node configuration into a LangChain StructuredTool.

        Uses database-stored schema as source of truth if available, otherwise
        falls back to dynamic schema generation.

        Args:
            tool_info: Dict containing node_id, node_type, parameters, label, connected_services (for androidTool)

        Returns:
            Tuple of (StructuredTool, config_dict) or (None, None) on failure
        """
        # Default tool names matching frontend toolNodes.ts definitions
        DEFAULT_TOOL_NAMES = {
            'calculatorTool': 'calculator',
            'currentTimeTool': 'get_current_time',
            'webSearchTool': 'web_search',
            'androidTool': 'android_device',
        }
        DEFAULT_TOOL_DESCRIPTIONS = {
            'calculatorTool': 'Perform mathematical calculations. Operations: add, subtract, multiply, divide, power, sqrt, mod, abs',
            'currentTimeTool': 'Get the current date and time. Optionally specify timezone.',
            'webSearchTool': 'Search the web for information. Returns relevant search results.',
            'androidTool': 'Control Android device. Available services are determined by connected nodes.',
        }

        try:
            node_type = tool_info.get('node_type', '')
            node_params = tool_info.get('parameters', {})
            node_label = tool_info.get('label', node_type)
            node_id = tool_info.get('node_id', '')
            connected_services = tool_info.get('connected_services', [])

            # Check database for stored schema (source of truth)
            db_schema = await self.database.get_tool_schema(node_id) if node_id else None

            if db_schema:
                # Use database schema as source of truth
                logger.debug(f"[LangGraph] Using DB schema for tool node {node_id}")
                tool_name = db_schema.get('tool_name', DEFAULT_TOOL_NAMES.get(node_type, f"tool_{node_label}"))
                tool_description = db_schema.get('tool_description', DEFAULT_TOOL_DESCRIPTIONS.get(node_type, f"Execute {node_label}"))
                # Use stored connected_services if available (for toolkit nodes)
                if db_schema.get('connected_services'):
                    connected_services = db_schema['connected_services']
            else:
                # Fall back to dynamic generation from node params
                tool_name = (
                    node_params.get('toolName') or
                    DEFAULT_TOOL_NAMES.get(node_type) or
                    f"tool_{node_label}".replace(' ', '_').replace('-', '_').lower()
                )
                tool_description = (
                    node_params.get('toolDescription') or
                    DEFAULT_TOOL_DESCRIPTIONS.get(node_type) or
                    f"Execute {node_label} node"
                )

            # For androidTool, enhance description with connected services
            if node_type == 'androidTool' and connected_services:
                service_names = [s.get('label') or s.get('service_id', 'unknown') for s in connected_services]
                tool_description = f"{tool_description} Connected: {', '.join(service_names)}"

            # Clean tool name (LangChain requires alphanumeric + underscores)
            import re
            tool_name = re.sub(r'[^a-zA-Z0-9_]', '_', tool_name)

            # Build schema based on node type - pass connected_services for androidTool
            # If DB has schema_config, use it to build custom schema, otherwise use dynamic
            schema_params = dict(node_params)
            if connected_services:
                schema_params['connected_services'] = connected_services
            if db_schema and db_schema.get('schema_config'):
                schema_params['db_schema_config'] = db_schema['schema_config']
            schema = self._get_tool_schema(node_type, schema_params)

            # Create StructuredTool - the func is a placeholder, actual execution via tool_executor
            def placeholder_func(**kwargs):
                return kwargs

            tool = StructuredTool.from_function(
                name=tool_name,
                description=tool_description,
                func=placeholder_func,
                args_schema=schema
            )

            # Build config dict - include connected_services for toolkit nodes
            config = {
                'node_type': node_type,
                'node_id': node_id,
                'parameters': node_params,
                'label': node_label,
                'connected_services': connected_services  # Pass through for execution
            }

            logger.debug(f"[LangGraph] Built tool '{tool_name}' with node_id={node_id}")
            return tool, config

        except Exception as e:
            logger.error(f"[LangGraph] Failed to build tool from node: {e}")
            return None, None

    def _get_tool_schema(self, node_type: str, params: Dict[str, Any]) -> Type[BaseModel]:
        """Get Pydantic schema for tool based on node type.

        Uses db_schema_config from database if available (source of truth),
        otherwise falls back to built-in schema definitions.

        Args:
            node_type: The node type (e.g., 'calculatorTool', 'httpRequest')
            params: Node parameters, may include db_schema_config from database

        Returns:
            Pydantic BaseModel class for the tool's arguments
        """
        # Check if we have a database-stored schema config (source of truth)
        db_schema_config = params.get('db_schema_config')
        if db_schema_config:
            return self._build_schema_from_config(db_schema_config)

        # Calculator tool schema
        if node_type == 'calculatorTool':
            class CalculatorSchema(BaseModel):
                """Schema for calculator tool arguments."""
                operation: str = Field(
                    description="Math operation: add, subtract, multiply, divide, power, sqrt, mod, abs"
                )
                a: float = Field(description="First number")
                b: float = Field(default=0, description="Second number (not needed for sqrt, abs)")

            return CalculatorSchema

        # HTTP Request tool schema
        if node_type in ('httpRequest', 'httpRequestTool'):
            class HttpRequestSchema(BaseModel):
                """Schema for HTTP request tool arguments."""
                url: str = Field(description="URL path or full URL to request")
                method: str = Field(default="GET", description="HTTP method: GET, POST, PUT, DELETE")
                body: Optional[Dict[str, Any]] = Field(default=None, description="Request body as JSON object")

            return HttpRequestSchema

        # Python executor tool schema
        if node_type == 'pythonExecutor':
            class PythonCodeSchema(BaseModel):
                """Schema for Python code execution."""
                code: str = Field(description="Python code to execute")

            return PythonCodeSchema

        # Current time tool schema
        if node_type == 'currentTimeTool':
            class CurrentTimeSchema(BaseModel):
                """Schema for current time tool arguments."""
                timezone: str = Field(
                    default="UTC",
                    description="Timezone (e.g., UTC, America/New_York, Europe/London)"
                )

            return CurrentTimeSchema

        # Web search tool schema
        if node_type == 'webSearchTool':
            class WebSearchSchema(BaseModel):
                """Schema for web search tool arguments."""
                query: str = Field(description="Search query to look up on the web")

            return WebSearchSchema

        # WhatsApp send schema (existing node used as tool)
        if node_type == 'whatsappSend':
            class WhatsAppSendSchema(BaseModel):
                """Schema for WhatsApp send tool arguments."""
                phone_number: str = Field(description="Phone number to send message to (e.g., +1234567890)")
                message: str = Field(description="Message text to send")

            return WhatsAppSendSchema

        # Android toolkit schema - dynamic based on connected services
        # Follows LangChain dynamic tool binding pattern
        if node_type == 'androidTool':
            connected_services = params.get('connected_services', [])

            if not connected_services:
                # No services connected - minimal schema with helpful error
                class EmptyAndroidSchema(BaseModel):
                    """Android toolkit with no connected services."""
                    query: str = Field(
                        default="status",
                        description="No Android services connected. Connect Android nodes to the toolkit."
                    )
                return EmptyAndroidSchema

            # Build dynamic service list for schema description
            from services.android_service import SERVICE_ACTIONS

            service_info = []
            for svc in connected_services:
                svc_id = svc.get('service_id') or svc.get('node_type', 'unknown')
                actions = SERVICE_ACTIONS.get(svc_id, [])
                action_list = [a['value'] for a in actions] if actions else ['status']
                service_info.append(f"{svc_id}: {'/'.join(action_list)}")

            services_description = "; ".join(service_info)

            class AndroidToolSchema(BaseModel):
                """Schema for Android device control via connected services."""
                service_id: str = Field(
                    description=f"Service to use. Connected: {services_description}"
                )
                action: str = Field(
                    description="Action to perform (see service list for available actions)"
                )
                parameters: Optional[Dict[str, Any]] = Field(
                    default=None,
                    description="Action parameters. Examples: {package_name: 'com.app'} for app_launcher, {volume: 50} for audio"
                )

            return AndroidToolSchema

        # Generic schema for other nodes
        class GenericToolSchema(BaseModel):
            """Generic schema for tool arguments."""
            input: str = Field(description="Input data for the tool")

        return GenericToolSchema

    def _build_schema_from_config(self, schema_config: Dict[str, Any]) -> Type[BaseModel]:
        """Build a Pydantic schema from database-stored configuration.

        Schema config format:
        {
            "description": "Schema description",
            "fields": {
                "field_name": {
                    "type": "string" | "number" | "boolean" | "object" | "array",
                    "description": "Field description",
                    "required": True | False,
                    "default": <optional default value>,
                    "enum": [<optional enum values>]
                }
            }
        }
        """
        fields_config = schema_config.get('fields', {})
        schema_description = schema_config.get('description', 'Tool arguments schema')

        # Build field annotations and defaults
        annotations = {}
        field_defaults = {}

        TYPE_MAP = {
            'string': str,
            'number': float,
            'integer': int,
            'boolean': bool,
            'object': Dict[str, Any],
            'array': list,
        }

        for field_name, field_config in fields_config.items():
            field_type_str = field_config.get('type', 'string')
            field_type = TYPE_MAP.get(field_type_str, str)
            field_description = field_config.get('description', '')
            is_required = field_config.get('required', True)
            default_value = field_config.get('default')
            enum_values = field_config.get('enum')

            # Handle optional fields
            if not is_required:
                field_type = Optional[field_type]

            annotations[field_name] = field_type

            # Build Field with description and enum if provided
            field_kwargs = {'description': field_description}
            if enum_values:
                # For enums, include in description since Pydantic Field doesn't support enum directly
                field_kwargs['description'] = f"{field_description} Options: {', '.join(str(v) for v in enum_values)}"

            if default_value is not None:
                field_defaults[field_name] = Field(default=default_value, **field_kwargs)
            elif not is_required:
                field_defaults[field_name] = Field(default=None, **field_kwargs)
            else:
                field_defaults[field_name] = Field(**field_kwargs)

        # Create dynamic Pydantic model
        DynamicSchema = create_model(
            'DynamicToolSchema',
            __doc__=schema_description,
            **{name: (annotations[name], field_defaults[name]) for name in annotations}
        )

        return DynamicSchema