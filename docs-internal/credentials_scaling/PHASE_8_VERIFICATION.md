# Phase 8 — Verification Checklist

Phases 1–7.5 of the credentials-scaling plan have all landed on the
`feature/credentials-scaling` worktree. This document is the
**manual verification gate** a human operator walks through before the
worktree merges to `main`.

Everything in Section A is already verified programmatically in the
session that landed Phases 2–7.5 — recorded here for completeness so the
reviewer knows what is and isn't proven.

Everything in Section B needs a browser + the server running.

Everything in Section C decides whether `providers.tsx` can be deleted.

---

## A. Already verified (programmatic)

- [x] `server/config/credential_providers.json` loads and `extends`
      resolution produces 20 concrete providers (9 AI via `_ai_base`
      inheritance + 11 non-AI) with `_ai_base` hidden from
      `get_all_providers()`.
- [x] `server/services/credential_registry.py` lazy singleton returns
      `{providers, categories, version}` with a content-sha256 version
      hash.
- [x] `get_credential_catalogue` WebSocket handler with conditional
      `since` refetch (returns `{unchanged: true}` on matching version).
- [x] `/api/credentials/icon/{provider_id}` endpoint with path-traversal
      guard, immutable caching, 404 fallback.
- [x] `services/idempotency.py` — TTL-bounded cache with concurrent
      dedupe, exception caching, pass-through when `request_id` unset;
      wired into `handle_save_api_key` + `handle_delete_api_key`.
- [x] `services/circuit_breaker.py` — closed → open (3 failures / 60 s)
      → half-open (after cooldown) → closed on probe success / reopen
      on probe failure; cross-scope isolation; dict-shape failures
      counted alongside raised exceptions.
- [x] `AuthService.refresh_oauth_tokens_with_breaker` wraps any refresh
      callable (sync or async) with a per-provider circuit breaker.
- [x] `client/src/hooks/useCatalogueQuery.ts` — TanStack Query v5 +
      `idb-keyval` warm-start + deferred `requestIdleCallback` persist
      write + conditional `since` refetch.
- [x] `client/src/store/useCredentialRegistry.ts` — UI state only
      (`selectedId`, `paletteOpen`, `query`). No catalogue, no derived
      data. Avoids the #1 runtime/memory trap.
- [x] `client/src/main.tsx` — `QueryClientProvider` wired at app root.
- [x] `client/src/components/credentials/catalogueAdapter.ts` —
      rehydrator: server JSON → runtime `ProviderConfig` with icon
      factory dispatch, status-row/action/qr field-ref compilation, and
      explicit fallback for unknown `icon_ref` kinds.
- [x] `client/src/components/credentials/CredentialsPalette.tsx` —
      cmdk + fuzzysort (pre-indexed on `name` + `categoryLabel`) +
      GroupedVirtuoso (sticky category headers) + `startTransition`
      wrapping the filter update. `useMemo` for every derived artifact.
- [x] `client/src/components/credentials/CredentialsModal.tsx` —
      server-owned catalogue via `useCatalogueQuery`, **additive
      fallback** to bundled `providers.tsx` when the query is loading
      or errored, visible `offline`/`loading` status tags in the header.
- [x] `client/src/components/credentials/PanelRenderer.tsx` —
      `React.lazy` per `PanelKind`, `Suspense` fallback. Vite emits
      one chunk per panel kind.
- [x] `client/src/components/credentials/schema/extends.ts` — client
      port of the Python `_deep_merge` with array-merge-by-key
      semantics. No callers yet (reserved for Phase B NodeSpec).
- [x] `vite.config.js` — React Compiler scoped to credentials module
      via `babel-plugin-react-compiler` `sources` filter; rollup bundle
      visualizer wired behind `ANALYZE=1` flag.
- [x] `client/scripts/audit-bundle.py` — reproducible bundle audit
      that parses the sourcemap to attribute bytes to packages/files.
      See `docs-internal/ui_optimization/BUNDLE_AUDIT.md`.
- [x] `pnpm exec tsc --noEmit` — zero errors across the entire client.
- [x] `pnpm run build` — builds in ~27 s; panel chunks emitted at
      ApiKey 9.4 KB / OAuth 6.9 KB / Email 5.5 KB / QrPairing 28.9 KB;
      main index 2,341 KB (pre-existing baseline).

## B. Needs a browser + server

Run the dev stack:

```bash
cd d:/startup/projects/MachinaOs/.claude/worktrees/credentials-scaling
pnpm run dev
```

Then walk through:

- [ ] **Credentials modal opens** without console errors or crashed
      WebSocket connection.
- [ ] **First modal open** shows `loading` tag briefly in the header
      then the 20 providers render grouped by category. Network panel
      shows exactly ONE `get_credential_catalogue` WebSocket message.
- [ ] **Second modal open** (close + reopen): zero network traffic;
      modal opens in < 50 ms; providers render from the IndexedDB
      warm-start before the background revalidate completes.
- [ ] **Search input**: type `whats` → WhatsApp ranks first; type
      `google` → Google Workspace ranks first; type `zzzzz` → empty
      state shows `No providers match "zzzzz"`; input stays responsive
      even while typing rapidly.
