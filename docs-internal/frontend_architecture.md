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
├── factories/
│   └── baseChatModelFactory.ts     # AI chat-model node definitions
│
├── nodeDefinitions/                # Static TS node registry (will become schema-driven in Phase 6)
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
4. `styles/theme.ts` (`theme.dracula.*`, `theme.colors.*`) is still exported for legacy call sites. New code should prefer Tailwind classes (`bg-primary`, `text-dracula-green`) or `hsl(var(--...))` inline.

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
| **`WebSocketContext`** | Raw WS connection, `sendRequest`, push-only broadcast slices (node status, workflow progress, android status). | `nodeStatuses`, `androidStatus`, `consoleLogs`, broadcast streams |

**Hard rules:**
- A list of server records (`workflows`, `nodeParameters`, `userSettings`, `credentialCatalogue`) lives in TanStack Query. Never duplicate it in Zustand. Phase-1 follow-up commit `c3a7aa4` removed `savedWorkflows` from `useAppStore` for exactly this reason.
- Imperative WebSocket request/response inside a component (`useEffect` + `sendRequest` + `setState`) is a code smell — wrap it in a `useQuery` hook. Phase-2 commit `b2b6fba` did this for `useParameterPanel` and `useOnboarding`.
- After a mutation, **invalidate the corresponding query key**, don't manually patch a Zustand list. Mutations that need it from non-React code use the `queryClient` singleton at [client/src/lib/queryClient.ts](../client/src/lib/queryClient.ts).
- Schema metadata for parameter behavior (selectors, validators, dynamic options) belongs in the node-definition `typeOptions`, NOT in `parameter.name === '...'` checks inside `ParameterRenderer`. Phase-5 commit `8353c48` introduced `typeOptions.loadOptionsMethod` for the WhatsApp selectors as the canonical pattern.

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

### `outputSchema` — runtime output shape for InputSection

Defined on `INodeTypeDescription.outputSchema`. Plain primitive type names (`'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'`) at leaves, or nested objects. `InputSection` reads this when populating the draggable variable list for downstream nodes. The legacy 350-line `sampleSchemas` map in `InputSection.tsx` is the fallback for nodes not yet annotated; new node definitions should set `outputSchema` directly.

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

## Reusable component primitives (Wave 2)

| File | When to use |
|---|---|
| [client/src/components/ui/action-button.tsx](../client/src/components/ui/action-button.tsx) | Colored "soft" toolbar button (Run / Save / Cancel / Reset / Stop). One `tone` prop drives bg/border/text against a fixed dracula palette via static Tailwind classes. Replaces the `actionButtonStyle(color, isDisabled)` style helper that was copy-pasted across 4 files. |
| [client/src/components/ui/sonner.tsx](../client/src/components/ui/sonner.tsx) | The `<Toaster />` mount — call `import { toast } from 'sonner'` directly at use sites; do not wrap. |
| [client/src/components/ui/Modal.tsx](../client/src/components/ui/Modal.tsx) | Composition primitive on top of shadcn `<Dialog>`. Owns the recurring "title bar with centered headerActions and a close button + size-constrained content panel" 8 panels share. Not an antd facade. |
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
