# Twitter User (`twitterUser`)

| Field | Value |
|------|-------|
| **Category** | social / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/twitter.py::handle_twitter_user`](../../../server/services/handlers/twitter.py) |
| **Tests** | [`server/tests/nodes/test_twitter.py`](../../../server/tests/nodes/test_twitter.py) |
| **Skill (if any)** | [`server/skills/social_agent/twitter-user-skill/SKILL.md`](../../../server/skills/social_agent/twitter-user-skill/SKILL.md) |
| **Dual-purpose tool** | yes - tool name `twitter_user` |

## Purpose

Look up Twitter users and their social graph via `GET /2/users/me`,
`GET /2/users/by/username/:username`, `GET /2/users/:id`,
`GET /2/users/:id/followers`, and `GET /2/users/:id/following`. Works as a
workflow node and an AI agent tool. Every SDK call is wrapped in
`asyncio.to_thread(...)` since XDK is sync-only.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream data; not consumed directly - all inputs come from `parameters` |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `operation` | options | `me` | yes | - | `me` / `by_username` / `by_id` / `followers` / `following` |
| `username` | string | `""` | yes (by_username) | `operation: ['by_username']` | Handle without `@`. |
| `user_id` | string | `""` | yes (by_id), optional (followers/following) | `operation: ['by_id','followers','following']` | If omitted for followers/following, the authenticated user is used via `_get_my_user_id`. |
| `max_results` | number | `100` | no | `operation: ['followers','following']` | Clamped `max(1, min(requested, 1000))`. |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |
| `output-tool` | object | Same payload when invoked via `input-tools` |

### Output payload

`me` / `by_username` / `by_id`:

```ts
{
  id: string;
  username: string;
  name: string;
  profile_image_url: string | null;
  verified: boolean;            // defaults to false when API omits it
  description: string | null;
  created_at: string;           // str(...) - empty string when missing
}
```

`followers` / `following`:

```ts
{
  users: Array<UserData>;       // same shape as above
  count: number;
}
```

All wrapped in `{ success, result, execution_time }`. `me` / `by_username` /
`by_id` additionally take the `_success` path that wraps the dict as
`result` directly (no `action` field leaks through when the payload is already
a dict, thanks to `_success`'s dict-shortcut).

## Logic Flow

```mermaid
flowchart TD
  A[handle_twitter_user] --> B[_get_twitter_client]
  B -- no tokens --> Eauth[Return success=false<br/>error: Twitter not connected]
  B --> C[_do_twitter_user]
  C --> Dswitch{operation}
  Dswitch -- me --> M1[to_thread _sync_get_me<br/>user_fields=created_at, description]
  Dswitch -- by_username --> U1{username?}
  U1 -- no --> EV[raise ValueError Username is required]
  U1 -- yes --> U2[to_thread _sync_get_by_usernames]
  U2 --> U3{data list empty?}
  U3 -- yes --> EVn[raise ValueError User @handle not found]
  Dswitch -- by_id --> I1{user_id?}
  I1 -- no --> EV
  I1 -- yes --> I2[to_thread _sync_get_by_ids]
  I2 --> I3{data list empty?}
  I3 -- yes --> EVn
  Dswitch -- followers --> F1{user_id present?}
  F1 -- no --> F0[to_thread _get_my_user_id]
  F0 --> F2[to_thread _sync_get_followers]
  F1 -- yes --> F2
  Dswitch -- following --> G1{user_id present?}
  G1 -- no --> G0[to_thread _get_my_user_id]
  G0 --> G2[to_thread _sync_get_following]
  G1 -- yes --> G2
  Dswitch -- _ --> Eunk[raise ValueError Unknown operation]
  M1 --> K1[_format_user_data + _track_twitter_usage me 1]
  U2 --> K2[_format_user_data users 0 + _track_twitter_usage by_username 1]
  I2 --> K3[_format_user_data + _track_twitter_usage by_id 1]
  F2 --> K4[map _format_user_data + _track_twitter_usage followers len users]
  G2 --> K5[same for following]
  K1 --> OK[Return success envelope]
  K2 --> OK
  K3 --> OK
  K4 --> OK
  K5 --> OK

  C -. raises 401/403 .-> REF[_refresh_and_get_client] --> C
  C -. other Exception .-> EGEN[Return success=false<br/>error: str e]
```

## Decision Logic

- **Operation dispatch** uses a Python 3.10+ `match` / `case` block. Any value
  other than the five documented operations raises `ValueError(f"Unknown operation: {operation}")`.
- **Validation**:
  - `by_username`: empty `username` -> `ValueError("Username is required")`.
  - `by_id`: empty `user_id` -> `ValueError("User ID is required")`.
  - `followers` / `following`: missing `user_id` is **not** an error - handler
    falls back to `_get_my_user_id`.
- **Not-found handling**: `by_username` / `by_id` raise `ValueError` when the
  SDK returns an empty `data` list; the string is propagated as the envelope
  `error`.
- **Lazy auth refresh**: identical to `twitterSend` - any exception whose
  `str(e)` contains `401`/`403`/`Unauthorized`/`Forbidden` triggers one
  refresh-and-retry.
- **max_results clamping**: `max(1, min(requested, 1000))` for followers /
  following. Anything else is ignored.
- **Usage tracking**:
  - `me`/`by_username`/`by_id`: 1 resource.
  - `followers`/`following`: `len(users)` resources; skipped when the result
    list is empty.

## Side Effects

- **Database writes**: one `api_usage_metrics` row per successful operation
  (when at least one resource was returned).
- **Broadcasts**: none.
- **External API calls**:
  - `GET https://api.twitter.com/2/users/me` (always on `me`; also on
    followers/following when `user_id` omitted).
  - `GET https://api.twitter.com/2/users/by?usernames=...` (by_username).
  - `GET https://api.twitter.com/2/users?ids=...` (by_id).
  - `GET https://api.twitter.com/2/users/:id/followers` (followers).
  - `GET https://api.twitter.com/2/users/:id/following` (following).
  - Optional refresh: `POST https://api.twitter.com/2/oauth2/token`.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: OAuth tokens via `auth_service.get_oauth_tokens("twitter")`.
- **Services**: `PricingService`, `Database`, `TwitterOAuth` (refresh).
- **Python packages**: `xdk`.
- **Environment variables**: none.

## Edge cases & known limits

- **`max_results < 1`**: silently clamped to 1.
- **`max_results > 1000`**: silently clamped to 1000. The SDK may still paginate
  internally; only the first page is returned regardless.
- **Only first page for followers/following**: `_sync_get_followers` /
  `_sync_get_following` break after the first page - `next_token` is discarded.
- **Not-found vs. empty**: when the target user exists but has zero
  followers/following, the handler returns `{users: [], count: 0}` - it does
  NOT raise. `by_username` / `by_id` treat empty data as an error.
- **`_get_my_user_id` cost not tracked**: the implicit `users/me` call made on
  followers/following with empty `user_id` is not reflected in
  `api_usage_metrics`.
- **`verified` default is `False`**: even when the API omits the field the
  output will claim the user is not verified. Treat as unreliable unless
  expansions guaranteed.

## Related

- **Skills using this as a tool**: [`twitter-user-skill/SKILL.md`](../../../server/skills/social_agent/twitter-user-skill/SKILL.md)
- **Sibling nodes**: [`twitterSend`](./twitterSend.md), [`twitterSearch`](./twitterSearch.md), [`twitterReceive`](./twitterReceive.md)
- **Architecture docs**: [Pricing Service](../../pricing_service.md)
