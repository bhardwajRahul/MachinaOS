# Frontend Architecture

Post-migration (2026-04-14). Single source of truth for the current frontend.

> The pre-migration audit / research / RFC docs (`frontend_architecture_analysis.md`, `frontend_component_functionality_and_design.md`, `frontend_system_design_rfc.md`, `frontend_ui_framework_research.md`, `frontend_ui_stack_recommendation.md`) were deleted on 2026-04-14 — they're preserved in git history under commit `4cb3dd9` if you ever need to reference them. The migration log lives at [ui_migration_plan.md](./ui_migration_plan.md).

## TL;DR

- **React 19 + Vite 7 + TypeScript 5.9** with the **React Compiler** (`babel-plugin-react-compiler@19`, scoped to all of `src/` except `components/ui/`).
- **Tailwind v4** via `@tailwindcss/vite` + `@import "tailwindcss"` in [src/index.css](../client/src/index.css). Tokens defined in the same CSS file via `@theme inline` (no `tailwind.config.js` colors block).
- **shadcn/ui** via the canonical CLI (`npx shadcn@latest add`). All primitives live under [client/src/components/ui/](../client/src/components/ui/) as first-class repo files we can edit.
- **Radix UI** is the primitive engine shadcn uses (Dialog, Accordion, Select, Switch, Tabs, Tooltip, Popover, Dropdown, AlertDialog, Collapsible, Progress, Slider, Label, Checkbox).
- **Forms**: react-hook-form + zod via shadcn's `Form` composition. Per-form schemas live colocated with the form (e.g. `credentials/panels/schemas/email.ts`); tiny forms use inline zod.
- **Toasts**: `sonner` imported directly at call-sites. The shadcn `<Toaster />` wrapper (at [components/ui/sonner.tsx](../client/src/components/ui/sonner.tsx)) is patched to read our `ThemeContext` instead of `next-themes`.
- **State**: TanStack Query for server state, Zustand for UI-only state, plain `useState`/`useReducer` for local. No global redux store.
- **WebSocket realtime** via `WebSocketContext`; chat/node/workflow events are push-based, never polled.
- **antd is gone.** `styled-components` is gone. `@ant-design/icons` is gone. Icons come from `lucide-react`.

## Tech stack (current)

| Concern | Library | Where |
|---|---|---|
| Bundler | Vite 7 | [client/vite.config.js](../client/vite.config.js) |
| Framework | React 19 | [client/src/main.tsx](../client/src/main.tsx) |
| Compiler | `babel-plugin-react-compiler@19.1.0-rc.3` | [vite.config.js](../client/vite.config.js) (scoped: all of `/src/` except `components/ui/`) |
| Styling | Tailwind v4 + `@tailwindcss/vite` | [index.css](../client/src/index.css) + [tailwind.config.js](../client/tailwind.config.js) |
| Component library | shadcn/ui (CLI `npx shadcn@latest add`) | [components/ui/](../client/src/components/ui/) |
| Primitives | Radix UI | Pulled as transitive deps by shadcn |
| Icons | `lucide-react` | Everywhere. No more `@ant-design/icons`. |
| Typography | `@tailwindcss/typography` (`prose`) | Activated via `@plugin` in index.css |
| Markdown | `react-markdown` + `remark-gfm` + `remark-breaks` | Output panel, memory display, skill instructions |
| Code highlighting | `prismjs` | Code editor |
| JSON tree | `@uiw/react-json-view` (`githubDarkTheme` / `githubLightTheme`) | `OutputPanel` |
| Forms | `react-hook-form@7` + `zod@4` + `@hookform/resolvers` | Credential panels + sections |
| Toasts | `sonner` | Direct imports; shadcn `<Toaster />` wrapper mounted in `App.tsx` |
| Server state | `@tanstack/react-query@5` | `useCatalogueQuery`, `useProviderStatus`, etc. |
| UI state | `zustand@5` | `useAppStore`, `useCredentialRegistry` (UI-only, never holds catalogue data) |
| Realtime | native WebSocket wrapped by `WebSocketContext` | `contexts/WebSocketContext.tsx` |
| Search palette | `cmdk@1` + `fuzzysort@3` | `CredentialsPalette` |
| Virtualization | `react-virtuoso@4` | `GroupedVirtuoso` in `CredentialsPalette` (grouped, variable-height) |
| IndexedDB | `idb-keyval@6` | Warm-start cache for the credentials catalogue |
| Canvas | `reactflow@11` | Workflow editor |
| Code editor | `react-simple-code-editor` + `prismjs` | Python/JS/TS node editors |

Not present (intentionally): antd, `@ant-design/icons`, styled-components, emotion, moment/dayjs user imports, `next-themes`.

## Directory layout

