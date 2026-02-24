# API Cost Tracking and Pricing Service

## Overview

The pricing service provides centralized cost tracking for both LLM tokens and external API services (Twitter/X, Google Maps). It supports:

- **LLM Token Costs**: Per-model pricing with input/output/cache/reasoning token breakdown
- **API Service Costs**: Per-request/resource pricing for third-party APIs (Twitter/X, Google Maps, Search APIs)
- **Automatic Tracking**: HTTPX event hooks for transparent API call tracking
- **Manual Tracking**: Helper functions for services that don't use HTTPX

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Pricing Configuration                          │
│                 server/config/pricing.json                       │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐ │
│  │   llm     │  │    api    │  │ operation │  │  url_patterns │ │
│  │  pricing  │  │  pricing  │  │    _map   │  │               │ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PricingService                                │
│                 server/services/pricing.py                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ LLM Methods:                                                │ │
│  │  - get_pricing(provider, model) → ModelPricing             │ │
│  │  - calculate_cost(provider, model, tokens...) → cost dict  │ │
│  │                                                             │ │
│  │ API Methods:                                                │ │
│  │  - get_api_price(service, operation) → USD                 │ │
│  │  - map_action_to_operation(service, action) → operation    │ │
│  │  - calculate_api_cost(service, action, count) → cost dict  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ Manual Tracking   │ │ HTTPX Event Hooks │ │  AI Service       │
│ _track_*_usage()  │ │ tracked_http.py   │ │ _track_token_     │
│ maps.py           │ │                   │ │ usage() ai.py     │
│ twitter.py        │ │                   │ │                   │
└───────────────────┘ └───────────────────┘ └───────────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database Storage                            │
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │   APIUsageMetric       │  │     TokenUsageMetric           │ │
│  │   (twitter, maps)      │  │     (LLM token usage)          │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration: pricing.json

Located at `server/config/pricing.json`. User-editable with hot-reload support.

### Structure

```json
{
  "version": "2026.02",
  "last_updated": "2026-02-20",

  "llm": {
    "openai": {
      "gpt-5": {"input": 1.25, "output": 10.00},
      "o3": {"input": 2.00, "output": 8.00, "reasoning": 8.00},
      "_default": {"input": 2.50, "output": 10.00}
    },
    "anthropic": {
      "claude-opus-4.6": {"input": 5.00, "output": 25.00, "cache_read": 0.50},
      "_default": {"input": 3.00, "output": 15.00, "cache_read": 0.30}
    }
  },

  "api": {
    "google_maps": {
      "_description": "Google Maps pricing per request (USD)",
      "geocode": 0.005,
      "nearby_search": 0.032,
      "_default": 0.005
    },
    "twitter": {
      "_description": "X/Twitter Pay-Per-Use API pricing",
      "posts_read": 0.005,
      "content_create": 0.010,
      "user_read": 0.010
    },
    "brave_search": {
      "_description": "Brave Search API pricing (per query)",
      "web_search": 0.003,
      "_default": 0.003
    },
    "serper": {
      "_description": "Serper Google Search API pricing (per query)",
      "web_search": 0.001,
      "_default": 0.001
    },
    "perplexity": {
      "_description": "Perplexity Sonar API pricing (per request)",
      "sonar_search": 0.005,
      "sonar_pro_search": 0.005,
      "_default": 0.005
    }
  },

  "operation_map": {
    "google_maps": {
      "geocode": "geocode",
      "nearby_places": "nearby_search"
    },
    "twitter": {
      "tweet": "content_create",
      "search": "posts_read"
    },
    "brave_search": {
      "web_search": "web_search"
    },
    "serper": {
      "web_search": "web_search"
    },
    "perplexity": {
      "sonar_search": "sonar_search"
    }
  },

  "url_patterns": {
    "twitter": {
      "base": "https?://api\\.(twitter|x)\\.com",
      "actions": {
        "/2/tweets$": {"action": "content_create", "method": "POST"},
        "/2/tweets/search": {"action": "posts_read", "method": "GET", "count_path": "data.length"}
      }
    }
  }
}
```

### Sections

| Section | Purpose |
|---------|---------|
| `llm` | Per-model pricing in USD per million tokens (MTok). Supports `input`, `output`, `cache_read`, `reasoning` |
| `api` | Per-service pricing in USD per request/resource. Keys starting with `_` are metadata |
| `operation_map` | Maps handler action names to pricing operation keys |
| `url_patterns` | Regex patterns for automatic HTTPX tracking. `count_path` extracts resource count from response JSON |

