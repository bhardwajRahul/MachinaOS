# Apify Actor (`apifyActor`)

| Field | Value |
|------|-------|
| **Category** | web_automation / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/apify.py::handle_apify_actor`](../../../server/services/handlers/apify.py) |
| **Tests** | [`server/tests/nodes/test_web_automation.py`](../../../server/tests/nodes/test_web_automation.py) |
| **Skill (if any)** | [`server/skills/web_agent/apify-skill/SKILL.md`](../../../server/skills/web_agent/apify-skill/SKILL.md) |
| **Dual-purpose tool** | yes |

## Purpose

Run an Apify actor (pre-built scraper / automation) via the official
`apify-client` async SDK, wait for it to finish, and return the dataset
items. Used for platforms that have no first-class integration in MachinaOs
(Instagram, TikTok, Twitter/X, LinkedIn, Facebook, YouTube, Google Search /
Maps, website content crawlers).

The handler merges two input sources into the actor's run-input dict: a raw
JSON string (`actorInput`) plus "quick helpers" specific to a handful of
curated actor ids (e.g. `instagramUrls` for `apify/instagram-scraper`).

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream trigger; not consumed directly |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `actorId` | options/string | `""` | **yes** | - | Actor id (e.g. `apify/instagram-scraper`) or `custom` |
| `customActorId` | string | `""` | yes if `actorId=custom` | `actorId=custom` | Used when `actorId=custom` |
| `actorInput` | string (JSON) | `"{}"` | no | - | Raw JSON run-input; invalid JSON silently becomes `{}` |
| `timeout` | number | `300` | no | - | Run timeout in seconds (SDK forwards as `timeout_secs`) |
| `maxResults` | number | `100` | no | - | Forwarded to `dataset.list_items(limit=...)` |
| `memory` | number | `1024` | no | - | Actor memory in MB (`memory_mbytes`) |
| `instagramUrls` | string | `""` | no | `actorId=apify/instagram-scraper` | Comma-separated -> `directUrls[]` |
| `tiktokProfiles` | string | `""` | no | `actorId=clockworks/tiktok-scraper` | Comma-separated -> `profiles[]` |
| `tiktokHashtags` | string | `""` | no | `actorId=clockworks/tiktok-scraper` | Comma-separated -> `hashtags[]` |
| `twitterSearchTerms` | string | `""` | no | `actorId=apidojo/tweet-scraper` | Comma-separated -> `searchTerms[]` |
| `twitterHandles` | string | `""` | no | `actorId=apidojo/tweet-scraper` | Comma-separated -> `twitterHandles[]` |
| `googleSearchQuery` | string | `""` | no | `actorId=apify/google-search-scraper` | -> `searchQuery` |
| `googleSearchPages` | number | `1` | no | `actorId=apify/google-search-scraper` | -> `maxPagesPerQuery` |
| `crawlerStartUrls` | string | `""` | no | `actorId=apify/website-content-crawler` | Comma-separated -> `startUrls[{url}]` |
| `crawlerMaxDepth` | number | `2` | no | `actorId=apify/website-content-crawler` | -> `maxCrawlDepth` |
| `crawlerMaxPages` | number | `50` | no | `actorId=apify/website-content-crawler` | -> `maxCrawlPages` |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |

### Output payload (success)

```ts
{
  run_id: string;
  actor_id: string;
  status: string;           // 'SUCCEEDED' / 'FAILED' / 'TIMED-OUT' / 'ABORTED' / other
  items: any[];             // dataset items up to maxResults
  item_count: number;
  dataset_id: string;
  compute_units: number;    // mapped from usageTotalUsd on the run
  started_at: string;
  finished_at: string;
}
```

On `FAILED` / `TIMED-OUT` / `ABORTED` the envelope is `success: false` with a
human error message AND a trimmed `result` dict carrying `run_id`, `actor_id`,
and `status` so downstream nodes can still diagnose.

## Logic Flow

```mermaid
flowchart TD
  A[handle_apify_actor] --> B[await _get_apify_client<br/>via container.auth_service.get_api_key 'apify']
  B -- token missing --> Enotk[Return error:<br/>Apify API token not configured]
  B -- token ok --> C[Read actorId, swap to customActorId if 'custom']
  C --> C1{actor_id empty?}
  C1 -- yes --> Eaid[Return error: Actor ID is required]
  C1 -- no --> D[_build_actor_input<br/>parse actorInput JSON else {}<br/>merge per-actor quick helpers]
  D --> E[Read timeout, maxResults, memory_mbytes]
  E --> F[client.actor id .call<br/>run_input, timeout_secs, memory_mbytes]
  F -- run_info None --> Enone[Return error:<br/>no result returned]
  F -- ok --> G{run_status?}
  G -- FAILED --> Gf[Return success=false<br/>error=errorMessage, result={run_id, actor_id, status}]
  G -- TIMED-OUT --> Gt[Return success=false<br/>error=Actor timed out]
  G -- ABORTED --> Ga[Return success=false<br/>error=Actor run was aborted]
  G -- other --> H{dataset_id truthy?}
  H -- yes --> H1[client.dataset id .list_items limit=maxResults<br/>items = list_result.items]
  H -- no --> H2[items = empty list]
  H1 & H2 --> I[Build result dict:<br/>run_id, actor_id, status, items, item_count,<br/>dataset_id, compute_units=usageTotalUsd,<br/>started_at, finished_at]
  I --> J[Return success envelope]
  F -- Exception --> K[Catch all:<br/>rewrite 401/Unauthorized -> 'Invalid API token'<br/>rewrite 404/not found -> 'Actor not found']
  K --> Eexc[Return error envelope]
