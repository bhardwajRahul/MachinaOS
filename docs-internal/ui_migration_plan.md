# Frontend UI Stack Migration — antd → shadcn/ui (canonical, no custom wrappers)

> **Status (2026-04-14):** Phases 0–5 + 7 **complete**. Phase 6 (`ParameterRenderer` → JSON Forms) deferred pending backend `NodeSpec` handler. Zero antd / `@ant-design/icons` / styled-components imports remain. For the current state of the frontend see [frontend_architecture.md](./frontend_architecture.md) — that doc supersedes this plan as the source of truth for what the frontend IS; this doc documents how we got there.

## Completion table

| Phase | Status | Commits |
|---|---|---|
| 0 — Tokens + shadcn CLI bootstrap | ✅ done | `cdeebb4` (`2209dba`, `7ac69fe` were hand-written false-starts, superseded) |
| 0.5 — Shadcn components via CLI | ✅ done | `8bade71` |
| 0.6 — **Tailwind v4 vite plugin wired** (required for utility compilation) | ✅ done | `5aa7c11` |
| 1 — Toasts to sonner (direct import, no facade) | ✅ done | `cdeebb4` (replaced earlier `7ac69fe` adapter) |
| 2 — Visual chrome (Tag/Space/Flex/Spin/Alert/Typography) | ✅ done | `1222c8c` |
| 3 — Overlays (Modal/Collapse/Popover/Tooltip/Dropdown/Tabs/AlertDialog) | ✅ done | `af88ec5`, `11ea62e` |
| 4 — Inputs (Button/Input/Select/Switch/InputNumber/Slider/Checkbox/Card/Statistic) | ✅ done | `a3c4314`, `3cf0cd7`, `0c2d218`, `376a1d2`, `cbea6c3` |
| 5 — Forms (credentials: EmailPanel + ProviderDefaults + RateLimit on RHF + zod; FieldRenderer+useCredentialPanel drop antd Form) | ✅ done | `ccf9bd5`, `7bbcfef`, `bbc056f` |
| 6 — `ParameterRenderer` → JSON Forms + renderer registry | ⏸ deferred | (needs backend `get_node_spec`) |
| 7 — Retire antd, ConfigProvider, styled-components | ✅ done | `b9e0c74` |

**Outcome metrics:**
- Main JS bundle: **1.7 MB** (was 2.35 MB pre-Phase-7 — saved ~650 KB from antd + `@ant-design/icons` + dayjs locale payload)
- `grep -rln "from 'antd'" client/src/` → **0**
- `grep -rln "from '@ant-design" client/src/` → **0**
- `grep -rln "styled-components" client/src/` → **0**
- `pnpm build` green throughout all 17 commits on `feature/credentials-scaling-v2`

## Post-antd cleanup (April 2026)

A second audit (3 parallel sub-agents) flagged tribal patterns that survived the antd retirement and didn't match the schema-driven design system. A focused 5-phase follow-up plan ([typed-splashing-crown](../../../.claude/plans/typed-splashing-crown.md)) addresses them:

| Follow-up phase | Status | Commit | What it removes |
|---|---|---|---|
| 1 — Workflow list to TanStack Query | ✅ done | `c3a7aa4` | `savedWorkflows` array + `loadSavedWorkflows` action duplicating server data in Zustand |
| 2 — `useParameterPanel` / `useOnboarding` to Query hooks | ✅ done | `b2b6fba` | hand-rolled `useState + useEffect` over `WebSocketContext.sendRequest` |
| 3 — Theme tokens to CSS vars (kickoff) | ✅ done | `8b19808` | `theme.ts` deprecation banner + `AIAgentNode` PHASE_CONFIG hex literals (bulk migration of `GenericNode` / `SettingsPanel` / `BaseChatModelNode` deferred) |
| 4 — `SettingsPanel` to zod + Phase-2 hooks | ✅ done | `2901f0a` | duplicated camel↔snake mappers + hand-rolled load/save WS calls |
| 5 — Schema-drive WhatsApp selectors | ✅ done | `8353c48` | `parameter.name === 'group_id'` / `'channel_jid'` / `'senderNumber'` branches in `ParameterRenderer` (now `typeOptions.loadOptionsMethod`) |

