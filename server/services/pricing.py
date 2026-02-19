"""LLM pricing service for token cost calculation.

Provides cost calculation for all supported LLM providers based on official pricing.
Pricing is in USD per million tokens (MTok).
"""

from dataclasses import dataclass
from typing import Dict, Optional
from core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ModelPricing:
    """Pricing for a specific model."""
    input_per_mtok: float   # USD per 1M input tokens
    output_per_mtok: float  # USD per 1M output tokens
    cache_read_per_mtok: Optional[float] = None  # USD per 1M cache read tokens (Anthropic)
    reasoning_per_mtok: Optional[float] = None   # USD per 1M reasoning tokens (OpenAI o-series)


# Official pricing as of February 2026
# Sources: openai.com/api/pricing, anthropic.com/pricing, ai.google.dev/pricing,
#          groq.com/pricing, cerebras.ai/pricing
PRICING_REGISTRY: Dict[str, Dict[str, ModelPricing]] = {
    'openai': {
        # GPT-5 series
        'gpt-5.2': ModelPricing(1.75, 14.00),
        'gpt-5.1': ModelPricing(1.25, 10.00),
        'gpt-5': ModelPricing(1.25, 10.00),
        'gpt-5-mini': ModelPricing(0.25, 2.00),
        'gpt-5-nano': ModelPricing(0.05, 0.40),
        'gpt-5-pro': ModelPricing(15.00, 120.00),
        # O-series (reasoning models)
        'o3': ModelPricing(2.00, 8.00, reasoning_per_mtok=8.00),
        'o3-mini': ModelPricing(1.10, 4.40, reasoning_per_mtok=4.40),
        'o3-pro': ModelPricing(20.00, 80.00, reasoning_per_mtok=80.00),
        'o4-mini': ModelPricing(1.10, 4.40, reasoning_per_mtok=4.40),
        'o1': ModelPricing(15.00, 60.00, reasoning_per_mtok=60.00),
        'o1-mini': ModelPricing(1.10, 4.40, reasoning_per_mtok=4.40),
        # GPT-4 series
        'gpt-4o': ModelPricing(2.50, 10.00),
        'gpt-4o-mini': ModelPricing(0.15, 0.60),
        'gpt-4.1': ModelPricing(2.00, 8.00),
        'gpt-4.1-mini': ModelPricing(0.40, 1.60),
        'gpt-4.1-nano': ModelPricing(0.10, 0.40),
        'gpt-4-turbo': ModelPricing(10.00, 30.00),
        'gpt-4': ModelPricing(30.00, 60.00),
        # GPT-3.5
        'gpt-3.5-turbo': ModelPricing(0.50, 1.50),
        # Default fallback
        '_default': ModelPricing(2.50, 10.00),
    },
    'anthropic': {
        # Claude 4.x series
        'claude-opus-4.6': ModelPricing(5.00, 25.00, cache_read_per_mtok=0.50),
        'claude-opus-4.5': ModelPricing(5.00, 25.00, cache_read_per_mtok=0.50),
        'claude-opus-4.1': ModelPricing(15.00, 75.00, cache_read_per_mtok=1.50),
        'claude-opus-4': ModelPricing(15.00, 75.00, cache_read_per_mtok=1.50),
        'claude-sonnet-4.6': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
        'claude-sonnet-4.5': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
        'claude-sonnet-4': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
        'claude-haiku-4.5': ModelPricing(1.00, 5.00, cache_read_per_mtok=0.10),
        # Claude 3.x series (legacy)
        'claude-3-opus': ModelPricing(15.00, 75.00, cache_read_per_mtok=1.50),
        'claude-3-5-sonnet': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
        'claude-3-sonnet': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
        'claude-3-haiku': ModelPricing(0.25, 1.25, cache_read_per_mtok=0.03),
        'claude-3.5-haiku': ModelPricing(0.80, 4.00, cache_read_per_mtok=0.08),
        # Partial matches (for model names like claude-3-5-sonnet-20241022)
        'claude-opus': ModelPricing(5.00, 25.00, cache_read_per_mtok=0.50),
        'claude-sonnet': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
        'claude-haiku': ModelPricing(1.00, 5.00, cache_read_per_mtok=0.10),
        # Default fallback
        '_default': ModelPricing(3.00, 15.00, cache_read_per_mtok=0.30),
    },
    'gemini': {
        # Gemini 3.x series
        'gemini-3-pro': ModelPricing(2.00, 12.00),
        'gemini-3-flash': ModelPricing(0.50, 3.00),
        # Gemini 2.5 series
        'gemini-2.5-pro': ModelPricing(1.25, 10.00),
        'gemini-2.5-flash': ModelPricing(0.30, 2.50),
        'gemini-2.5-flash-lite': ModelPricing(0.10, 0.40),
        # Gemini 2.0 series
        'gemini-2.0-flash': ModelPricing(0.10, 0.40),
        'gemini-2.0-flash-lite': ModelPricing(0.08, 0.30),
        # Gemini 1.x series (legacy)
        'gemini-1.5-pro': ModelPricing(1.25, 5.00),
        'gemini-1.5-flash': ModelPricing(0.075, 0.30),
        'gemini-pro': ModelPricing(0.50, 1.50),
        # Default fallback
        '_default': ModelPricing(0.50, 2.50),
    },
    'groq': {
        # Llama 4 series
        'llama-4-scout': ModelPricing(0.11, 0.34),
        'llama-4-maverick': ModelPricing(0.20, 0.60),
        # Llama 3.x series
        'llama-3.3-70b': ModelPricing(0.59, 0.79),
        'llama-3.1-70b': ModelPricing(0.59, 0.79),
        'llama-3.1-8b': ModelPricing(0.05, 0.08),
        'llama3-70b': ModelPricing(0.59, 0.79),
        'llama3-8b': ModelPricing(0.05, 0.08),
        # Qwen series
        'qwen3-32b': ModelPricing(0.29, 0.59),
        'qwen-qwq-32b': ModelPricing(0.29, 0.59),
        # Mixtral
        'mixtral-8x7b': ModelPricing(0.24, 0.24),
        # GPT OSS
        'gpt-oss-20b': ModelPricing(0.075, 0.30),
        'gpt-oss-120b': ModelPricing(0.15, 0.60),
        # Default fallback
        '_default': ModelPricing(0.29, 0.59),
    },
    'cerebras': {
        # Llama series
        'llama-3.1-8b': ModelPricing(0.10, 0.10),
        'llama-3.1-70b': ModelPricing(0.60, 0.60),
        'llama-3.1-405b': ModelPricing(6.00, 12.00),
        'llama3.1-8b': ModelPricing(0.10, 0.10),
        'llama3.1-70b': ModelPricing(0.60, 0.60),
        # Qwen
        'qwen-3-32b': ModelPricing(0.20, 0.20),
        # Default fallback
        '_default': ModelPricing(0.60, 0.60),
    },
    'openrouter': {
        # OpenRouter passes through provider pricing
        # These are approximate defaults; actual cost depends on underlying provider
        '_default': ModelPricing(1.00, 5.00),
    },
}


