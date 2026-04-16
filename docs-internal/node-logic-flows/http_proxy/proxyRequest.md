# Proxy Request (`proxyRequest`)

| Field | Value |
|------|-------|
| **Category** | proxy / tool (dual-purpose) |
| **Frontend definition** | [`client/src/nodeDefinitions/proxyNodes.ts`](../../../client/src/nodeDefinitions/proxyNodes.ts) |
| **Backend handler** | [`server/services/handlers/proxy.py::handle_proxy_request`](../../../server/services/handlers/proxy.py) |
| **Tests** | [`server/tests/nodes/test_http_proxy.py`](../../../server/tests/nodes/test_http_proxy.py) |
| **Skill (if any)** | [`server/skills/web_agent/http-request-skill/SKILL.md`](../../../server/skills/web_agent/http-request-skill/SKILL.md) (covers useProxy + proxyRequest) |
| **Dual-purpose tool** | yes - workflow node and AI tool |

## Purpose

Proxy-aware HTTP client with explicit retry / failover and per-attempt health
reporting. Unlike `httpRequest` (where `useProxy` is an optional flag),
`proxyRequest` is unconditional: it requires `ProxyService` to be enabled and
short-circuits if no provider is available. It additionally tracks cost and
latency per attempt and feeds them back into the provider's health score.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream trigger |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `method` | options | `GET` | no | - | `GET` / `POST` / `PUT` / `DELETE` / `PATCH` |
| `url` | string | `""` | **yes** | - | Target URL |
| `headers` | string (JSON) | `"{}"` | no | - | JSON object, falls back to `{}` on parse error |
| `body` | string | `""` | no | `method in [POST, PUT, PATCH]` | JSON if parseable else raw content |
| `timeout` | number | `30` | no | - | Seconds |
| `proxyProvider` | string | `""` | no | - | Specific provider name, empty for auto-select |
| `proxyCountry` | string | `""` | no | - | ISO country code |
| `sessionType` | options | `rotating` | no | - | `rotating` or `sticky` |
| `stickyDuration` | number | `300` | no | `sessionType=sticky` | Seconds (30-3600) |
| `maxRetries` | number | `3` | no | - | Number of retry attempts (`proxyMaxRetries` is also read) |
| `proxyFailover` | boolean | `true` | no | - | On failure, request a new proxy URL and retry |
| `followRedirects` | boolean | `true` | no | - | Declared in frontend; handler does not currently forward to httpx |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Proxy response envelope (see below) |

### Output payload (success)

```ts
{
  status: number;
  data: any;                   // JSON if parseable, else text
  headers: Record<string, string>;
  url: string;
  method: string;
  proxy_provider: string;      // echo of proxyProvider param (may be empty when auto-selected)
  latency_ms: number;          // round-trip time of the winning attempt
  bytes_transferred: number;   // len(response.content)
  attempt: number;             // 1-indexed attempt that succeeded
}
```

### Output payload (failure)

`{ success: false, error: "All N attempts failed. Last error: <str>", ... }` or a short-circuit error if proxy service is unavailable.

## Logic Flow

```mermaid
flowchart TD
  A[handle_proxy_request] --> B{proxy_svc.is_enabled?}
  B -- no --> Edis[Return success=false<br/>error: Proxy service not initialized]
  B -- yes --> C[Read method/url/headers/body/timeout/maxRetries/failover]
  C --> D{url truthy?}
  D -- no --> Eval[Return success=false<br/>error: URL is required]
  D -- yes --> E[Parse headers JSON; fallback {}]
  E --> F[await proxy_svc.get_proxy_url]
  F -- None --> Enop[Return success=false<br/>error: No proxy provider available]
  F -- url --> G[attempt = 0]
  G --> H[httpx.AsyncClient proxy=proxy_url timeout=timeout]
  H --> I{method in POST/PUT/PATCH and body?}
  I -- yes JSON --> J[kwargs.json]
  I -- yes non-JSON --> J2[kwargs.content]
  I -- no --> J3[no body]
  J --> K[await client.request]
  J2 --> K
  J3 --> K
  K -- response --> L[proxy_svc.report_result success=status<400]
  L --> M[_track_proxy_usage -> db.save_api_usage_metric]
  M --> N[Return success=(status<400) with status/data/headers/url/method/provider/latency_ms/bytes/attempt]
  K -- Exception --> R[proxy_svc.report_result success=False<br/>log warning]
  R --> S{failover and attempt<maxRetries?}
  S -- yes --> T[await get_proxy_url again<br/>on exception break]
  T --> H
  S -- no --> U[Return success=false<br/>error: All N attempts failed]
```