## PricingService API

Singleton accessed via `get_pricing_service()`.

### LLM Methods

```python
from services.pricing import get_pricing_service

pricing = get_pricing_service()

# Get pricing for a model (partial matching supported)
model_pricing = pricing.get_pricing('anthropic', 'claude-3-5-sonnet-20241022')
# Returns ModelPricing(input_per_mtok=3.00, output_per_mtok=15.00, ...)

# Calculate cost for token usage
cost = pricing.calculate_cost(
    provider='anthropic',
    model='claude-3-5-sonnet',
    input_tokens=5000,
    output_tokens=1500,
    cache_read_tokens=200
)
# Returns: {
#   'input_cost': 0.015,
#   'output_cost': 0.0225,
#   'cache_cost': 0.00006,
#   'reasoning_cost': 0.0,
#   'total_cost': 0.03756
# }
```

### API Methods

```python
# Get price for a specific operation
price = pricing.get_api_price('twitter', 'content_create')  # 0.010

# Map handler action to pricing operation
op = pricing.map_action_to_operation('twitter', 'tweet')  # 'content_create'

# Calculate API cost
cost = pricing.calculate_api_cost('twitter', 'tweet', resource_count=1)
# Returns: {'operation': 'content_create', 'unit_cost': 0.010, 'resource_count': 1, 'total_cost': 0.01}
```

### Config Management

```python
# Get full config for frontend editing
config = pricing.get_config()

# Save updated config (updates last_updated, reloads registry)
pricing.save_config(updated_config)

# Force reload from disk
pricing.reload()
```

## Manual Tracking Pattern

For services that make API calls directly (not through HTTPX), use manual tracking functions.

### Example: Maps Service

```python
# server/services/maps.py

async def _track_maps_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Google Maps API usage."""
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('google_maps', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'google_maps',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    return cost_data

# Usage in handler:
async def geocode_location(self, node_id: str, parameters: Dict, context: Dict):
    # ... API call ...
    await _track_maps_usage(node_id, 'geocode', 1, context.get('workflow_id'))
```

### Example: Twitter Handler

```python
# server/services/handlers/twitter.py

async def _track_twitter_usage(node_id, action, resource_count=1, workflow_id=None, session_id="default"):
    # Same pattern as maps
    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('twitter', action, resource_count)
    # ... save to database ...

# Usage:
await _track_twitter_usage(node_id, 'tweet', 1, workflow_id, session_id)
```

### Example: Search Handler

```python
# server/services/handlers/search.py

async def _track_search_usage(node_id, service, action, resource_count=1, workflow_id=None, session_id="default"):
    # Same pattern as maps/twitter
    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost(service, action, resource_count)
    # ... save to database ...

# Usage in each handler:
await _track_search_usage(node_id, 'brave_search', 'web_search', 1, workflow_id, session_id)
await _track_search_usage(node_id, 'serper', 'web_search', 1, workflow_id, session_id)
await _track_search_usage(node_id, 'perplexity', 'sonar_search', 1, workflow_id, session_id)
```

## Automatic HTTPX Tracking

For services using `httpx.AsyncClient`, use the tracked client for transparent tracking.

### Usage

```python
from services.tracked_http import get_tracked_client, set_tracking_context

# Set context before making requests
set_tracking_context(node_id="twitter-1", session_id="user-123")

# Use tracked client - tracking happens automatically
client = get_tracked_client()
response = await client.post("https://api.twitter.com/2/tweets", json={...})
# Automatically tracked via response hook!
```

### How It Works

1. **Context Variables**: `set_tracking_context()` sets node_id, session_id, workflow_id in `contextvars`
2. **URL Matching**: Response hook matches URL against `url_patterns` in pricing.json
3. **Resource Counting**: `count_path` extracts resource count from response JSON (e.g., `data.length`)
4. **Fire-and-Forget**: `_save_metric()` runs as `asyncio.create_task()` to avoid blocking

### URL Pattern Format

```json
{
  "twitter": {
    "base": "https?://api\\.(twitter|x)\\.com",
    "actions": {
      "/2/tweets$": {"action": "content_create", "method": "POST"},
      "/2/tweets/search": {
        "action": "posts_read",
        "method": "GET",
        "count_path": "data.length"
      }
    }
  }
}
```

- `base`: Regex to match domain
- `actions`: Dict of endpoint patterns to action config
- `method`: HTTP method filter (`*` for any)
- `count_path`: Dot-notation path to extract count from response (e.g., `data.length`, `results.count`)