**What's still tribal (deferred):**
- Bulk inline-style migration in `GenericNode`, `SettingsPanel` non-button styles, `BaseChatModelNode`. The Tailwind classes are wired and the deprecation banner is in place; per-component conversion is mechanical but visual-regression-prone, so left for follow-up commits with browser verification.
- `parameter.name === 'apiKey'` / `'model'` specials in `ParameterRenderer` — same migration path (`typeOptions.loadOptionsMethod = 'providerModels'` etc.), parked until the WhatsApp pattern proves stable.
- `ConsolePanel` 11 × `useState` → `useReducer` + zod schema. Independent edit-state domain; won't be touched until a behavior change forces it.

**New canonical patterns introduced:**
- Workflows + node params + user settings live in TanStack Query (`useWorkflowsQuery`, `useNodeParamsQuery`, `useUserSettingsQuery`), not Zustand or component-local state.
- Module-singleton `QueryClient` at [client/src/lib/queryClient.ts](../client/src/lib/queryClient.ts) so imperative code (Zustand actions) can invalidate without going through React context.
- Settings + onboarding share one cached server read (`['userSettings']`).
- WhatsApp group / channel / member selectors dispatch from `typeOptions.loadOptionsMethod` instead of parameter-name string compares — schema is the source of truth.

## Wave 2 — schema-driven panels (April 2026)

A second, deeper audit (4 parallel sub-agents — panel audit, library survey, NodeSpec mapping, system-design / file-organisation research) drove a focused Wave 2 against the heavy custom panels and the long-deferred renderer registry. Plan: same `typed-splashing-crown.md` plan file, replaced in place. Hard constraint: **minimise new files** — the research validated colocation (Kent C. Dodds, n8n's monolithic `ParameterInput.vue`, Robin Wieruch's split criteria) over per-widget files.

| Wave 2 phase | Status | Commit | What it removes / introduces |
|---|---|---|---|
| 1 — `INodeUIHints` on node definitions | ✅ done | `0e816f3` | 5 panel files were branching on `nodeDefinition.name === '…'`. Now read 14 typed flags (`hideInputSection`, `hasCodeEditor`, `isMasterSkillEditor`, `isMemoryPanel`, `isToolPanel`, `isMonitorPanel`, `showLocationPanel`, `isAndroidToolkit`, `isChatTrigger`, `isConsoleSink`, `hasSkills`, …) from `nodeDefinition.uiHints`. Legacy name fallback retained for one release. |
| 2 — `outputSchema` registry | ✅ done | `5d8d2b5` | The 350-line `sampleSchemas` map in `InputSection.tsx` was the largest schema-driven gap. New `outputSchema` field on `INodeTypeDescription`; `start`, `taskTrigger`, `chatTrigger`, `simpleMemory`, `python/javascript/typescriptExecutor` annotated as canaries. Legacy map kept as fallback. |
| 3 — `ConsolePanel` state split | ✅ done | `cde8e6a` | 6 `useState` + 3 `useEffect` localStorage pairs and 2 imperative `addEventListener` resize chains collapsed into one zod-validated `consolePrefsSchema` + one inline `usePanelResize` hook. Both stay colocated at the top of `ConsolePanel.tsx`. |
| 4 — Editor migrations to RHF + zod | ✅ done | `221848b`, `0c0e197` | `SkillEditorModal` (5 fields + manual `validateForm`) and `ToolSchemaEditor` (dynamic field-array) now run on `useForm` + `zodResolver` + `useFieldArray`. Per-field error messages live in the schema; dirty tracking is RHF-managed. Inputs / Selects / Switch / Checkbox from shadcn primitives. |
| 5 — `ActionButton` cva helper | ✅ done | `8a68c09` | A 14-line `actionButtonStyle(color, isDisabled)` helper was copy-pasted across 4 files. New `client/src/components/ui/action-button.tsx` with a `tone` cva variant; `ParameterPanel`, `LocationParameterPanel`, `SettingsPanel` migrated. ~210 LOC of inline-style boilerplate gone. |
| 6 — `ParameterRenderer` → renderer registry | ⏸ deferred | — | Library survey ran; recommended approach is **DIY** (RHF + zod + small `WIDGETS` registry) modeled on n8n's monolithic `ParameterInput.vue`, with `@rjsf/core` v6 + `@rjsf/shadcn` as the documented escape hatch. File budget: 4 files in `inspector/` (vs the original 16-file proposal — research validated the smaller layout). Blocks on backend `get_node_spec` WebSocket handler emitting `NodeSpec { jsonSchema, uiSchema, _uiHints? }`. |
| 7 — Docs + guardrails | ✅ done (docs) | this commit | This section + frontend_architecture.md updates. ESLint rule + bundle-budget CI assertion deferred (need CI config touch). |