class PricingService:
    """Service for calculating LLM token costs."""

    def __init__(self):
        self._registry = PRICING_REGISTRY

    def get_pricing(self, provider: str, model: str) -> ModelPricing:
        """Get pricing for a specific model.

        Uses partial matching: 'claude-3-5-sonnet-20241022' matches 'claude-3-5-sonnet'.
        Falls back to '_default' if no match found.

        Args:
            provider: Provider name (openai, anthropic, gemini, groq, cerebras, openrouter)
            model: Model name or ID

        Returns:
            ModelPricing with rates per million tokens
        """
        provider_lower = provider.lower()
        model_lower = model.lower() if model else ''

        provider_pricing = self._registry.get(provider_lower, {})

        # Try exact match first
        if model_lower in provider_pricing:
            return provider_pricing[model_lower]

        # Try partial match (model name starts with a known key)
        for model_key, pricing in provider_pricing.items():
            if model_key != '_default' and model_lower.startswith(model_key):
                return pricing

        # Try if any key is contained in the model name
        for model_key, pricing in provider_pricing.items():
            if model_key != '_default' and model_key in model_lower:
                return pricing

        # Fall back to provider default
        default_pricing = provider_pricing.get('_default')
        if default_pricing:
            return default_pricing

        # Ultimate fallback
        logger.warning(f"[Pricing] No pricing found for {provider}/{model}, using global default")
        return ModelPricing(1.00, 5.00)

    def calculate_cost(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0,
        reasoning_tokens: int = 0
    ) -> Dict[str, float]:
        """Calculate cost for token usage.

        Args:
            provider: LLM provider name
            model: Model name/ID
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            cache_read_tokens: Number of cache read tokens (Anthropic)
            cache_creation_tokens: Number of cache creation tokens (Anthropic)
            reasoning_tokens: Number of reasoning tokens (OpenAI o-series)

        Returns:
            Dict with cost breakdown:
            - input_cost: USD for input tokens
            - output_cost: USD for output tokens
            - cache_cost: USD for cache tokens
            - reasoning_cost: USD for reasoning tokens
            - total_cost: Total USD cost
        """
        pricing = self.get_pricing(provider, model)

        # Calculate costs (prices are per 1M tokens)
        input_cost = (input_tokens / 1_000_000) * pricing.input_per_mtok
        output_cost = (output_tokens / 1_000_000) * pricing.output_per_mtok

        # Cache costs (Anthropic pattern)
        cache_cost = 0.0
        if pricing.cache_read_per_mtok:
            # Cache reads are discounted (typically 10% of input price)
            cache_cost += (cache_read_tokens / 1_000_000) * pricing.cache_read_per_mtok
            # Cache creation is charged at 1.25x output rate
            cache_cost += (cache_creation_tokens / 1_000_000) * pricing.output_per_mtok * 1.25

        # Reasoning costs (OpenAI o-series)
        reasoning_cost = 0.0
        if pricing.reasoning_per_mtok and reasoning_tokens > 0:
            reasoning_cost = (reasoning_tokens / 1_000_000) * pricing.reasoning_per_mtok

        total_cost = input_cost + output_cost + cache_cost + reasoning_cost

        return {
            'input_cost': round(input_cost, 6),
            'output_cost': round(output_cost, 6),
            'cache_cost': round(cache_cost, 6),
            'reasoning_cost': round(reasoning_cost, 6),
            'total_cost': round(total_cost, 6),
        }

    def get_all_pricing(self) -> Dict[str, Dict[str, Dict[str, float]]]:
        """Get all pricing data for frontend display.

        Returns:
            Nested dict: {provider: {model: {input, output, cache_read, reasoning}}}
        """
        result = {}
        for provider, models in self._registry.items():
            result[provider] = {}
            for model, pricing in models.items():
                result[provider][model] = {
                    'input': pricing.input_per_mtok,
                    'output': pricing.output_per_mtok,
                    'cache_read': pricing.cache_read_per_mtok,
                    'reasoning': pricing.reasoning_per_mtok,
                }
        return result


# Singleton instance
_service: Optional[PricingService] = None


def get_pricing_service() -> PricingService:
    """Get the singleton PricingService instance."""
    global _service
    if _service is None:
        _service = PricingService()
    return _service
