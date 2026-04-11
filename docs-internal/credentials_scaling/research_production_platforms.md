# Research: How Production Platforms Scale Credential/Node UIs

Research findings on how n8n, Nango, Pipedream, Zapier, and Supabase Studio structure
their credential and integration registries at hundreds to thousands of providers.
Informs the MachinaOs credentials scaling architecture.

---

## Summary

The most important discovery: **none of these platforms virtualize credential/integration
lists at their current scale**. The real bottleneck is **schema/icon I/O and main-bundle
weight**, not DOM rendering. The winning patterns are:

1. Server-owned declarative registry (Nango YAML, n8n backend scan)
2. One bulk-fetch at boot, cached in a client store
3. Lazy per-integration metadata (Pipedream) or lazy icon endpoints (n8n)
4. Schema inheritance via `extends` to eliminate duplication (n8n)
5. Aggressive lazy-loading of heavy optional features (Supabase `next/dynamic`)

---

## n8n (~400 credentials, ~700 nodes)

The closest analogue to MachinaOs — open-source workflow tool with React-like frontend
(Vue), schema-driven node definitions, credential edit modal, and node palette.

**Source**: https://github.com/n8n-io/n8n

### Frontend registry

- `packages/frontend/editor-ui/src/stores/credentials.store.ts` exposes
  `allCredentialTypes` — a Pinia store cached after one REST fetch at app boot.
- `packages/frontend/editor-ui/src/features/credentials/components/CredentialsSelectModal.vue`
  renders a **plain `v-for`** over `N8nSelect`/`N8nOption` with `filterable` substring
  matching. **No virtualization, no fuse.js, no cmdk.**
- `CredentialEdit.vue` renders all 400+ types from one generic schema walker over
  `INodeProperties[]`. It reads `credentialTypeData.extends` and merges deltas via
  `NodeHelpers.mergeNodeProperties()` (a ~30-line deep-merge helper).

### Backend registry

- `CredentialsHelper` scans installed packages at startup and builds the catalogue
  in-memory on the server.
- The frontend fetches the entire credential-type catalogue in **one bulk REST call**
  at app boot, then caches it in Pinia.

### Icon loading

- Icons are served **lazily per tile** via `/rest/node-icon/<nodeType>` — no sprite
  sheets, no data URIs inlined in the main bundle. Browser handles caching.

### Key takeaways
- **Bulk-fetch + cache** pattern: one call at boot beats per-open fetches.
- **Schema inheritance** (`extends`) is the single biggest de-duplication win. In
  MachinaOs, `AI_AGENT_PROPERTIES` is duplicated across 15 specialized agents in
  `specializedAgentNodes.ts` — this pattern would eliminate it.
- **No virtualization at 400 credentials** — substring filter over the Pinia array
  is fast enough.

---

## Nango (~400 providers)

Modern OAuth integration platform with the cleanest declarative registry we found.

**Source**: https://github.com/NangoHQ/nango

### The `providers.yaml` pattern

Entire catalogue in **one file**: `packages/providers/providers.yaml` (~20,000 lines).
Each provider is a YAML key declaring `display_name`, `categories`, `auth_mode`,
`proxy`, `credentials`, `connection_config`. Parsed at build time.

```yaml
# Example shape
github:
  display_name: GitHub
  categories: [dev-tools]
  auth_mode: OAUTH2
  authorization_url: https://github.com/login/oauth/authorize
  token_url: https://github.com/login/oauth/access_token
  proxy:
    base_url: https://api.github.com
  credentials:
    - type: string
      name: client_id
      required: true
```

### Why YAML wins

- **Zero per-provider TypeScript files.** Adding a provider = adding a YAML entry.
  No component edits, no imports, no barrel updates.
- Works for non-engineers (support team, integration partners can PR new providers).
- Git diffs are readable (unlike a TypeScript object literal inside a massive array).
- Can be validated at load time with Pydantic (Python) or Zod (TypeScript).