```
client/src/
├── App.tsx                  # Root: syncs ThemeContext -> <html data-theme>/class, mounts Toaster
├── main.tsx                 # Providers (QueryClient, Theme, Auth, WebSocket) + renders <App/>
├── Dashboard.tsx            # Canvas workspace (React Flow + top-level panels)
├── ParameterPanel.tsx       # Per-node inspector (Phase 6 will schema-drive this)
│
├── index.css                # Tailwind v4 @import + @theme inline tokens + RF/scrollbar chrome
│
├── components/
│   ├── ui/                  # shadcn-generated primitives (editable, ours)
│   │   ├── button.tsx       # CVA variants: default/secondary/ghost/outline/destructive/link
│   │   ├── badge.tsx        # + success/warning/info variants we added
│   │   ├── alert.tsx        # + success/warning/info variants we added
│   │   ├── accordion.tsx    # Radix accordion
│   │   ├── dialog.tsx       # Radix dialog (Modal.tsx re-exports via thin wrapper)
│   │   ├── popover.tsx / tooltip.tsx / dropdown-menu.tsx
│   │   ├── select.tsx       # Radix select (no search; grouped items via SelectGroup/SelectLabel)
│   │   ├── input.tsx / textarea.tsx / switch.tsx / checkbox.tsx / label.tsx / slider.tsx
│   │   ├── collapsible.tsx / tabs.tsx / alert-dialog.tsx / card.tsx / progress.tsx
│   │   ├── form.tsx         # react-hook-form + FormField/FormItem/FormControl/FormMessage
│   │   └── sonner.tsx       # Patched to read ThemeContext (not next-themes)
│   │
│   ├── Modal.tsx (src/components/ui/Modal.tsx)
│   │                        # Thin wrapper over shadcn Dialog; preserves the pre-migration
│   │                        # API (isOpen/onClose/title/maxWidth/maxHeight/autoHeight/
│   │                        # headerActions) so call sites didn't churn.
│   │
│   ├── credentials/         # EXEMPLAR SUBSYSTEM — see "Credentials" section below
│   │   ├── CredentialsModal.tsx    # Shell — palette + PanelRenderer
│   │   ├── CredentialsPalette.tsx  # cmdk + fuzzysort + GroupedVirtuoso
│   │   ├── PanelRenderer.tsx       # Lazy-loads panel by kind
│   │   ├── catalogueAdapter.ts     # Server JSON -> ProviderConfig
│   │   ├── types.ts                # ProviderConfig, FieldDef, PanelKind, etc.
│   │   ├── useCredentialPanel.ts   # State hook (useState + form shim)
│   │   ├── panels/
│   │   │   ├── ApiKeyPanel.tsx           # Generic api-key providers
│   │   │   ├── OAuthPanel.tsx            # Twitter / Google / Telegram
│   │   │   ├── QrPairingPanel.tsx        # WhatsApp / Android
│   │   │   ├── EmailPanel.tsx            # IMAP/SMTP (RHF + zod)
│   │   │   └── schemas/email.ts          # Email zod schema w/ superRefine
│   │   ├── sections/
│   │   │   ├── ApiUsageSection.tsx       # Per-service usage/cost
│   │   │   ├── LlmUsageSection.tsx       # Per-provider token/cost
│   │   │   ├── ProviderDefaultsSection.tsx  # Default model params (RHF + zod)
│   │   │   └── RateLimitSection.tsx      # WhatsApp rate limits (RHF + zod)
│   │   └── primitives/
│   │       ├── StatusCard.tsx            # Config-driven status rows
│   │       ├── ActionBar.tsx             # Config-driven action buttons
│   │       ├── FieldRenderer.tsx         # Schema-driven simple-field renderer
│   │       └── OAuthConnect.tsx          # Composes status + fields + actions
│   │
│   ├── output/
│   │   └── OutputPanel.tsx         # Execution results. Single file, ~150 lines.
│   │                               # antd Collapse replaced with composable
│   │                               # `<Collapsible>` sections + ChevronDown;
│   │                               # Markdown via ReactMarkdown + prose.
│   │                               # JSON via @uiw/react-json-view.
│   │
│   ├── parameterPanel/             # Per-node inspector (pre-Phase-6)
│   │   ├── MiddleSection.tsx       # Parameters + console + skills + token usage
│   │   ├── OutputSection.tsx       # Wraps output/OutputPanel
│   │   ├── InputSection.tsx        # Connected node outputs
│   │   └── MasterSkillEditor.tsx   # Skill enable/disable + instructions editor
│   │
│   ├── onboarding/
│   │   ├── OnboardingWizard.tsx    # Custom step indicator (no antd Steps)
│   │   └── steps/*.tsx             # Welcome / Concepts / ApiKey / Canvas / GetStarted
│   │
│   ├── ui/
│   │   ├── ApiKeyInput.tsx         # Composite: input + eye toggle + save/delete buttons
│   │   ├── SettingsPanel.tsx       # Shadcn Switch + Slider + Input
│   │   ├── PricingConfigModal.tsx  # (client/src/components/PricingConfigModal.tsx)
│   │   ├── ConsolePanel.tsx        # Chat + console + terminal + output
│   │   ├── Modal.tsx               # Shadcn Dialog wrapper
│   │   ├── NodeOutputPanel.tsx     # Deleted (superseded by output/OutputPanel)
│   │   └── TopToolbar.tsx          # File menu + model picker + action buttons
│   │
│   ├── icons/                      # AI provider icons (SVG data URIs)
│   ├── auth/                       # Login page + protected route
│   ├── shared/
│   │   └── JSONTreeRenderer.tsx    # Recursive JSON tree (no styled-components)
│   ├── SquareNode.tsx, StartNode.tsx, TriggerNode.tsx, GenericNode.tsx, AIAgentNode.tsx, WhatsAppNode.tsx, ModelNode.tsx
│   │                               # React Flow nodes with lucide icons
│   └── APIKeyValidator.tsx         # Shadcn Input + Button + Tooltip composition
│
├── contexts/
│   ├── ThemeContext.tsx            # isDarkMode + toggleTheme
│   ├── AuthContext.tsx             # JWT user state
│   └── WebSocketContext.tsx        # Single source of truth for WS state + handlers
│
├── hooks/
│   ├── useAppTheme.ts              # Bridges ThemeContext + Solarized/Dracula palettes
│   ├── useCatalogueQuery.ts        # TanStack Query + idb-keyval warm-start (exemplar)
│   ├── useWorkflowsQuery.ts        # Workflow list + save/delete mutations (Query)
│   ├── useNodeParamsQuery.ts       # Per-node parameter Query + save mutation
│   ├── useUserSettingsQuery.ts     # user_settings row Query + save mutation
│   ├── useApiKeys.ts               # WS-based API key CRUD
│   ├── useApiKeyValidation.ts      # Provider-specific validation helpers
│   ├── useComponentPalette.ts / useDragAndDrop.ts / useExecution.ts
│   ├── useOnboarding.ts            # Reads via useUserSettingsQuery; writes via mutation
│   ├── useParameterPanel.ts        # Thin orchestrator over useNodeParamsQuery + save mutation
│   ├── usePricing.ts / useToolSchema.ts / useWhatsApp.ts / useAndroidOperations.ts
│   └── useCopyPaste.ts / useRename.ts
│
├── store/
│   ├── useAppStore.ts              # UI state (sidebar, palette, pro mode, persisted)
│   └── useCredentialRegistry.ts    # UI-only: selectedId + paletteOpen + query
│
├── lib/
│   ├── queryClient.ts              # Module-singleton QueryClient so imperative
│   │                               # code (Zustand actions) can invalidate without
│   │                               # going through React context.
│   └── utils.ts                    # cn() = clsx + tailwind-merge (shadcn convention)
│
├── styles/
│   └── theme.ts                    # LEGACY. Still exported for components that
│                                   # reference theme.colors / theme.dracula.* directly.
│                                   # Will shrink over time as those sites inline Tailwind tokens.
│
├── services/
│   ├── executionService.ts         # ExecutionResult shape + node-execution plumbing
│   ├── apiKeyManager.ts            # LangChain API key utilities
│   └── dynamicParameterService.ts  # Remote options loaders for ParameterRenderer
│
├── adapters/
│   └── nodeSpecToDescription.ts    # Backend NodeSpec -> legacy INodeTypeDescription shape
├── lib/
│   ├── nodeSpec.ts                 # TanStack-Query spec fetch, resolveNodeDescription, listCachedNodeSpecs
│   ├── aiModelProviders.ts         # Frontend-only AI provider icon/credential map
│   ├── queryClient.ts / queryConfig.ts / featureFlags.ts
│   └── utils.ts
├── types/                          # INodeProperties, NodeTypes, etc.
└── utils/                          # formatters, apiKeySecurity, workflowExport, parameterSanitizer
```