## Database Storage

### APIUsageMetric

For third-party API services (Twitter, Google Maps).

```python
class APIUsageMetric(SQLModel, table=True):
    __tablename__ = "api_usage_metrics"

    id: int
    timestamp: datetime
    session_id: str        # Index for aggregation
    node_id: str
    workflow_id: Optional[str]
    service: str           # 'twitter', 'google_maps'
    operation: str         # 'content_create', 'geocode'
    endpoint: str          # Handler action name
    resource_count: int    # Number of resources
    cost: float            # USD cost
```

### TokenUsageMetric

For LLM token usage (see memory_compaction.md for details).

```python
class TokenUsageMetric(SQLModel, table=True):
    __tablename__ = "token_usage_metrics"

    session_id: str
    node_id: str
    provider: str          # 'openai', 'anthropic'
    model: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    reasoning_tokens: int
    input_cost: float      # USD
    output_cost: float
    total_cost: float
```

### Database Methods

```python
# Save API usage
await db.save_api_usage_metric({
    'session_id': 'default',
    'node_id': 'twitter-1',
    'service': 'twitter',
    'operation': 'content_create',
    'endpoint': 'tweet',
    'resource_count': 1,
    'cost': 0.01
})

# Get usage summary (aggregated by service)
summary = await db.get_api_usage_summary(service='twitter')
# Returns: [{'service': 'twitter', 'total_resources': 50, 'total_cost': 0.5, 'execution_count': 45}]
```

## Frontend Display

The CredentialsModal displays usage statistics via `renderApiUsagePanel()`:

```typescript
// client/src/components/CredentialsModal.tsx

// Fetch usage data
const { getApiUsage, apiUsage, apiUsageLoading } = usePricing();
await getApiUsage('twitter');

// Render panel
{renderApiUsagePanel('twitter', 'Twitter')}
{renderApiUsagePanel('google_maps', 'Google Maps')}
```

### Display Format

- Collapsible panel with service icon and total cost tag
- Table with operation breakdown (operation name, count, unit cost, total cost)
- Refresh button to reload data
- Loading state while fetching

## Adding New Services

### 1. Add Pricing to pricing.json

```json
{
  "api": {
    "new_service": {
      "_description": "New Service API pricing",
      "read_operation": 0.001,
      "write_operation": 0.005
    }
  },
  "operation_map": {
    "new_service": {
      "get_data": "read_operation",
      "create_item": "write_operation"
    }
  }
}
```

### 2. Add Manual Tracking (if not using HTTPX)

```python
# server/services/handlers/new_service.py

async def _track_new_service_usage(node_id, action, count=1, workflow_id=None, session_id="default"):
    from core.container import container
    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('new_service', action, count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'new_service',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': count,
        'cost': cost_data.get('total_cost', 0.0)
    })
    return cost_data

# Call in handler:
await _track_new_service_usage(node_id, 'get_data', len(results), workflow_id)
```

### 3. Add URL Patterns (if using HTTPX)

```json
{
  "url_patterns": {
    "new_service": {
      "base": "https?://api\\.newservice\\.com",
      "actions": {
        "/v1/items$": {"action": "read_operation", "method": "GET", "count_path": "items.length"},
        "/v1/items$": {"action": "write_operation", "method": "POST"}
      }
    }
  }
}
```

### 4. Add Frontend Display

```typescript
// In CredentialsModal.tsx, in the relevant panel:
{renderApiUsagePanel('new_service', 'New Service')}
```

## Key Files

| File | Purpose |
|------|---------|
| `server/config/pricing.json` | Pricing configuration (user-editable) |
| `server/services/pricing.py` | PricingService with LLM and API cost calculation |
| `server/services/tracked_http.py` | HTTPX event hooks for automatic tracking |
| `server/services/maps.py` | Manual tracking example (`_track_maps_usage`) |
| `server/services/handlers/twitter.py` | Manual tracking example (`_track_twitter_usage`) |
| `server/services/handlers/search.py` | Manual tracking example (`_track_search_usage`) |
| `server/models/database.py` | `APIUsageMetric`, `TokenUsageMetric` models |
| `server/core/database.py` | `save_api_usage_metric()`, `get_api_usage_summary()` |
| `client/src/components/CredentialsModal.tsx` | `renderApiUsagePanel()` UI component |
| `client/src/hooks/usePricing.ts` | Frontend hook for pricing/usage data |