**File budget actuals:** 1 new file across Wave 2 (`action-button.tsx`). All other phases used colocation or extended existing files (`useWorkflowsQuery.ts`, the relevant node definitions, `INodeProperties.ts`). The original draft of this plan proposed ~16 new files for the renderer phase alone — research-driven revision cut that to a 4-file colocated layout.

**Wave 2 numbers:**
- Hardcoded `nodeDefinition.name === '…'` outside whitelisted utility files: **0** (all panel-visibility checks read `uiHints` first; legacy fallbacks kept for nodes not yet annotated).
- Hand-rolled forms with >3 fields: **2 → 0** (SkillEditorModal, ToolSchemaEditor — both on RHF + zod). MasterSkillEditor remains; it's a split-panel UI, not a single form.
- `ConsolePanel` `useState` count: **13 → 7**.
- `pnpm exec tsc --noEmit` green throughout all 6 commits.

**What's still deferred (intentionally):**
- Phase 6 — `ParameterRenderer` → DIY widget registry. Backend `get_node_spec` handler is the prerequisite. Frontend layout decided (4 files in `inspector/`); rollout shape decided (5 weekly slices behind `VITE_USE_NODESPEC` with parity test against legacy renderer).
- Bulk Tailwind sweep of `GenericNode` / `BaseChatModelNode` inline `theme.dracula.*` refs. Visual-regression-prone; needs in-browser verification per file.
- ESLint rule + bundle-budget CI assertion (Phase 7 leftovers). Both touch CI config, deferred together.
- `MasterSkillEditor` RHF migration. The editor is a split-panel UI (skill list + content editor + folder dropdown + inline create/edit) — not the >3-field-form pattern Phase 4 targeted. The form-with-validation parts already moved to `SkillEditorModal`; the registry-style list view is genuinely different work.

## Context

The MachinaOs frontend was coupled to Ant Design (40 files, 187-line theme file, `ConfigProvider` at root). Pre-migration audit + research docs (now deleted; see git history under commit `4cb3dd9` if needed) prescribed shadcn/ui (canonical components copied via CLI registry) + Radix primitives + Tailwind 4 + JSON Forms for a schema-driven inspector. Phase 0/1 commits (`2209dba`, `7ac69fe`) included hand-written primitives and a toast facade — those got deleted as part of corrected Phase 0 (`cdeebb4`).

**Outcome:** every component used in the app comes from `shadcn add` or is a raw HTML element with Tailwind utilities. No owned layout wrappers. No facade layers. Adapters only where the library API genuinely doesn't fit (e.g., custom JSON Forms renderers in Phase 6 — because no library knows about MachinaOs's node-parameter shapes).

## Principles

