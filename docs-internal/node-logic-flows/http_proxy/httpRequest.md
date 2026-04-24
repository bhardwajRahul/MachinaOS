# HTTP Request (`httpRequest`)

| Field | Value |
|------|-------|
| **Category** | utility / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/http.py::handle_http_request`](../../../server/services/handlers/http.py) |
| **Tests** | [`server/tests/nodes/test_http_proxy.py`](../../../server/tests/nodes/test_http_proxy.py) |
| **Skill (if any)** | [`server/skills/web_agent/http-request-skill/SKILL.md`](../../../server/skills/web_agent/http-request-skill/SKILL.md) |
| **Dual-purpose tool** | yes - exposed to agents as a generic HTTP tool |

## Purpose

General-purpose outbound HTTP client used in workflows to call third-party
REST APIs. Supports all common methods, custom headers, JSON/text bodies,
and a transparent `useProxy` flag that routes the request through the
configured residential proxy provider via `ProxyService`.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream trigger; parameters template-resolved before the handler runs |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `method` | options | `GET` | no | - | One of `GET` / `POST` / `PUT` / `DELETE` / `PATCH` |
| `url` | string | `""` | **yes** | - | Target URL; empty value short-circuits with `URL is required` |
| `headers` | string (JSON) | `"{}"` | no | - | JSON object; invalid JSON silently falls back to `{}` |
| `body` | string | `""` | no | `method in [POST, PUT, PATCH]` | Sent as JSON when parseable, else as raw content |
| `timeout` | number | `30` | no | - | Seconds; coerced via `float(...)` |
| `useProxy` | boolean | `false` | no | - | Route through `ProxyService.get_proxy_url` |
| `proxyProvider` | string | `""` | no | `useProxy=true` | Specific provider name (empty -> auto-select) |
| `proxyCountry` | string | `""` | no | `useProxy=true` | ISO country code for geo-targeting |
| `sessionType` | options | `rotating` | no | `useProxy=true` | `rotating` or `sticky` |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Response envelope (see below) |

### Output payload

```ts
{
  status: number;              // HTTP status code
  data: any;                   // Parsed JSON body if possible, else text string
  headers: Record<string, string>;
  url: string;                 // Final URL after redirects (httpx default follows them)
  method: string;              // Echo of request method
  proxied: boolean;            // true iff a proxy URL was applied
}
```

Wrapped in the standard envelope: `{ success: <status<400>, node_id, node_type: 'httpRequest', result, execution_time, timestamp }`.

## Logic Flow

```mermaid
flowchart TD
  A[handle_http_request] --> B[Read method/url/headers/body/timeout]
  B --> C{url truthy?}
  C -- no --> Eerr[Return success=false<br/>error: URL is required]
  C -- yes --> D[Parse headers JSON<br/>fallback {} on JSONDecodeError]
  D --> E{useProxy?}
  E -- no --> G[httpx.AsyncClient timeout=timeout]
  E -- yes --> F[_get_proxy_url_if_enabled<br/>-> proxy_svc.get_proxy_url]
  F -- returns None --> G
  F -- returns url --> G2[httpx.AsyncClient proxy=proxy_url timeout=timeout]
  F -- raises --> G3[Log warning, proceed without proxy -> G]
  G --> H{method in POST/PUT/PATCH<br/>and body truthy?}
  G2 --> H
  G3 --> H
  H -- yes JSON parseable --> I[kwargs.json = parsed]
  H -- yes non-JSON --> I2[kwargs.content = body]
  H -- no --> I3[no body]
  I --> J[await client.request]
  I2 --> J
  I3 --> J
  J -- response --> K[response.json fallback text]
  K --> L[Return success=(status<400)<br/>with status/data/headers/url/method/proxied]
  J -- TimeoutException --> T[Return success=false<br/>error: Request timed out]
  J -- Exception --> Z[Return success=false<br/>error: str(e)]
```

## Decision Logic

- **Validation**: `url` empty -> raises `ValueError('URL is required')` caught by outer `try`.
- **Branches**:
  - `useProxy=true` -> attempt proxy lookup; swallow proxy errors and fall back to direct call.
  - Body handling depends on `method` and JSON-parseability of `body`.
- **Fallbacks**:
  - Invalid headers JSON -> `{}`.
  - Proxy service disabled / `get_proxy_url` raises -> proceed without proxy.
  - Non-JSON response body -> plain `text` string in `data`.
- **Error paths**:
  - `TimeoutException` (class name match) -> user-friendly `Request timed out after N seconds`.
  - Any other exception -> `str(e)` verbatim in envelope.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none (only `logger.info` / `logger.error`).
- **External API calls**: `client.request(method, url, ...)` to whatever URL the user supplied; optionally routed through a proxy URL provided by `ProxyService`.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: none directly; `ProxyService` may load proxy credentials via the auth service when `useProxy=true`.
- **Services**: `ProxyService` (optional, only when `useProxy=true`).
- **Python packages**: `httpx`.
- **Environment variables**: none (timeout comes from node params).

## Edge cases & known limits

- Proxy lookup errors are **swallowed** (`_get_proxy_url_if_enabled` logs a warning and returns `None`); the request then proceeds directly, silently losing the proxy. Downstream nodes can detect this by checking `result.proxied`.
- Timeout detection is by `type(e).__name__ == 'TimeoutException'` (string match) rather than `isinstance`; subclass hierarchy changes in httpx could bypass this branch.
- `success` in the envelope reflects `status < 400`, so non-2xx 3xx responses (e.g. unfollowed 302) count as success.
- The handler always wraps with `execution_time = time.time() - start_time`; no caching, no retry (retry is only implemented in `proxyRequest`).
- `response.url` (final URL) is stringified; for non-proxied requests with redirects disabled this equals the request URL.

## Related

- **Skills using this as a tool**: [`http-request-skill/SKILL.md`](../../../server/skills/web_agent/http-request-skill/SKILL.md)
- **Companion nodes**: [`proxyRequest`](./proxyRequest.md), [`proxyConfig`](./proxyConfig.md), [`proxyStatus`](./proxyStatus.md)
- **Architecture docs**: [Proxy Service](../../proxy_service.md)
