# Frontend UI Stack Migration — antd → shadcn/ui + Base UI + Tailwind 4

## Context

The MachinaOs frontend is coupled to Ant Design (40 files, 187-line theme file, `ConfigProvider` at root). Session docs — [frontend_ui_stack_recommendation.md](./frontend_ui_stack_recommendation.md), [frontend_system_design_rfc.md](./frontend_system_design_rfc.md), [frontend_ui_framework_research.md](./frontend_ui_framework_research.md) — prescribe moving to shadcn/ui (ownership model) + Base UI / Radix primitives + React Aria (surgical a11y) + Tailwind 4 + JSON Forms for a schema-driven inspector.

Motivation: antd's enterprise chrome blocks distinctive product UI; per-node-type branching in `ParameterRenderer.tsx` doesn't scale; the frontend should be a schema consumer of backend `NodeSpec`. The credentials subsystem is the documented exemplar.

Intended outcome: each phase ships independently, app stays green throughout, final state removes antd + styled-components, bundle shrinks ~200-400 KB gzipped, inspector becomes spec-driven.

## Codebase facts (from audit, 2026-04-13)

- **antd usage:** 40 files. Top components by import count: `Space` (20), `Button` (16), `Flex` (13), `Tag` (11), `Spin` (10), `Alert` (10), `Typography` (9), `InputNumber` (7), `Collapse` (7), `Input` (6), `Card` (6), `Form` (5), `Statistic` (4), `Select` (4), `Switch` (3)
- **ConfigProvider:** only in [client/src/App.tsx](../client/src/App.tsx); theme config in [client/src/config/antdTheme.ts](../client/src/config/antdTheme.ts) mirrors [client/src/styles/theme.ts](../client/src/styles/theme.ts)
- **Already installed:** Tailwind 4.1.13, `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`, `react-hook-form`, `babel-plugin-react-compiler@19.1.0-rc.3` (scoped to `components/credentials/` in [client/vite.config.js](../client/vite.config.js)), `@uiw/react-json-view`
- **styled-components:** exactly 1 file — [client/src/components/shared/JSONTreeRenderer.tsx](../client/src/components/shared/JSONTreeRenderer.tsx)
- **Imperative antd APIs:** 26 calls to `message.*` / `notification.*` across 6 files (`MasterSkillEditor`, `MiddleSection`, `PricingConfigModal`, `SettingsPanel`, `useApiKeyValidation`, `formatters`)
- **antd Form:** 7 files, mostly under `components/credentials/panels/` + `sections/`
- **Existing Radix primitive:** [client/src/components/ui/Modal.tsx](../client/src/components/ui/Modal.tsx) already uses `@radix-ui/react-dialog`
- **Exemplar subsystem (credentials):**
  - Zustand (UI-only): [useCredentialRegistry.ts](../client/src/store/useCredentialRegistry.ts)
  - TanStack Query + `idb-keyval` warm-start: [useCatalogueQuery.ts](../client/src/hooks/useCatalogueQuery.ts)
  - Server JSON hydration: [catalogueAdapter.ts](../client/src/components/credentials/catalogueAdapter.ts)
  - Backend endpoint: `get_credential_catalogue` in [server/routers/websocket.py](../server/routers/websocket.py)
- **No NodeSpec contract on frontend today.** `nodeDefinitions/*` are static TS modules.
- **No test runner, no Storybook.**

## Phases

Each phase is independently shippable. Dependency order: 0 → {1, 2, 3} parallelizable → 4 → 5 → 7; 6 can overlap 5 if staffed separately.

---

### Phase 0 — Design-system foundation

**Goal:** owned tokens + core primitives. Nothing removed yet. Blocks everything else.

**New directory:** `client/src/design-system/`

- `tokens/{colors,radius,spacing,typography,motion,elevation}.css` — CSS custom props lifted from [client/src/styles/theme.ts](../client/src/styles/theme.ts) as HSL triplets (no `hsl()` wrapper → Tailwind alpha composition works).
- `tokens/index.css` — imports + `[data-theme="dark"]` override block.
- `lib/cn.ts` — `clsx` + `tailwind-merge` helper.
- `primitives/{Button,Badge,Stack,Inline,Spinner,Alert,Text,Heading}.tsx` — shadcn-style for `Button`/`Badge`/`Alert`; owned thin wrappers for `Stack`/`Inline`/`Spinner`/`Text`/`Heading`.
- `index.ts` — barrel.