1. **Use the registry.** `npx shadcn@latest add <component>` for every shadcn primitive. Never re-implement what it ships.
2. **No owned layout wrappers.** Tailwind utility classes are the API. `<div className="flex flex-col gap-3">` is the answer, not `<Stack gap="3">`.
3. **No facade layers.** `import { toast } from 'sonner'` directly at call sites. No `lib/toast.ts` wrapper preserving antd's call shape.
4. **Library defaults beat invented abstractions.** Use shadcn's `Form` composition with `react-hook-form` + `zod` exactly as the docs show. Use `@jsonforms/react`'s built-in renderer registry, don't invent another.
5. **Tokens are owned.** CSS vars are the one thing shadcn doesn't ship — they're our palette (Solarized + Dracula). One CSS file (`tokens.css`), exported as HSL triplets so Tailwind alpha composition works.
6. **Each phase ships independently.** App stays green; antd coexists until Phase 7.

## Codebase facts (from audit, 2026-04-13)

- **antd usage:** 40 files. Top imports: `Space` (20), `Button` (16), `Flex` (13), `Tag` (11), `Spin` (10), `Alert` (10), `Typography` (9), `InputNumber` (7), `Collapse` (7), `Input` (6), `Card` (6), `Form` (5), `Statistic` (4), `Select` (4), `Switch` (3).
- **ConfigProvider:** only in [client/src/App.tsx](../client/src/App.tsx); theme in [client/src/config/antdTheme.ts](../client/src/config/antdTheme.ts) mirrors [client/src/styles/theme.ts](../client/src/styles/theme.ts).
- **Already installed:** Tailwind 4.1.13, `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`, `react-hook-form`, `babel-plugin-react-compiler@19.1.0-rc.3` (scoped to `components/credentials/`), `@uiw/react-json-view`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `sonner`.
- **styled-components:** exactly 1 file — [client/src/components/shared/JSONTreeRenderer.tsx](../client/src/components/shared/JSONTreeRenderer.tsx).
- **Hand-written code to be deleted in corrected Phase 0:** `client/src/design-system/primitives/*` (8 files) and `client/src/design-system/lib/toast.ts` (introduced by commits `2209dba` and `7ac69fe` — the previous mistake).
- **Imperative antd APIs:** 21 call sites already moved from `message.*`/`notification.*` to a `toast` adapter — they get **re-pointed at `sonner` directly**.
- **antd Form:** 7 files, mostly under `components/credentials/panels/` + `sections/`.
- **No NodeSpec contract on frontend today.**
- **No test runner, no Storybook.**

## Phases

Dependency order: 0 → {1, 2, 3} parallelizable → 4 → 5 → 7; 6 can overlap 5 if staffed separately.

---

### Phase 0 — Tokens + shadcn bootstrap