```

## Decision Logic

- **Auth lookup**: `auth_service.get_api_key("apify", "default")` - a None
  return short-circuits with `Apify API token not configured`.
- **Actor id swap**: literal string `"custom"` triggers replacement with
  `customActorId` BEFORE the empty check. An empty `customActorId` still
  triggers the `Actor ID is required` error.
- **Run-input merge**:
  - `actorInput` parsed as JSON; string input that fails `json.loads` (or is
    empty/blank) silently becomes `{}`. Non-dict, non-string input becomes `{}`.
  - Quick helpers run even when `actorInput` already contains those keys -
    they OVERWRITE any existing value.
  - Quick helpers only fire for the five hard-coded actor ids.
- **Run statuses**: three status strings (`FAILED`, `TIMED-OUT`, `ABORTED`)
  produce `success=false` envelopes with specific error messages. Every other
  status (including `SUCCEEDED`, `RUNNING`, `READY`, etc.) proceeds to dataset
  fetch. Runs that stay `RUNNING` past the SDK's internal polling are expected
  to be handled by the SDK and should not reach here.
- **Empty dataset id**: `items = []`, no API call to the dataset endpoint.
- **Error string rewriting**: `str(e)` is pattern-matched for `401`,
  `Unauthorized`, `404`, and `not found` (case-insensitive for the last one)
  to produce friendlier user errors. All other exceptions bubble up as their
  `str(e)` text.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none.
- **External API calls**:
  - `POST https://api.apify.com/v2/acts/<actor_id>/runs` (via SDK `actor.call`)
  - `GET https://api.apify.com/v2/datasets/<dataset_id>/items?limit=<n>` (via SDK `dataset.list_items`)
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: `auth_service.get_api_key("apify", "default")` -> stored in
  the `EncryptedAPIKey` table under provider `apify`.
- **Services**: Apify platform (api.apify.com).
- **Python packages**: `apify-client` (>= async variant `ApifyClientAsync`).
- **Environment variables**: none (token lives in credentials DB).

## Edge cases & known limits

- **Invalid `actorInput` JSON is silent**: the run is sent with `{}` and may
  succeed unexpectedly (actor uses defaults) or fail with a validation error
  that surfaces in `errorMessage`.
- **Quick helpers overwrite raw input**: setting both `actorInput` JSON AND
  the per-actor helper means the helper wins. This is not documented in the
  frontend.
- **No streaming**: the handler blocks until the actor finishes or the SDK
  raises. `timeout` is the hard cap.
- **`compute_units` is misleading**: the value returned is `run.usageTotalUsd`
  (USD), not compute units. The key name is preserved for backward compat.
- **Error rewriting is substring-based**: an actor's genuine error message
  that contains the word "Unauthorized" or "not found" will be replaced with
  the generic MachinaOs error, masking the real cause.
- **No usage tracking**: unlike search / HTTP nodes, there is no
  `api_usage_metrics` row written for Apify calls.
- **Stale dataset on repeat runs**: `dataset.list_items(limit=maxResults)`
  always reads the run's default dataset; concurrent runs on the same actor
  use separate datasets per run (handled by Apify), but a user who supplies
  a custom `datasetId` via `actorInput` cannot influence which dataset the
  handler reads from.

## Related

- **Skills using this as a tool**: [`apify-skill/SKILL.md`](../../../server/skills/web_agent/apify-skill/SKILL.md)
- **Companion nodes**: [`browser`](./browser.md), [`crawleeScraper`](./crawleeScraper.md)
- **Architecture docs**: [Credentials Encryption](../../credentials_encryption.md)