## Tokens + theming

Single source of truth: [src/index.css](../client/src/index.css).

```css
@import "tailwindcss";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:is(.dark *));

:root, [data-theme="light"] {
  --background: 218 22% 97%;
  --foreground: 214 11% 12%;
  --primary: 221 83% 53%;
  --destructive: 0 74% 51%;
  --success: 161 94% 30%;
  --warning: 32 95% 44%;
  --info: 192 91% 36%;
  --border: 216 12% 84%;
  --radius: 0.5rem;

  /* Dracula action palette, same across themes */
  --dracula-green: 135 94% 65%;
  --dracula-purple: 265 89% 78%;
  /* ...pink, cyan, red, orange, yellow */

  /* Node-type role tokens — base + soft (tinted bg) + border (tinted outline).
   * Themes redefine these in their own scope; call sites use bg-node-X /
   * bg-node-X-soft / border-node-X-border directly with no opacity arithmetic. */
  --node-agent:        265 89% 78%;
  --node-agent-soft:   265 89% 78% / 0.08;
  --node-agent-border: 265 89% 78% / 0.3;
  --node-model:        191 97% 77%;   /* + -soft / -border */
  --node-skill:        135 94% 65%;   /* + -soft / -border */
  --node-tool:         135 94% 65%;   /* + -soft / -border */
  --node-trigger:      326 100% 74%;  /* + -soft / -border */
  --node-workflow:     27 100% 71%;   /* + -soft / -border */
}

[data-theme="dark"] {
  --background: 192 100% 11%;   /* Solarized base03 */
  --foreground: 60 30% 96%;     /* Dracula fg */
  --primary: 205 69% 49%;       /* Solarized blue */
  --destructive: 1 71% 52%;     /* Solarized red */
  /* ...etc */
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-destructive: hsl(var(--destructive));
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
  --color-info: hsl(var(--info));
  --color-dracula-green: hsl(var(--dracula-green));
  /* ...etc */
}
```