### Key takeaways
- **Move the registry to a data file**, not TypeScript. MachinaOs currently has
  `client/src/components/credentials/providers.tsx` (the registry file) — this should
  become `server/config/credential_providers.yaml`.
- **One file for the whole catalogue** beats per-provider files when the list is long.

---

## Pipedream (2,500+ apps, 3,334 component directories)

The largest open-source integration platform we examined.

**Source**: https://github.com/PipedreamHQ/pipedream

### Filesystem-as-registry

- Directory convention: `components/<app_name>/` — auto-enumerated at build time.
  The filesystem structure **is** the registry.
- Example: `components/github/actions/create-issue.ts`, `components/github/sources/new-issue.ts`.

### Frontend does NOT bundle all apps

- `@pipedream/connect-react`'s `ComponentFormContainer` fetches metadata **on demand
  per component selection**. At this scale, eager bundling is physically impossible —
  2,500 apps × ~2 KB config each = 5 MB of registry JSON in the main bundle alone.
- The app picker UI uses server-side search + infinite scroll, not a flat list.

### Key takeaways
- **Past ~1000 providers**, eager bundling becomes impossible. Server-side pagination
  + per-selection metadata fetch is the only scalable pattern.
- For the MachinaOs 5000-provider target, we need **at minimum** lazy-loading of
  per-panel code (React.lazy) and per-icon loading (n8n endpoint pattern). If the
  registry itself grows past 1000 providers, we may need to add pagination later.

---

## Zapier (8,000+ apps)

Proprietary, but their architecture is discussed in public blog posts and
the Partner API docs confirm the pattern.

- **Server-side paged + search + infinite scroll.** Apps live in a database.
  The frontend fetches paginated.
- Each app tile is fetched on scroll, icons cached by the CDN.
- The "App Directory" page is a virtualized grid via react-window for the infinite
  scroll container (one of the few production uses of virtualization we found).

### Key takeaways
- Beyond ~5000 entries, a flat client-side array is infeasible — server DB + REST
  pagination is the only option.
- At MachinaOs' 5000 target, we're on the edge. A single YAML file with 5000
  entries is ~1 MB — still loadable in one bulk fetch, but borderline. The plan's
  bulk-fetch approach stays valid up to ~5000; past that, migrate to paginated.

---

## Supabase Studio (dozens of settings pages)

Not a credentials system per se, but offers concrete lessons on bundle management
for a large dashboard-style app.

**Source**: https://github.com/supabase/supabase/tree/master/apps/studio
**Engineering post**: https://dev.to/supabase/making-the-supabase-dashboard-supa-fast-mha

### The `next/dynamic` wins

- `xlsx` library was **313 KB brotli** and loaded on every page. Moved to
  `next/dynamic()`, triggered only when the user clicks "Add content" → imports
  the Excel parser. Same treatment for Lottie.
- Used `@next/bundle-analyzer` to find the worst offenders.
- **No virtualization.** Every page uses plain React lists and forms.
- The win was dynamic imports of heavy optional features, not DOM optimization.

### Key takeaways
- **Measure first with a bundle visualizer.** In our case:
  `pnpm add -D rollup-plugin-visualizer` and audit `dist/stats.html`.
- **Lazy-load heavy features, not just components.** MachinaOs equivalents:
  `react-simple-code-editor + prismjs`, `react-markdown`, `@ant-design/icons`
  (tree-shake via Vite), Google Maps script, `MasterSkillEditor`.
- `React.lazy()` + `Suspense` is the right primitive. Vite auto-chunks dynamic
  imports; no extra config needed.

---

## Retool (100+ resources, 40+ components)

Proprietary, smaller scale than Zapier/Pipedream.

- 100+ database/API resource pickers, flat grouped list with substring search.
- Same pattern as n8n at smaller scale. Confirms that substring filter is
  sufficient for <500 items.

### Key takeaways
- Do not over-engineer for the current scale. Add virtualization only when profiling
  shows it's needed.

---

## Cross-cutting finding (the surprise)