## Decision Logic

- **Validation**:
  - Service disabled -> short-circuit error envelope.
  - Empty `url` -> `ValueError` caught -> error envelope.
  - `get_proxy_url` returns `None` -> `No proxy provider available` error.
- **Branches**:
  - Retry loop runs up to `maxRetries + 1` times; `failover=false` breaks after first failure.
  - Body JSON-parseable -> `kwargs.json`, else `kwargs.content`.
- **Fallbacks**: invalid headers JSON -> `{}`.
- **Error paths**:
  - Per-attempt exception logged at `warning` and reported via `ProxyResult(success=False, error=...)`.
  - Final error string: `All <maxRetries+1> attempts failed. Last error: <last_error>`.
  - Outer unexpected exception -> `error: str(e)`.

## Side Effects

- **Database writes**: one row per successful attempt in `api_usage_metrics` via `database.save_api_usage_metric`, with `service=proxy_<provider_name>`, `operation=proxy_request`, `cost` computed as `bytes / 1GB * cost_per_gb` from `config/pricing.json`.
- **In-memory writes**: `proxy_svc.report_result(...)` mutates the provider's rolling history deque (length 100), which feeds `compute_score()`. The service also increments `_daily_spend_usd`.
- **Broadcasts**: none.
- **External API calls**: the target URL, tunneled through the selected proxy URL.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: `auth_service` stores proxy username/password under keys `proxy_<name>_username` / `proxy_<name>_password` (read by ProxyService when loading providers).
- **Services**: `ProxyService` (must be enabled), `PricingService` (read through `_track_proxy_usage` -> `pricing._config["proxy"]`), `Database`.
- **Python packages**: `httpx`.
- **Environment variables**: none directly; ProxyService reads daily budget from `Settings.proxy_budget_daily_usd`.

## Edge cases & known limits

- Failed attempts are **not** tracked in `api_usage_metrics` - only successful requests that returned a response. If every attempt raises, the DB sees nothing for that call.
- `followRedirects` is defined in the frontend but never forwarded to `httpx`; httpx default follows redirects.
- `provider_name` in the result echoes the `proxyProvider` param verbatim; when left empty (auto-select), the envelope shows `""` even though a specific provider was used.
- Retry loop re-requests a new proxy URL via `get_proxy_url` on each retry; if that call raises (e.g. `BudgetExceededError`), the retry loop silently `break`s and the envelope reports the previous network error rather than the budget exception.
- Cost tracking reads `pricing._config["proxy"]` directly - touching a private attribute. If the pricing config is missing a `proxy` section, `cost_per_gb` falls back to `0.0` and cost rows are still written with `cost=0`.

## Related

- **Skills using this as a tool**: [`http-request-skill/SKILL.md`](../../../server/skills/web_agent/http-request-skill/SKILL.md), [`proxy-config-skill/SKILL.md`](../../../server/skills/web_agent/proxy-config-skill/SKILL.md)
- **Companion nodes**: [`httpRequest`](./httpRequest.md), [`proxyConfig`](./proxyConfig.md), [`proxyStatus`](./proxyStatus.md)
- **Architecture docs**: [Proxy Service](../../proxy_service.md), [Pricing Service](../../pricing_service.md)