Rules:
1. **HSL triplets, no `hsl()` wrapper.** Tailwind composes alpha via `bg-primary/50`.
2. **shadcn's variable names win** (`--background`, `--primary`, `--destructive`, etc.) so every shadcn-generated file resolves against our palette with no re-wiring.
3. Dark mode flips via `[data-theme="dark"]` + Tailwind's `.dark` class, both set by `App.tsx`:
   ```tsx
   useEffect(() => {
     const root = document.documentElement;
     root.classList.toggle('dark', isDarkMode);
     root.dataset.theme = isDarkMode ? 'dark' : 'light';
   }, [isDarkMode]);
   ```
4. `styles/theme.ts` (`theme.dracula.*`, `theme.colors.*`) is still exported for the canvas node components and `EdgeConditionEditor`. New code should prefer Tailwind classes (`bg-primary`, `text-dracula-green`, `bg-node-agent-soft`) or `hsl(var(--...))` inline.

### Token tier — pick the most specific that fits

| Tier | Tokens | Use for |
|---|---|---|
| **shadcn semantic** | `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `ring` | App-wide chrome, status colors, generic actions. Each rotates per theme. |
| **Node-type role** | `node-agent`, `node-model`, `node-skill`, `node-tool`, `node-trigger`, `node-workflow` (+ paired `-soft` and `-border` variants) | Anywhere a node type's identity should drive color: palette icons, parameter-panel sections, draggable variable cards, status badges, edge label tints. |
| **Dracula raw** | `dracula-green`, `dracula-purple`, `dracula-pink`, `dracula-cyan`, `dracula-red`, `dracula-orange`, `dracula-yellow` | Action-button palette (`<ActionButton tone="green">`). Constant across themes by design. Avoid in new code unless you specifically need that. |

### No opacity arithmetic at call sites

`bg-primary/10` and `border-node-agent/30` are forbidden in new code. Themes own the exact tint per role:

```tsx
// ❌ Don't
<Card className="bg-node-agent/10 border-node-agent/30" />

