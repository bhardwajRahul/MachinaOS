# Proxy Status (`proxyStatus`)

| Field | Value |
|------|-------|
| **Category** | proxy / tool |
| **Backend handler** | [`server/services/handlers/proxy.py::handle_proxy_status`](../../../server/services/handlers/proxy.py) |
| **Tests** | [`server/tests/nodes/test_http_proxy.py`](../../../server/tests/nodes/test_http_proxy.py) |
| **Skill (if any)** | [`server/skills/web_agent/proxy-config-skill/SKILL.md`](../../../server/skills/web_agent/proxy-config-skill/SKILL.md) |
| **Dual-purpose tool** | yes |

## Purpose

Read-only snapshot of the `ProxyService` runtime state: per-provider health
stats (score, success rate, latency, bytes transferred) and aggregate stats.
Used by the dashboard and by AI agents that need to reason about which
provider to target.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream trigger |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `providerFilter` | string | `""` | no | - | Declared in frontend; handler currently **ignores** it and returns all providers |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Status envelope (see below) |

### Output payload

```ts
{
  enabled: boolean;            // proxy_svc.is_enabled()
  providers: Array<ProviderStats>;  // [] when disabled
  stats: Record<string, any>;  // {} when disabled
}
```

`ProviderStats` is produced by `ProviderStats.model_dump()` and includes
`name`, `enabled`, `priority`, `score`, `success_rate`, `avg_latency_ms`,
`total_requests`, `total_bytes`, etc. (see `services/proxy/models.py`).

## Logic Flow

```mermaid
flowchart TD
  A[handle_proxy_status] --> B{proxy_svc and<br/>proxy_svc.is_enabled?}
  B -- no --> C[Return success=true<br/>result = enabled:false providers:[] stats:{}]
  B -- yes --> D[stats = proxy_svc.get_stats]
  D --> E[providers = proxy_svc.get_providers -> model_dump each]
  E --> F[Return success=true<br/>result = enabled:true providers stats]
  A -- Exception --> Eerr[Return success=false<br/>error: str(e)]
```

## Decision Logic

- **Validation**: none - no required params.
- **Branches**: service-disabled short-circuit returns `enabled=false` with empty collections; still `success=true`.
- **Fallbacks**: `providerFilter` is ignored - the handler always returns the full list.
- **Error paths**: only the outer `Exception` catch; returns `{success: false, error: str(e)}`.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none.
- **External API calls**: none.
- **File I/O**: none.
- **Subprocess**: none.
- **In-memory reads**: `ProxyService._providers` and rolling history deques.

## External Dependencies

- **Credentials**: none.
- **Services**: `ProxyService` (optional; handler tolerates disabled state).
- **Python packages**: none.
- **Environment variables**: none.

## Edge cases & known limits

- Even when proxy is disabled, the handler returns `success=true` with empty collections - callers need to inspect `result.enabled` rather than `success`.
- `providerFilter` is defined in the frontend UI but never applied in the backend; filtering must happen in the consumer.
- `ProviderStats.model_dump()` exposes every field including computed `score`; the shape is governed by `services/proxy/models.py::ProviderStats`.
- No locking around the read: if another request is mutating `ProxyService._providers` (e.g. `reload_providers` mid-flight), the returned list may reflect a partial state.

## Related

- **Skills using this as a tool**: [`proxy-config-skill/SKILL.md`](../../../server/skills/web_agent/proxy-config-skill/SKILL.md)
- **Companion nodes**: [`proxyConfig`](./proxyConfig.md), [`proxyRequest`](./proxyRequest.md), [`httpRequest`](./httpRequest.md)
- **Architecture docs**: [Proxy Service](../../proxy_service.md)