- [ ] **Keyboard nav**: arrow down / up moves the selection; Enter
      picks the highlighted provider; Escape clears the search.
- [ ] **Category order** matches `credential_providers.json`:
      AI → Social → Productivity → Email → Android → Search →
      Scrapers → Services.
- [ ] **Lazy panels**: open the Network tab with "JS" filter, select
      an OpenAI provider → one `ApiKeyPanel-*.js` request. Select
      WhatsApp → one `QrPairingPanel-*.js` request. Re-select the same
      panel kind → zero additional requests.
- [ ] **Offline fallback**: stop the server, reload the page, open
      credentials → header shows `offline` tag and the palette still
      renders the bundled `providers.tsx` fallback list. No error
      state.
- [ ] **Save API key idempotency**: save an OpenAI key, then without
      changing anything click Save again quickly. Server logs should
      show `idempotency[credentials]: cached success for <uuid>` for
      the duplicate. Only one encryption round-trip hits the DB.
- [ ] **Delete API key** works, UI transitions back to unstored state.
- [ ] **OAuth circuit breaker (manual)**: temporarily break the
      Google token endpoint (firewall rule or fake credentials).
      Attempt three refresh cycles → breaker opens; fourth attempt
      returns `{circuit_open: true, retry_after_seconds: ~30}`.
      Twitter refresh still works in parallel. After 30 s, next attempt
      probes and closes the breaker when you restore the endpoint.

### B.1 Heap + INP targets (DevTools)

- [ ] **Chrome DevTools → Memory → Heap Snapshot** after opening the
      modal: filter by `Array`, sort by Retained Size. The catalogue
      array appears once with retained size **~1.5–2.5 MB at 5000
      entries** (less at 20). Exactly **one retainer**: TanStack Query
      cache. If the count is > 1 something is wrong.
- [ ] **Allocation timeline**: open + close the modal 50 times.
      **Delta heap < 1 MB**. Larger delta indicates a listener leak or
      detached-DOM retention.
- [ ] **web-vitals INP attribution** (dev console):
      ```js
      import('web-vitals/attribution').then(({ onINP }) =>
        onINP((metric) => console.log('INP:', metric.value, metric.attribution)));
      ```
      Type rapidly in the search box; p75 should stay **< 200 ms**.
      Target during normal use: < 100 ms.
- [ ] **React DevTools Profiler flamegraph**: record a filter-typing
      session. Only the search box + visible virtuoso rows should
      re-render. The rest of the modal flamegraph should be grey
      (unchanged).

### B.2 5000-provider scaling probe

Temporarily seed the JSON with 4,980 dummy providers to simulate
Pipedream scale:

```bash
cd server
python -c "
import json, copy
with open('config/credential_providers.json') as f:
    data = json.load(f)
base = data['providers']['openai']
for i in range(4980):
    dummy = copy.deepcopy(base)
    dummy['name'] = f'Dummy Provider {i:04d}'
    data['providers'][f'dummy_{i:04d}'] = dummy
with open('config/credential_providers.json.5k', 'w') as f:
    json.dump(data, f, indent=2)
"
mv config/credential_providers.json config/credential_providers.json.original
mv config/credential_providers.json.5k config/credential_providers.json
# restart server
```

Then:

- [ ] Modal opens in < 300 ms cold / < 50 ms warm.
- [ ] Search latency on 5000 entries < 10 ms (check `performance.measure`
      around `fuzzysort.go`).
- [ ] Scroll from row 1 to row 2000: **60 fps** in DevTools Performance.
- [ ] Retained catalogue array: ~1.5–2.5 MB.
- [ ] DOM nodes in the virtuoso container: 10–50 regardless of scroll
      position.

Restore the original JSON after the probe:

```bash
mv config/credential_providers.json.original config/credential_providers.json
```

## C. `providers.tsx` retention decision

Current state: `providers.tsx` is still in place. `CredentialsModal`
uses it as a fallback when the server fetch hasn't landed yet.

### Delete when ALL of the following are true

- [ ] Section B manual checklist passes.
- [ ] Server `get_credential_catalogue` handler has been live in
      production for at least **14 days** with zero error logs.
- [ ] Warm-start IDB path has been hit by at least one real user (the
      `credentials:catalogue:current` key shows up in DevTools →
      Application → IndexedDB → `keyval-store`).
- [ ] The fallback code path in `CredentialsModal.tsx:47` has NOT
      been hit (instrument a one-line `console.log` during the soak to
      confirm).

### How to delete

1. Remove `client/src/components/credentials/providers.tsx`.
2. Remove the `PROVIDERS` / `CATEGORIES` imports from
   `CredentialsModal.tsx`.
3. Replace the fallback branch with an empty-state Result component:
   ```tsx
   if (!catalogue.data && catalogue.isLoading) return <Spin />;
   if (!catalogue.data) return <Result status="error" subTitle="Unable to load credential catalogue" />;
   ```
4. `pnpm exec tsc --noEmit && pnpm run build`.
5. Commit as a separate PR: "credentials: remove client-owned provider
   registry (Phase 8 cleanup)".

Deletion is deliberately **not** part of the initial PR. Keeping the
fallback is the safest possible production rollout.

## Signoff

| Reviewer | Date | Result |
|---|---|---|
| _(pending)_ | | |