**Modified files:**
- [client/tailwind.config.js](../client/tailwind.config.js) — point the existing `hsl(var(--...))` scaffolding at the new token names.
- `client/src/main.tsx` — `import '@/design-system/tokens/index.css'` before antd stylesheet.

**Deps to add:** `class-variance-authority@^0.7.1`, `clsx@^2.1.1`, `tailwind-merge@^2.5.4`, `@radix-ui/react-slot@^1.1.0`

**Verification:** temporary `/design-system` dev route renders every primitive in both themes; `pnpm build` green; no user-visible app change.

**Effort:** 3-4 days.

---

### Phase 1 — Toasts (antd `message` / `notification` → `sonner`)

**Goal:** atomic swap of 26 call-sites across 6 files.

- New: `client/src/design-system/primitives/Toaster.tsx` + `lib/toast.ts` (thin adapter preserving `toast.success/error/info/warning/loading/promise` signatures close to antd's).
- Modify [client/src/App.tsx](../client/src/App.tsx) — mount `<Toaster />` alongside (not replacing) `ConfigProvider`.
- Grep replace in: `MasterSkillEditor.tsx`, `MiddleSection.tsx`, `PricingConfigModal.tsx`, `SettingsPanel.tsx`, `hooks/useApiKeyValidation.ts`, `utils/formatters.ts`.

**Deps to add:** `sonner@^1.7.1`

**Verification:** trigger each call-site manually; grep confirms zero `message|notification` imports from `'antd'`.

**Effort:** 0.5-1 day. Independent of all other phases.

---

### Phase 2 — Visual primitives (`Tag`, `Space`, `Flex`, `Spin`, `Alert`, `Typography`)

**Goal:** replace ~73 pure-presentational call-sites. Zero behavior changes.

Sub-PRs (one per primitive):
- **2a `Tag` → `Badge`** — map antd `color` prop: `red→danger`, `green→success`, `gold|orange→warning`, `blue|cyan→info`, `purple|magenta→secondary`.
- **2b `Space` / `Flex` → `Stack` / `Inline`** — `<Space size="middle">` → `<Inline gap="3">`; `direction="vertical"` → `<Stack>`.
- **2c `Spin` → `Spinner` / `SpinnerOverlay`** — build `SpinnerOverlay` for the `<Spin spinning>{children}</Spin>` idiom.
- **2d `Alert` → `Alert`** — map `type` to variant; `message` → children; `description` → secondary slot.
- **2e `Typography`** — `Title level` → `<Heading level>`; `Text type="secondary"` → `<Text muted>`.

**Impact:** `components/shared/*`, `components/credentials/panels/*`, [OutputPanel.tsx](../client/src/components/output/OutputPanel.tsx) (already uses `Flex`/`Tag`/`Space`), inspector panels.

**Verification:** smoke-test every route/panel; grep confirms zero hits for the 6 component names from `'antd'`.

**Effort:** 2-3 days.

---

### Phase 3 — Overlays & disclosure (`Modal`, `Collapse`, `Popover`, `Tooltip`, `Dropdown`, `Tabs`)

**Goal:** extend the existing Radix pattern from [client/src/components/ui/Modal.tsx](../client/src/components/ui/Modal.tsx).

- New primitives under `client/src/design-system/primitives/`:
  - `Dialog.tsx` — absorb existing `Modal` behind same public API
  - `Collapsible.tsx` — replaces 7 antd `Collapse` sites incl. `OutputPanel`
  - `Popover.tsx`, `Tooltip.tsx`, `DropdownMenu.tsx`, `Tabs.tsx`
- Eventually redirect imports from [Modal.tsx](../client/src/components/ui/Modal.tsx) and delete.

**Deps to add:** `@radix-ui/react-popover@^1.1.2`, `@radix-ui/react-tooltip@^1.1.4`, `@radix-ui/react-dropdown-menu@^2.1.2`, `@radix-ui/react-tabs@^1.1.1`

**Verification:** open every modal; expand/collapse every panel; keyboard nav (Tab/Esc/Enter).

**Effort:** 2-3 days.

---

### Phase 4 — Simple inputs (`Button`, `Input`, `InputNumber`, `Select`, `Switch`, `Card`, `Statistic`)

**Goal:** replace remaining chrome outside `Form` contexts. After this, only antd `Form` + `ParameterRenderer` remain.

- New primitives:
  - `Input.tsx` (shadcn)
  - `NumberField.tsx` (React Aria — locale-aware, stepper)
  - `Select.tsx` (Radix)
  - `Switch.tsx` (Radix)
  - `Card.tsx` (shadcn with `Header`/`Title`/`Description`/`Content`/`Footer`)
  - `Statistic.tsx` (custom, label+value+delta)
- Button migration mapping: `type="primary"`→`variant="default"`, `type="link"`→`variant="link"`, `type="text"`→`variant="ghost"`, `danger`→`variant="destructive"`, `loading` prop → compose `<Spinner />`.

**Deps to add:** `@radix-ui/react-select@^2.1.2`, `@radix-ui/react-switch@^1.1.1`, `@radix-ui/react-label@^2.1.0`, `react-aria-components@^1.4.1`

**Verification:** every button/input/select smoke-tested; `NumberField` step/min/max/precision verified.

**Effort:** 3-4 days.

---

### Phase 5 — Form migration (credentials subsystem)

**Goal:** replace 7 antd Form files using `react-hook-form` (already installed) + new primitives. Credentials is the exemplar — set the pattern here, reuse elsewhere.

- New primitive: `client/src/design-system/form/Form.tsx` — shadcn composition (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`).
- For each panel (mostly under [client/src/components/credentials/panels/](../client/src/components/credentials/panels/) + [sections/](../client/src/components/credentials/sections/)):
  1. `Form.useForm()` → `useForm<Schema>({ resolver: zodResolver(schema) })`
  2. `<Form.Item rules={...}>` → `<FormField name render>` + zod schema
  3. Per-panel schema file: `credentials/panels/schemas/{provider}CredentialSchema.ts`
- Leave `useCredentialRegistry`, `useCatalogueQuery`, `catalogueAdapter.ts` untouched — only rendering layer changes.

**Deps to add:** `@hookform/resolvers@^3.9.1`, `zod@^3.23.8` (verify)

**Verification:** CRUD every credential type; validation errors surface on correct fields.

**Effort:** 4-6 days. Largest single slice.

---

### Phase 6 — `ParameterRenderer` → JSON Forms + renderer registry

**Goal:** replace 15+ branch switch in [ParameterRenderer.tsx](../client/src/components/ParameterRenderer.tsx) with schema-driven system. Depends on backend emitting `NodeSpec`.

**Prerequisite (backend):** `get_node_spec` WebSocket handler returning `NodeSpec { jsonSchema, uiSchema, _uiHints? }` per RFC.

- New directory: `client/src/components/inspector/`
  - `renderers/` — one file per renderer: `StringRenderer`, `NumberRenderer`, `BooleanRenderer`, `EnumRenderer`, `ObjectRenderer`, `ArrayRenderer`, `CodeRenderer`, `SecretRenderer`, `CredentialRefRenderer`, `ExpressionRenderer`, `FileRenderer`, `DateTimeRenderer` (enumerate from current switch branches)
  - `renderers/registry.ts` — `[{ tester, renderer }]` priority array, mirrors credentials registry pattern
  - `NodeInspector.tsx` — wraps `<JsonForms schema uischema renderers data onChange />`
  - `hooks/useNodeSpec.ts` — TanStack Query + `idb-keyval`, mirrors [useCatalogueQuery.ts](../client/src/hooks/useCatalogueQuery.ts)
- Wire `_uiHints` into [client/src/components/output/OutputPanel.tsx](../client/src/components/output/OutputPanel.tsx) (currently noted as "future"; this is the natural home).
- Broaden React Compiler scope in [client/vite.config.js](../client/vite.config.js) to include `components/inspector/`.
- Feature flag `VITE_USE_NODESPEC` for phased rollout; delete old `ParameterRenderer.tsx` once stable.

**Deps to add:** `@jsonforms/core@^3.3.0`, `@jsonforms/react@^3.3.0` (NOT material/vanilla renderers — own the registry)

**Verification:** every node type in `nodeDefinitions/*` renders via inspector; `VITE_USE_NODESPEC=false` falls back to old renderer; no layout jank on 50-parameter nodes.

**Effort:** 6-10 days + backend coordination.

---

### Phase 7 — Retire antd, `ConfigProvider`, styled-components

**Goal:** delete the old stack. Bundle shrinks ~200-400 KB gzipped.

- Verify zero `from 'antd'` imports remain.
- Migrate [client/src/components/shared/JSONTreeRenderer.tsx](../client/src/components/shared/JSONTreeRenderer.tsx) — rewrite styled-components as Tailwind classes.
- Delete: [client/src/config/antdTheme.ts](../client/src/config/antdTheme.ts), `ConfigProvider` wrapper in [client/src/App.tsx](../client/src/App.tsx), antd reset CSS import in `main.tsx`; inline remaining [client/src/styles/theme.ts](../client/src/styles/theme.ts) usages against CSS vars then delete.
- Remove from [client/package.json](../client/package.json): `antd`, `styled-components`, `@types/styled-components`.
- Broaden React Compiler scope to whole `src/`.

**Verification:** full app regression; record bundle size before/after; `pnpm build` + `tsc --noEmit` green.

**Rollback:** keep `pre-phase-7` branch; antd reinstalls cleanly if regression found post-deploy.

**Effort:** 1-2 days.

---

## Cross-cutting

### Testing posture
No test runner exists. Before Phase 5, decide:
- **Minimum:** Playwright smoke tests for credential CRUD, inspector edit, output render (~2 days).
- **Ideal:** Vitest + Testing Library for primitives + Storybook for design system (~4-5 days).

All verification steps above are manual unless tests are added.

### Total effort
~22-33 dev-days (~6-8 weeks focused work).

### Critical files
- [client/src/App.tsx](../client/src/App.tsx) — `ConfigProvider` removal in Phase 7
- [client/src/config/antdTheme.ts](../client/src/config/antdTheme.ts) — theme migration source
- [client/src/styles/theme.ts](../client/src/styles/theme.ts) — token source for Phase 0
- [client/tailwind.config.js](../client/tailwind.config.js) — Phase 0 rewiring
- [client/vite.config.js](../client/vite.config.js) — React Compiler scope expansion
- [client/src/components/ParameterRenderer.tsx](../client/src/components/ParameterRenderer.tsx) — Phase 6 target
- [client/src/components/credentials/](../client/src/components/credentials/) — exemplar for Phase 5 and 6
- [client/src/components/output/OutputPanel.tsx](../client/src/components/output/OutputPanel.tsx) — `_uiHints` wiring in Phase 6
- [client/src/components/ui/Modal.tsx](../client/src/components/ui/Modal.tsx) — subsume into `Dialog` in Phase 3
- [client/src/components/shared/JSONTreeRenderer.tsx](../client/src/components/shared/JSONTreeRenderer.tsx) — last styled-components site

### Rollout / rollback
Each phase is behind no flag except Phase 6 (`VITE_USE_NODESPEC`). Rollback = single-PR revert; antd coexists with new stack until Phase 7.

## End-to-end verification (post Phase 7)

1. `pnpm install && pnpm build` — green, bundle size recorded
2. `pnpm exec tsc --noEmit` — zero errors
3. Full manual regression: workflow open/save, node CRUD, credential CRUD per provider type, parameter edit, workflow run, output render (markdown/JSON/error), theme toggle light↔dark, keyboard nav (Tab/Esc/Enter on all modals/menus)
4. Bundle analyzer (`vite-bundle-visualizer`): confirm antd + moment/dayjs locales removed
5. `grep -r "from 'antd'" client/src/` returns zero
6. `grep -r "styled-components" client/src/` returns zero