**Goal:** delete the hand-written primitives and the toast facade. Bootstrap shadcn properly via the CLI. Tokens stay (they're ours).

**Steps:**

1. **Path alias.** Add `@/* → src/*` to [client/tsconfig.json](../client/tsconfig.json) (`baseUrl` + `paths`) and [client/vite.config.js](../client/vite.config.js) (`resolve.alias`). shadcn requires this.
2. **Consolidate tokens to one file.** Collapse `client/src/design-system/tokens/{colors,radius,spacing,typography,motion,elevation}.css` into a single `client/src/design-system/tokens.css` (keep the same vars; just one file). Update the import in `client/src/main.tsx`.
3. **Delete owned primitives.** Remove `client/src/design-system/primitives/` (8 files) and `client/src/design-system/lib/toast.ts`. Keep `lib/cn.ts` (shadcn convention).
4. **Run `npx shadcn@latest init` interactively.** Accept its `components.json`; aim for `aliases.ui = "@/design-system/ui"`, `aliases.utils = "@/design-system/lib/cn"`. Reconcile any rewrites against our token names.
5. **Add the components we'll need across all phases in one shot:**
   ```
   npx shadcn@latest add button badge alert card sonner \
     dialog collapsible popover tooltip dropdown-menu tabs \
     select switch input label form
   ```
6. **Re-point Phase 1's call sites.** The 21 sites currently importing `toast` from the deleted facade now import directly from `sonner`. The shadcn-generated `<Toaster />` lives at `client/src/design-system/ui/sonner.tsx`; mount it in `App.tsx`.
7. **No new owned files** beyond `tokens.css`, `lib/cn.ts`, and shadcn-generated `ui/*.tsx`.

**Tailwind config:** keep our semantic mappings (`bg`, `fg`, `border`, `primary`, `success`, `warning`, `danger`, `info`, `accent`, `dracula.*`) pointing at our CSS vars. Reconcile with whatever `shadcn init` writes — keep ours where they conflict; we own the palette.

**What we explicitly do NOT build:**
- No `Stack` / `Inline` / `Flex` wrapper. Use `<div className="flex ...">`.
- No `Text` / `Heading` wrapper. Use `<h2 className="text-xl font-semibold">` etc.
- No `Spinner`. Use `<Loader2 className="h-4 w-4 animate-spin" />` from `lucide-react` (installed by shadcn).
- No `toast` facade. `import { toast } from 'sonner'` at call sites.

**Verification:** `pnpm exec tsc --noEmit` green; `pnpm build` green; manually open one screen, confirm theme tokens render, confirm a `sonner` toast fires.

**Effort:** 0.5 day.

---

### Phase 1 — Toast direct imports (re-point existing call sites)

**Goal:** the 21 sites already moved to the `toast` adapter in commit `7ac69fe` get repointed at `sonner` directly. No facade.

- Replace `import { toast } from '../design-system'` with `import { toast } from 'sonner'`.
- API is identical for `success`/`error`/`warning`/`info`/`loading`. Callers passing `{ description }` already work — that's sonner's native shape.

**Files:** `hooks/useApiKeyValidation.ts`, `utils/formatters.ts`, `components/ui/SettingsPanel.tsx`, `components/PricingConfigModal.tsx`, `components/parameterPanel/MiddleSection.tsx`, `components/parameterPanel/MasterSkillEditor.tsx`.

**Verification:** trigger each toast manually; grep `from '@/design-system'.*toast` returns zero.

**Effort:** 30 min.

---

### Phase 2 — Replace antd visual chrome (Tag, Space, Flex, Spin, Alert, Typography)

**Goal:** ~73 call sites swapped to shadcn `Badge`/`Alert` and raw Tailwind utilities. Zero behavior changes.

- **`Tag` → `<Badge variant>`** from shadcn. Map antd `color` to variant: `red→destructive`, `green→default with success class via cva extension`, `blue|cyan→secondary`, `purple|magenta→outline`. Extend the generated `badge.tsx` directly if shadcn's stock variants aren't enough.
- **`Space` / `Flex` → raw Tailwind.** `<Space size="middle">` becomes `<div className="flex items-center gap-2">`. `direction="vertical"` → `flex-col`. No wrapper component.
- **`Spin` → `<Loader2 className="h-4 w-4 animate-spin" />`** from `lucide-react`. The `<Spin spinning>{children}</Spin>` overlay idiom becomes a 4-line inline `<div className="relative">` + conditional overlay.
- **`Alert` → shadcn `<Alert>`** with `<AlertTitle>` + `<AlertDescription>`.
- **`Typography.Title` → raw `<h1>`-`<h5>`** with Tailwind classes. `Typography.Text type="secondary"` → `<span className="text-fg-muted">`.

**Verification:** smoke-test every screen; grep confirms zero `from 'antd'` imports for these 6 components.

**Effort:** 2-3 days.

---

### Phase 3 — Replace overlays (Modal, Collapse, Popover, Tooltip, Dropdown, Tabs)

**Goal:** swap to shadcn equivalents (all generated in Phase 0).

- **antd `Modal` / existing `client/src/components/ui/Modal.tsx`** → shadcn `<Dialog>`. Update existing `Modal.tsx` to re-export shadcn's API or delete it and update call sites.
- **antd `Collapse`** → shadcn `<Collapsible>` or shadcn `<Accordion>` (add via `npx shadcn@latest add accordion` if grouped variant needed).
- **`Popover` / `Tooltip` / `DropdownMenu` / `Tabs`** → direct swap to shadcn versions.

**Verification:** open every modal; expand/collapse every panel; keyboard nav (Tab/Esc/Enter).

**Effort:** 2 days.

---

### Phase 4 — Replace inputs (Button, Input, Select, Switch, Card, Statistic, InputNumber)

**Goal:** swap to shadcn. `InputNumber` is the only one without a clean shadcn equivalent.

- **`Button`** → shadcn. Map antd props: `type="primary"→variant="default"`, `link→variant="link"`, `text→variant="ghost"`, `danger→variant="destructive"`, `loading` prop → render `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` inside.
- **`Input` / `Select` / `Switch` / `Card`** → direct swap.
- **`Statistic`** → no shadcn equivalent. Inline `<div>` with Tailwind classes — 5 lines, used 4 times.
- **`InputNumber`** → install `react-aria-components` and use its `<NumberField>` (locale-aware, stepper buttons, keyboard arrows). React Aria is the only library that ships a production-quality number field.

**Deps to add:** `react-aria-components`.

**Verification:** every button/input/select smoke-tested; NumberField step/min/max/precision verified.

**Effort:** 3 days.

---

### Phase 5 — Migrate antd Form to shadcn Form (react-hook-form + zod)

**Goal:** replace 7 antd Form files with shadcn's canonical `Form` composition (already generated in Phase 0).

- For each panel under [client/src/components/credentials/panels/](../client/src/components/credentials/panels/) + [sections/](../client/src/components/credentials/sections/):
  1. `Form.useForm()` → `useForm<Schema>({ resolver: zodResolver(schema) })`.
  2. `<Form.Item rules={...}>` → `<FormField name render>`; move validation into a colocated zod schema.
  3. Per-panel zod schema file: `credentials/panels/schemas/{provider}.ts`.
- The `useCredentialRegistry` / `useCatalogueQuery` / `catalogueAdapter.ts` flow stays — only the rendering layer changes.

**Deps to add:** `@hookform/resolvers`, `zod`.

**Verification:** CRUD every credential type; validation errors surface on correct fields.

**Effort:** 3-4 days.

---

### Phase 6 — `ParameterRenderer` → JSON Forms with custom renderer registry

**Goal:** replace the 15+ branch switch in [client/src/components/ParameterRenderer.tsx](../client/src/components/ParameterRenderer.tsx) with `@jsonforms/react`'s renderer registry. Backend emits `NodeSpec { jsonSchema, uiSchema, _uiHints? }`.

**Prerequisite (backend):** `get_node_spec` WebSocket handler returning `NodeSpec` per the RFC.

- Use JSON Forms' built-in `[{ tester, renderer }]` registry — don't invent another.
- Custom renderers under `client/src/components/inspector/renderers/`: `string`, `number`, `boolean`, `enum`, `object`, `array`, `code`, `secret`, `credentialRef`, `expression`, `file`, `dateTime`. Each is `function MyRenderer({ data, handleChange, schema, uischema }) { ... }` wrapped in `withJsonFormsControlProps`.
- `client/src/components/inspector/NodeInspector.tsx` — single file, ~30 lines: wraps `<JsonForms ...>`.
- `client/src/hooks/useNodeSpec.ts` — TanStack Query + `idb-keyval`, mirrors [useCatalogueQuery.ts](../client/src/hooks/useCatalogueQuery.ts).
- Wire `_uiHints` into [client/src/components/output/OutputPanel.tsx](../client/src/components/output/OutputPanel.tsx).
- Feature flag `VITE_USE_NODESPEC` for phased rollout; delete old `ParameterRenderer.tsx` once stable.

**Deps to add:** `@jsonforms/core`, `@jsonforms/react`. (Not material/vanilla renderers — we own the registry.)

**Verification:** every node type renders via inspector; `VITE_USE_NODESPEC=false` falls back; no jank on 50-parameter nodes.

**Effort:** 5-7 days + backend coordination.

---

### Phase 7 — Retire antd, ConfigProvider, styled-components

**Goal:** delete the old stack. Bundle shrinks ~200-400 KB gzipped.

- Verify zero `from 'antd'` imports remain.
- Migrate [client/src/components/shared/JSONTreeRenderer.tsx](../client/src/components/shared/JSONTreeRenderer.tsx) — rewrite styled-components as Tailwind classes.
- Delete: [client/src/config/antdTheme.ts](../client/src/config/antdTheme.ts); `ConfigProvider` wrapper in [client/src/App.tsx](../client/src/App.tsx); antd reset CSS import in `main.tsx`. Inline remaining [client/src/styles/theme.ts](../client/src/styles/theme.ts) usages against CSS vars then delete.
- Remove from [client/package.json](../client/package.json): `antd`, `@ant-design/icons`, `styled-components`, `@types/styled-components`.
- Broaden React Compiler scope to whole `src/`.

**Verification:** full app regression; record bundle size before/after; `pnpm build` + `tsc --noEmit` green.

**Rollback:** keep `pre-phase-7` branch; antd reinstalls cleanly if regression found post-deploy.

**Effort:** 1 day.

---

## Cross-cutting

### Testing posture
No test runner. Before Phase 5, decide:
- **Minimum:** Playwright smoke for credential CRUD, inspector edit, output render (~2 days).
- **Ideal:** Vitest + Testing Library + Storybook (~4-5 days).

### Total effort
~17-22 dev-days.

### Critical files
- [client/src/App.tsx](../client/src/App.tsx) — `ConfigProvider` removal in Phase 7
- [client/src/config/antdTheme.ts](../client/src/config/antdTheme.ts) — theme migration source
- [client/src/styles/theme.ts](../client/src/styles/theme.ts) — token source for Phase 0
- [client/tailwind.config.js](../client/tailwind.config.js) — Phase 0 rewiring
- [client/tsconfig.json](../client/tsconfig.json) + [client/vite.config.js](../client/vite.config.js) — `@/*` alias for shadcn
- [client/src/components/ParameterRenderer.tsx](../client/src/components/ParameterRenderer.tsx) — Phase 6 target
- [client/src/components/credentials/](../client/src/components/credentials/) — exemplar for Phase 5 and 6
- [client/src/components/output/OutputPanel.tsx](../client/src/components/output/OutputPanel.tsx) — `_uiHints` wiring in Phase 6
- [client/src/components/ui/Modal.tsx](../client/src/components/ui/Modal.tsx) — replaced by shadcn `Dialog` in Phase 3
- [client/src/components/shared/JSONTreeRenderer.tsx](../client/src/components/shared/JSONTreeRenderer.tsx) — last styled-components site

### Rollout / rollback
Each phase behind no flag except Phase 6 (`VITE_USE_NODESPEC`). Rollback = single-PR revert; antd coexists with new stack until Phase 7.

## End-to-end verification (post Phase 7)

1. `pnpm install && pnpm build` — green, bundle size recorded.
2. `pnpm exec tsc --noEmit` — zero errors.
3. Full manual regression: workflow open/save, node CRUD, credential CRUD per provider, parameter edit, workflow run, output render (markdown/JSON/error), theme toggle light↔dark, keyboard nav (Tab/Esc/Enter on all overlays).
4. Bundle analyzer (`ANALYZE=1 pnpm build` then open `dist/stats.html`): confirm antd + dayjs locales removed.
5. `grep -r "from 'antd'" client/src/` returns zero.
6. `grep -r "styled-components" client/src/` returns zero.
