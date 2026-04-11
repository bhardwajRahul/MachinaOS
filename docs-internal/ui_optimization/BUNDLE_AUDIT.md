# Bundle Audit (Phase 7)

Generated: 2026-04-12

Audit of the main client chunk (`dist/assets/index-<hash>.js`) after Phases 1–6 of the credentials-scaling plan landed. Reproduction:

```bash
cd client
ANALYZE=1 pnpm run build          # builds with sourcemaps + rollup-plugin-visualizer
python scripts/audit-bundle.py    # prints the tables below
open dist/stats.html               # interactive treemap for deeper drilldowns
```

Note: `ANALYZE=1` enables the visualizer plugin and source-map emission; leave it unset in normal builds.

## Headline numbers

| Artifact | Size | gzipped | Notes |
|---|---|---|---|
| `index-Bix9TxBS.js` (main chunk) | 2,338 KB | 673 KB | Eager entry bundle |
| `index-DnvjDIoH.js` (palette/adapter chunk) | 38 KB | 12 KB | Emitted by Phase 4 palette integration |
| `QrPairingPanel` chunk | 29 KB | 10 KB | Phase 5 lazy split |
| `ApiKeyPanel` chunk | 7.7 KB | 2.9 KB | Phase 5 lazy split |
| `EmailPanel` chunk | 5.5 KB | 2.1 KB | Phase 5 lazy split |
| `OAuthPanel` chunk | 3.5 KB | 1.5 KB | Phase 5 lazy split |
| Total sources in main chunk | 1,425 | — | Unique module count |
| Total source bytes (pre-minification) | 5.97 MB | — | Input to minifier |

The 2.34 MB main chunk is the pre-existing baseline; Phases 4 + 5 shipped ~90 KB of panel code out of it via `React.lazy`. Every other number in this audit is a target for future phases, not blockers for merging Phase A.

## Top package contributors to the main chunk

| Rank | Bucket | Bytes | % | Notes |
|---|---|---|---|---|
| 1 | `antd` | 940,205 | 15.8% | Expected — big UI kit. Component-level tree-shaking already applies via ES imports. Further reductions would need switching to antd v6 CSS Variables mode (~30 KB saving). |
| 2 | `src/components` (aggregate) | 739,653 | 12.4% | Dominated by the monoliths called out in the UI optimization MDs. Per-file breakdown below. |
| 3 | `react-dom` | 545,403 | 9.1% | Baseline. Not actionable. |
| 4 | `src/nodeDefinitions` | 325,531 | 5.5% | 26 per-category files eagerly spread-merged at module parse. **Directly addressed by ComponentPalette MD Lever 4** (`import.meta.glob` lazy per-category + TanStack Query-backed NodeSpec registry). |
| 5 | `@lobehub/icons` | 232,092 | 3.9% | AI provider icon library. Used by the AI chat model nodes. Likely addressable via named imports only. |
| 6 | `@reactflow/core` | 206,420 | 3.5% | Baseline. React Flow MD recommends `onlyRenderVisibleElements` for runtime, not bundle. Not actionable here. |
| 7 | `micromark-core-commonmark` | 113,496 | 1.9% | Part of remark/react-markdown. Only actually used in skill/memory editors. **Addressable**: dynamic `import()` in `MasterSkillEditor` and `NodeOutputPanel` so it only loads when a markdown editor opens. |
| 8 | `@ant-design/icons` | 112,838 | 1.9% | antd icon library. Verify all imports are named (`import { FooOutlined }`), not namespace/wildcard. |
| 9 | `rc-select` | 108,968 | 1.8% | antd transitive. Not actionable independently. |
| 10 | `rc-field-form` | 97,711 | 1.6% | antd transitive. Not actionable independently. |
| 11 | `src/contexts` | 97,379 | 1.6% | Dominated by `WebSocketContext.tsx` (90 KB). **Directly addressed by Canvas MD Lever 1** (per-node status store) + Phase C of the RFC (WebSocket router fission). |
| 12 | `react-virtuoso` | 94,304 | 1.6% | Phase 4 palette dependency — paid once, used by the palette. |
| 13 | `prismjs` | 80,281 | 1.3% | Code editor syntax highlighting. Already lazy-loaded in `CodeEditor.tsx` per CLAUDE.md, but something is still pulling it eagerly. **Action**: audit eager imports of `react-simple-code-editor`. |
| 14 | `@tanstack/query-core` | 78,143 | 1.3% | Phase 3 dependency — paid once, used everywhere. |

## Top single-file contributors