// ✅ Do — themes can redefine --node-agent-soft / -border independently
<Card className="bg-node-agent-soft border-node-agent-border" />
```

Add a new `-soft` / `-border` (or other named) variant to `--node-X` if a unique opacity is needed; never inline the math at the call site.

## Component primitives

All under [components/ui/](../client/src/components/ui/). Editable — add variants as needed (we extended `Badge` and `Alert` with `success/warning/info`).

| Concern | Primitive | Notes |
|---|---|---|
| Button | `Button` (CVA) | Variants: `default | secondary | ghost | outline | destructive | link`. Sizes: `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg` |
| Badge | `Badge` | + `success | warning | info` (ours) |
| Alert | `Alert + AlertTitle + AlertDescription` | + `success | warning | info` (ours) |
| Overlay | `Dialog`, `AlertDialog`, `Popover`, `Tooltip`, `DropdownMenu` | Radix |
| Disclosure | `Accordion`, `Collapsible`, `Tabs` | Radix |
| Inputs | `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Slider`, `Label` | Radix (Select/Switch/Checkbox/Slider) |
| Cards | `Card + CardHeader/Title/Description/Content/Footer` | Layout primitive |
| Progress | `Progress` | Radix progress |
| Form | `Form + FormField + FormItem + FormLabel + FormControl + FormDescription + FormMessage` | react-hook-form wrappers |
| Toast | `Sonner` `<Toaster />` | Patched for our ThemeContext |

**Rules for adding primitives:**
- Always use the CLI: `MACHINAOS_INSTALLING=true npx shadcn@latest add <name>` from `client/` (the env var suppresses the project's recursive postinstall hook).
- New variants go inside the generated file (we own it).
- Don't wrap primitives in `<Stack>`/`<Inline>`/`<Text>`/`<Heading>`. Use raw Tailwind classes. The Tailwind utility API IS the design system for layout/typography.

## Forms

shadcn's canonical composition — react-hook-form + zod + shadcn `Form`:

```tsx
const schema = z.object({ apiKey: z.string().min(1, 'API key is required') });
const form = useForm({ resolver: zodResolver(schema), defaultValues: { apiKey: '' } });

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="apiKey"
      render={({ field }) => (
        <FormItem>
          <FormLabel>API Key</FormLabel>
          <FormControl><Input {...field} /></FormControl>
          <FormDescription>Paste your provider API key</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Save</Button>
  </form>
</Form>
```

**Conventions:**
- Drop the `useForm<T>()` generic — let TS infer from the resolver. Otherwise zod `optional().default()` mismatches the control type.
- Inline small schemas in the component. For schemas with `superRefine`/conditional validation (e.g. email's custom-provider rule) move to a colocated file (`schemas/email.ts`).
- No `Form.useWatch`; use `form.watch('field')` or `form.formState.isDirty` directly.
- For per-field-save workflows (credentials), skip RHF entirely — `useCredentialPanel` uses `useState` + a ref-based `getFieldValue/setFieldValue` shim so call-sites don't change.

## Credentials subsystem (exemplar)

The template for scalable feature design in this codebase. Everything else should follow the same shape.

**Data flow:**
```
server/config/credential_providers.json
            │
            │ (includes _ai_base abstracts + extends resolution)
            ▼
server/services/credential_registry.py
            │
            │ (enriches each provider with stored: bool via auth_service)
            ▼
WebSocket: handle_get_credential_catalogue (server/routers/websocket.py)
            │
            │ (content-sha256 version hash; 304-style conditional fetch)
            ▼
hooks/useCatalogueQuery.ts  (TanStack Query + idb-keyval warm-start)
            │
            ▼
components/credentials/catalogueAdapter.ts  (hydrate JSON -> ProviderConfig)
            │
            ▼
components/credentials/CredentialsModal.tsx
   ├─ CredentialsPalette.tsx   (cmdk + fuzzysort + GroupedVirtuoso)
   └─ PanelRenderer.tsx        (lazy: ApiKey/OAuth/QrPairing/Email)
```

**State rules:**
- **Zustand** (`useCredentialRegistry`) holds ONLY UI state: `selectedId`, `paletteOpen`, `query`. Never catalogue data. Prevents the closure-retention bug where selectors keep the whole 5000-entry catalogue in memory.
- **TanStack Query** owns the server state (catalogue, usage summaries, etc).
- **idb-keyval** cache seeds first paint — opened modal renders from IndexedDB in <50 ms before the WS roundtrip completes.
- **`requestIdleCallback`** writes back to IDB so saves don't block first paint.

**App-wide query persistence ([client/src/lib/queryPersist.ts](../client/src/lib/queryPersist.ts)):** the QueryClient is wrapped in `<PersistQueryClientProvider>` ([main.tsx](../client/src/main.tsx)) with a localStorage persister + `__APP_VERSION__` buster + 24h SWR window. Only queries with key prefixes `nodeSpec` / `nodeGroups` / `pluginCatalogue` are dehydrated -- high-frequency / per-session queries stay in-memory. Hard refresh paints from cached specs **before** the WebSocket connects, so canvas nodes never flash placeholder icons. The credentials catalogue uses its own dedicated `idb-keyval` warm-start (above) because its payload is large enough that localStorage's 5-10MB cap is a real constraint.

**`useNodeSpec` is a slice subscription, not a `useQuery`** ([client/src/lib/nodeSpec.ts](../client/src/lib/nodeSpec.ts)): reads via `useSyncExternalStore` filtered by `hashKey(['nodeSpec', type])`. Per-spec observer count is **0**; only the matching slot triggers a re-render. Lazy fetch is one-shot via `useEffect` gated on `isReady`. Do not re-introduce `useQuery(['nodeSpec', type])` -- N consumers create N observers, all woken on every cache write.

**Slice-subscribed cache entries MUST set `gcTime: GC_TIME.FOREVER`.** Slice subscribers don't register as TanStack observers, so without this override the cache entry is garbage-collected after the default `gcTime` (5 min) and every consumer reads `undefined`. The user-visible regression is "canvas nodes lose their icons / handles after idle." Applies to `fetchNodeSpec`, `fetchNodeGroups`, and the `useNodeGroups` `useQuery`; the persistor in `lib/queryPersist.ts` only handles cross-reload survival.

**Component rules:**
- `PanelRenderer` lazy-loads each panel type so the initial JS payload doesn't grow linearly with provider count.
- Panels are config-driven: `StatusCard`, `ActionBar`, `FieldRenderer`, `OAuthConnect` consume `ProviderConfig` fields rather than hand-coding per-provider JSX.
- Exception: EmailPanel has conditional `custom` IMAP/SMTP fields that the simple schema can't express — it gets a dedicated zod schema and RHF form. That's the boundary where config-driven hands off to hand-written.

## ParameterRenderer (pending Phase 6)

Currently a 2152-line switch on `parameter.type` ([client/src/components/ParameterRenderer.tsx](../client/src/components/ParameterRenderer.tsx)). 15+ branches for `string | number | boolean | options | collection | fixedCollection | code | file | credential | ...`.

**Phase 6 plan:** replace with `@jsonforms/react` renderer registry. Requires backend to expose a `get_node_spec` WebSocket handler returning `NodeSpec { jsonSchema, uiSchema, _uiHints? }` per the RFC. Frontend will own the custom renderer set (one file per widget under `components/inspector/renderers/`) and route via JSON Forms' tester-based dispatch. Feature flag `VITE_USE_NODESPEC` gates the rollout; the old `ParameterRenderer` deletes once stable.

See [ui_migration_plan.md](./ui_migration_plan.md) Phase 6.

## Real-time

`contexts/WebSocketContext.tsx` is the single connection + event bus. ~125 handlers (see `server/routers/websocket.py`). Handlers follow a request/response pattern via `sendRequest(type, data)` with correlation IDs. Push-only events (node status, workflow progress, token usage, android/whatsapp status) set context state directly; components subscribe via selector hooks (`useAndroidStatus`, `useNodeStatus(nodeId)`).

**Rules:**
- `useEffect` fetch-on-mount is banned for anything the backend can push. Subscribe to the context slice instead.
- All modifying operations go through WebSocket — REST is reserved for auth + webhooks.
- No polling. If a component wants fresh data, call `sendRequest` once (or use TanStack Query with `staleTime: Infinity` + manual `invalidate`).

## Ownership boundary: TanStack Query vs Zustand vs WebSocketContext

This is the rule that keeps the data layer schema-driven instead of imperatively glued together.

| Owns | What goes here | Examples |
|---|---|---|
| **TanStack Query** | Anything the server has authoritative state for. List / single-record / settings reads. Mutations that change server state. | `useWorkflowsQuery`, `useNodeParamsQuery`, `useUserSettingsQuery`, `useCatalogueQuery`, `useSaveWorkflowMutation`, `useSaveNodeParamsMutation`, `useSaveUserSettingsMutation` |
| **Zustand** | UI-only state that survives navigation. The active edit buffer for the current workflow. Sidebar/panel visibility flags. | `useAppStore.currentWorkflow` (mutable buffer), `sidebarVisible`, `proMode`, `renamingNodeId`, `useCredentialRegistry.selectedId` |
| **`useState` / `useReducer`** | Per-component transient state. Form-field drafts. Hover/focus. | text-input drafts, dropdown-open, inline-edit toggles |
| **`WebSocketContext`** | Raw WS connection, `sendRequest`, push-only broadcast slices (workflow progress, android/whatsapp/twitter status, console/terminal logs). The provider value is `useMemo`'d so unrelated state changes do not re-render every consumer. Exposes `isOpen` (socket open) and `isReady` (post init-burst) -- gate catalogue/spec queries on `isReady` to avoid racing the serial init awaits. | `androidStatus`, `consoleLogs`, broadcast streams |
| **`stores/nodeStatusStore.ts`** (Zustand) | Per-workflow node-execution statuses -- moved out of WebSocketContext so a status tick does not cascade through the React tree. `useNodeStatus(id)` is a slice selector; only the affected node's consumers re-render. Mirror this pattern for any new high-frequency push state. | `allStatuses[workflowId][nodeId]`, `currentWorkflowId` |

**Hard rules:**
- A list of server records (`workflows`, `nodeParameters`, `userSettings`, `credentialCatalogue`, `userSkills`, node output schemas) lives in TanStack Query. Never duplicate it in Zustand. Phase-1 follow-up commit `c3a7aa4` removed `savedWorkflows` from `useAppStore` for exactly this reason; Wave 3 commit `7706afb` did the same for `userSkills` in MasterSkillEditor.
- Imperative WebSocket request/response inside a component (`useEffect` + `sendRequest` + `setState`) is a code smell — wrap it in a `useQuery` hook. Inline the hook at the top of the consuming file when there's exactly one consumer (Wave 2/3 colocation rule); promote to `client/src/hooks/` when a second consumer appears. Phase-2 commit `b2b6fba` did this for `useParameterPanel` and `useOnboarding`; Wave 3 commits `2c5f227` / `7706afb` / `327f792` followed the same pattern inline inside MiddleSection / MasterSkillEditor / InputSection.
- After a mutation, **invalidate the corresponding query key**, don't manually patch a Zustand list or call a local refetch helper. Mutations that need it from non-React code use the `queryClient` singleton at [client/src/lib/queryClient.ts](../client/src/lib/queryClient.ts).
- Schema metadata for parameter behavior (selectors, validators, dynamic options) belongs in the node-definition `typeOptions`, NOT in `parameter.name === '...'` checks inside `ParameterRenderer`. Phase-5 commit `8353c48` introduced `typeOptions.loadOptionsMethod` for the WhatsApp selectors as the canonical pattern.
- **Runtime output shapes for the Input panel's variable list live on the backend** via Pydantic models in `server/services/node_output_schemas.py`. The frontend fetches them lazy via `get_node_output_schema`; real execution data takes precedence. See the "Node output shape" section below and [schema_source_of_truth_rfc.md](./schema_source_of_truth_rfc.md).
- **Never hand-roll a modal backdrop.** Destructive confirmations use `<AlertDialog>`; composite panels use the `Modal.tsx` primitive on top of shadcn `<Dialog>`. A raw `position: fixed; background: rgba(0,0,0,0.5)` in new code should not pass review.

## Schema-driven node + panel hints

Wave 2 introduced two typed fields on `INodeTypeDescription` so panels and the inspector can make rendering decisions from the schema instead of `nodeDefinition.name === '…'` string compares.

### `uiHints` — per-node panel visibility flags

Defined on `INodeTypeDescription.uiHints` ([client/src/types/INodeProperties.ts](../client/src/types/INodeProperties.ts)). Each flag is consumed by exactly one panel and defaults to `false` (the panel renders normally). 14 flags today:

| Flag | Read by | Effect |
|---|---|---|
| `hideInputSection` | `ParameterPanel`, `InputSection` | Skip the connected-inputs panel (start, skill, monitor) |
| `hideOutputSection` | `ParameterPanel`, `OutputSection` | Skip the execution-results panel |
| `hideRunButton` | `ParameterPanel` | Hide the Run button (skill / memory / tool nodes) |
| `hasCodeEditor` | `MiddleSection` | Give the params block extra flex space for an embedded code editor |
| `isMasterSkillEditor` | `MiddleSection` | Render the MasterSkillEditor split panel |
| `isMemoryPanel` | `MiddleSection` | Render the memory markdown panel + token usage stats |
| `isToolPanel` | `MiddleSection` | Surface the ToolSchemaEditor for connected services |
| `isMonitorPanel` | `MiddleSection`, `ParameterPanel` | Render the team-monitor panel |
| `showLocationPanel` | `LocationParameterPanel` | Special-case panel for nodes with map preview |
| `isAndroidToolkit` | `ToolSchemaEditor` | Toolkit aggregator (Android service hub) |
| `isChatTrigger` | `ConsolePanel` | This node is a chat-message target |
| `isConsoleSink` | `ConsolePanel` | This node consumes console output (filter source) |
| `hasSkills` | Agent panels | Connect the connected-skills section |

Adding new panel behaviour: add a flag to `INodeUIHints`, annotate the relevant node definitions, read the flag in the panel. Don't add another `nodeDefinition.name === '…'` branch.

### Node output shape — backend as single source of truth

Frontend does **not** declare output shapes anymore. The backend owns them exclusively via Pydantic models in [server/services/node_output_schemas.py](../server/services/node_output_schemas.py) (98 entries today). JSON Schema is emitted via Pydantic's `model_json_schema()` and exposed two ways:

- `GET /api/schemas/nodes/{node_type}.json` — static, long-cache (`Cache-Control: public, max-age=86400`), no auth. n8n-style static-asset pattern.
- `get_node_output_schema` WebSocket handler — authenticated editor path.

[InputSection.tsx](../client/src/components/parameterPanel/InputSection.tsx) consumes schemas lazy via `fetchNodeOutputSchema(nodeType)` (inline helper wrapping `queryClient.fetchQuery` with `staleTime: Infinity`). The draggable variable list's shape precedence is:

1. Real execution data from the last run (primary).
2. Backend-declared schema fetched on demand (fallback).
3. `{ data: 'any' }` empty state (final fallback — the legacy `sampleSchemas` map was deleted in Wave 3).

**Adding a new node type's output shape:** define a Pydantic model in `node_output_schemas.py`, register it in `NODE_OUTPUT_SCHEMAS`. The frontend picks it up automatically — no client change, no rebuild. Research and rationale in [docs-internal/schema_source_of_truth_rfc.md](./schema_source_of_truth_rfc.md).

### Renderer registry shape (Phase 6 — pending)

When the backend `get_node_spec` handler lands, the inspector will own a 4-file colocated layout under `client/src/components/inspector/`:

```
inspector/
├── ParameterRenderer.tsx     # dispatcher + 11 inline widgets + drag-drop wrapper + WIDGETS registry
├── CollectionWidget.tsx      # recursive (>150 LOC, independently testable)
├── CodeWidget.tsx            # CodeEditor + theme/toolbar plumbing
└── types.ts                  # WidgetProps discriminated union, registry tester signature
```

The DIY widget registry (RHF + zod + a tester+rank dispatch) is modeled on n8n's monolithic `ParameterInput.vue`. Library-survey research preferred this over @jsonforms / @rjsf — bundle delta ≤ +50 KB gz vs +60–110 KB for any framework option, and shadcn theming would have to be hand-authored against any of them. `@rjsf/core` v6 + `@rjsf/shadcn` is the documented escape hatch if collection recursion bites.

## Reusable component primitives

| File | When to use |
|---|---|
| [client/src/components/ui/action-button.tsx](../client/src/components/ui/action-button.tsx) | Colored "soft" toolbar button (Run / Save / Cancel / Reset / Stop). One `tone` prop drives bg/border/text against a fixed dracula palette via static Tailwind classes. Replaces the `actionButtonStyle(color, isDisabled)` style helper that was copy-pasted across 4 files. |
| [client/src/components/ui/alert-dialog.tsx](../client/src/components/ui/alert-dialog.tsx) | Confirmation / destructive-action modals. **Never hand-roll a `position: fixed; background: rgba(0,0,0,0.5)` backdrop** — use `<AlertDialog open onOpenChange>` with `AlertDialogHeader` / `AlertDialogDescription` / `AlertDialogFooter`. Focus trap, escape-to-close, and `role="alertdialog"` come from Radix. MiddleSection Clear Memory + Reset Skill dialogs are the canonical consumers (Wave 3 commit `61bf23c`). |
| [client/src/components/ui/sonner.tsx](../client/src/components/ui/sonner.tsx) | The `<Toaster />` mount — call `import { toast } from 'sonner'` directly at use sites; do not wrap. |
| [client/src/components/ui/Modal.tsx](../client/src/components/ui/Modal.tsx) | Composition primitive on top of shadcn `<Dialog>`. Owns the recurring "title bar with centered headerActions and a close button + size-constrained content panel" 8 panels share. Not an antd facade. For destructive confirmations prefer `AlertDialog` above. |
| `client/src/components/ui/{button,input,select,switch,checkbox,form,…}.tsx` | shadcn-generated primitives. Add new ones via `npx shadcn@latest add <name>`. Don't re-implement what the registry ships. |

## Theme + canvas chrome

[index.css](../client/src/index.css) also styles React Flow, scrollbars, and dot grid against the CSS-var palette. No inline hex codes in theme-sensitive surfaces — everything references `hsl(var(--...))` so dark mode flips cleanly.

## Build + dev

```bash
# from repo root
pnpm install            # client deps + server Python deps via postinstall
pnpm run dev            # concurrently: client (Vite :3000) + server (uvicorn :3010) + temporal + whatsapp
pnpm run build          # full prod build; bundle analyzer at dist/stats.html if ANALYZE=1

# client-only
cd client
pnpm dev                # Vite dev server
pnpm build              # Vite prod build (Tailwind v4 via @tailwindcss/vite plugin)
pnpm exec tsc --noEmit  # Typecheck
```

**Adding shadcn components:**
```bash
cd client
MACHINAOS_INSTALLING=true npx shadcn@latest add <name>
```
The `MACHINAOS_INSTALLING=true` env var suppresses the recursive project postinstall hook during shadcn's internal `pnpm install`. Without it the hook's `machina build` run fails and shadcn aborts before writing the component file.

## Migration history (for context)

This architecture is the post-migration state. Pre-migration was antd + `styled-components` + a custom theme.ts-driven palette. See [ui_migration_plan.md](./ui_migration_plan.md) for the phase-by-phase transition and the 17 commits that executed it.

**`useAppTheme()` is grandfathered** for the canvas node components (`AIAgentNode`, `SquareNode`, `TriggerNode`, `StartNode`, `ToolkitNode`, `TeamMonitorNode`, `BaseChatModelNode`, `ModelNode`, `GenericNode`) and `EdgeConditionEditor` only — they interpolate per-definition `nodeColor` into gradients, borders, and React Flow `<Handle>` styles. Every other surface uses Tailwind + the token tiers above.