**None of the platforms examined virtualize credential/integration lists at their
current scale.** At ~400 items with text-only DOM, virtualization is unnecessary.
The bottleneck is schema/icon I/O and main-bundle weight.

This shifts MachinaOs' priorities:

| Priority | Concrete change | Estimated impact |
|----------|-----------------|------------------|
| P0 | Server-owned YAML registry + bulk fetch + cache | Eliminates ~500 KB growth at 1000 providers |
| P0 | Schema `extends` inheritance | Kills ~400 lines of duplicated AI agent properties |
| P1 | Lazy panel code via `React.lazy` | Per-panel chunks (<50 KB each) |
| P1 | Lazy icon endpoint (`/api/credentials/icon/<id>`) | Removes icon data URIs from main bundle |
| P1 | cmdk + fuzzysort search palette | Scalable UX past 500 items |
| P2 | react-virtuoso sidebar | Only needed past ~2000 items — kept in scope for 5000 target |
| P2 | Supabase-style bundle audit | Find and lazy-load other heavy features |

---

## Sources

- n8n: https://github.com/n8n-io/n8n
- n8n deep-dive blog: https://jimmysong.io/blog/n8n-deep-dive/
- Nango providers.yaml: https://github.com/NangoHQ/nango/blob/master/packages/providers/providers.yaml
- Pipedream components: https://github.com/PipedreamHQ/pipedream/tree/master/components
- Supabase dashboard perf: https://dev.to/supabase/making-the-supabase-dashboard-supa-fast-mha

---

## Addendum — Additional production references

### oboe.com (inspected at user request)

Oboe is a modern educational platform (React-based interactive courses). Its public asset bundles reveal a canonical 2026 React production stack:

- **React** + **TanStack Router** for routing
- **TanStack Query** with **dehydrated → hydrated** query client pattern (SSR: cache serialized on server, rehydrated on client)
- **Server-side rendering** with streaming data hydration
- **Vendor bundle isolation** (`vendor-react-*.js`) for better long-term caching
- **Sentry** for error monitoring, **Mixpanel** + **Google Analytics** for events
- Custom API at `api.oboe.com`, progressive enhancement

**Relevance to MachinaOs**: Oboe is SSR, MachinaOs is a Vite SPA. The equivalent pattern for a single-page self-hosted app is **TanStack Query + `experimental_createPersister` + IndexedDB**. Same cache-transfer shape (persist the query cache → rehydrate on next boot → reconcile with server), different transport (IndexedDB instead of SSR streaming). Confirms that TanStack Query is the 2026 production default for React server-state layers.

**No plan changes** — this is a validation that the planned Phase 3 architecture (TanStack Query owning the catalogue, Zustand owning UI state, `idb-keyval` persister, WebSocket version-hash invalidation) matches contemporary production practice.

### Additional architectural references

- **Nango's approach to ~400 providers**: Git-backed provider manifests + content-addressed storage + CDN for schema. Clients fetch only changed providers on version bumps. Pattern we inherit: server-owned registry + WebSocket version hash for cache invalidation.
- **Pipedream's component registry (2,500+ apps)**: GitHub-backed filesystem-as-registry. Local CLI sync only fetches diffs. We do not need this scale yet — a single bulk fetch is still tractable at 5000 providers.
- **Cloudflare Workers edge caching** (investigated, rejected): useful if serving multiple regions; not justified for a self-hosted single-instance tool. Our local WebSocket + IndexedDB cache is faster than round-tripping through an edge CDN.

### Additional sources

- React Compiler 1.0 release: https://react.dev/blog/2025/10/07/react-compiler-1
- TanStack Query v5: https://tanstack.com/query/latest
- oboe.com (production stack reference, inspected 2026)
- Nango engineering on AI integration platforms: https://nango.dev/blog/best-ai-agent-integration-platforms
- Modular monolith vs microservices 2026: https://www.ancient.global/en/blogs-ancient/microservices-vs-modular-monolith-2026