| File | Bytes | Recommended action |
|---|---|---|
| `src/contexts/WebSocketContext.tsx` | 90,018 | Canvas MD Lever 1 + RFC Phase C: per-node status store + WS router fission. |
| `src/components/ParameterRenderer.tsx` | 87,379 | Parameter panel MD Lever 1: type registry with `import.meta.glob` auto-discovery. 780-line switch becomes one file per type. |
| `src/components/ui/NodeOutputPanel.tsx` | 70,558 | Lazy-load `react-markdown` / `remark-*` via dynamic `import()` — only needed when output includes markdown. |
| `src/components/parameterPanel/InputSection.tsx` | 65,576 | Parameter panel MD Lever 5: TanStack Query-backed schema cache. |
| `src/Dashboard.tsx` | 54,129 | Canvas MD proposal: glob-based node component registry; Dashboard becomes a coordinator. |
| `src/components/parameterPanel/MiddleSection.tsx` | 51,751 | Parameter panel MD Levers 3 + 4: memoized field list + compiled visibility predicates. |
| `src/components/ui/ConsolePanel.tsx` | 45,612 | Lazy-load `prismjs` / code editor inside the console tab — only costs if the terminal is actually used. |
| `src/nodeDefinitions/googleWorkspaceNodes.ts` | 42,714 | RFC Phase B: migrate to NodeSpec JSONs served from the server registry. |
| `src/components/parameterPanel/MasterSkillEditor.tsx` | 41,822 | Lazy-load `react-markdown` dependency — only costs when a skill editor opens. |
| `src/nodeDefinitions/whatsappNodes.ts` | 41,601 | RFC Phase B: NodeSpec migration. |

## Actionable wins (ranked by effort × impact)

1. **Lazy-load markdown stack in `NodeOutputPanel` + `MasterSkillEditor`**
   ~180 KB unminified saving (`micromark` + `mdast-util-*` + `unified` + related). 2 dynamic `import()` calls, ~30 min. Same Supabase `next/dynamic` pattern the research MDs cite.

2. **Verify `prismjs` / `react-simple-code-editor` are lazy**
   CLAUDE.md claims they are, but the audit shows ~102 KB of prism + editor code landing in the main chunk. 1 hour to find and fix the eager import site. Saves ~30 KB gzipped.

3. **ComponentPalette Lever 4 — lazy per-category node definitions**
   `src/nodeDefinitions` bucket is 325 KB. Moving to `import.meta.glob` lazy imports drops this to ~10 KB for the registry shell. Detailed in `component_palette_scaling.md`. 1–2 days total.

4. **Canvas MD Lever 1 — per-node status store**
   `WebSocketContext.tsx` is 90 KB and causes the subscription storm separately. Shrinks the file and fixes the 200-node re-render cascade in one change. ~2 hours, biggest runtime win in the app.

5. **Parameter panel MD Lever 1 — type registry**
   `ParameterRenderer.tsx` 87 KB monolith becomes ~15 KB shell + per-type files lazy-loaded. Makes adding a new parameter type a one-file operation. ~3 hours.

## Deliberately deferred / out of Phase 7 scope

- Antd v6 CSS Variables migration — requires full app-level testing.
- Replacing `antd` with a lighter kit — scope creep.
- `react-flow` tree-shaking — not actionable without forking React Flow.
- `lucide-react` icon swap — does not apply to credentials (already raw SVG).
- `@lobehub/icons` audit — used by AI chat model nodes, separate workstream.

## What Phase 7 shipped

- `rollup-plugin-visualizer` wired into `vite.config.js` behind an `ANALYZE=1` flag so normal builds pay zero cost.
- `client/scripts/audit-bundle.py` — reproducible programmatic audit (see top of this doc).
- Source-map emission gated on `ANALYZE=1` — normal builds stay small, analyze builds get accurate attribution.
- This report. All actionable wins have owners (existing UI optimization MDs or RFC phases).

## References

- `client/vite.config.js` — visualizer plugin + sourcemap gating
- `client/scripts/audit-bundle.py` — reproducible audit
- `docs-internal/ui_optimization/component_palette_scaling.md` — Lever 4 (lazy nodedef registry)
- `docs-internal/ui_optimization/parameter_panel_scaling.md` — Lever 1 (type registry)
- `docs-internal/ui_optimization/canvas_dashboard_scaling.md` — Lever 1 (per-node status store)
- `docs-internal/platform_refactor/PLATFORM_REFACTOR_RFC.md` — Phase B (NodeSpec migration) + Phase C (WS fission)
