# Output Panel Architecture

Modern renderer registry pattern for execution output display. Replaces the 1500-line monolith `NodeOutputPanel.tsx` with a pluggable, lazy-loaded renderer system.

## Research basis

Three parallel agents audited: n8n/Retool/Langflow/Vercel AI SDK/Open WebUI output patterns, Shadcn + Tailwind ecosystem components, and all MachinaOs backend handler response shapes.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Dispatch model | Explicit `output_type` field from backend | Vercel AI SDK pattern. No client-side type guessing. Backend knows the node type and sets it. |
| JSON viewer | `react-json-view-lite` (~3 KB) | Lightest maintained lib. Collapsible tree, dark mode via CSS vars. Replaces custom `highlightJSON`. |
| Markdown | `ReactMarkdown` + `remarkGfm` + `remarkBreaks` + Tailwind `prose` | Already in use. Standard stack (ChatGPT, Perplexity use same). |
| Code blocks | `prismjs` (already installed) | Good enough. `shiki` is better but adds 8 KB for marginal gain. |
| Tabular data | `@tanstack/react-table` (already installed via TanStack Query) | Headless, Tailwind-friendly. For search results, filesystem listings. |
| Composition | Shadcn-style slots (`OutputCard` with named children) | No class inheritance. Each section is an independent component. |
| Lazy loading | `React.lazy` per renderer | Same pattern as credentials `PanelRenderer`. Only loaded on first encounter. |
| Fallback | Raw JSON tree (`react-json-view-lite`) | Every output is valid JSON. If no typed renderer matches, show the tree. |

## Backend contract

Every handler MUST return `output_type` in the result so the frontend can dispatch without guessing:

```python
# server/services/handlers/ai.py
return {
    "success": True,
    "result": {
        "output_type": "markdown",      # <-- renderer dispatch key
        "response": "Hello!...",
        "thinking": None,
        "model": "gemini-3-flash",
        "provider": "gemini",
        ...
    }
}

# server/services/handlers/search.py
return {
    "success": True,
    "result": {
        "output_type": "search_results",
        "query": "...",
        "results": [...],
        ...
    }
}

# server/services/handlers/filesystem.py
return {
    "success": True,
    "result": {
        "output_type": "shell",
        "stdout": "...",
        "exit_code": 0,
        "command": "ls -la",
        ...
    }
}
```

### Output types (from backend handler audit)

| `output_type` | Source handlers | Response shape |
|---|---|---|
| `markdown` | `ai.py` (all agents), `text.py` | `{response, thinking?, model, provider, agent_type, iterations}` |
| `search_results` | `search.py` (brave, serper, perplexity) | `{query, results[], result_count, provider, answer?, citations?}` |
| `code_output` | `code.py` (python, js, ts) | `{output, console_output}` |
| `shell` | `filesystem.py` (shell node) | `{stdout, exit_code, command, truncated}` |
| `file_content` | `filesystem.py` (fileRead) | `{content, file_path}` |
| `file_op` | `filesystem.py` (fileModify) | `{operation, file_path, occurrences}` |
| `file_list` | `filesystem.py` (fsSearch) | `{path?, entries[]?, pattern?, matches[]?, count}` |
| `document` | `document.py` (scraper, parser) | `{items[], item_count, errors}` |
| `browser` | `browser.py` | `{operation, data, session}` |
| `todo` | `todo_service.py` (writeTodos) | `{todos (JSON string), count}` |
| `json` | Any handler without a specific type | Fallback — raw JSON tree |

## Frontend architecture

```
client/src/components/output/
├── OutputPanel.tsx              # Main container — extracts output_type, dispatches
├── OutputCard.tsx               # Composition wrapper (header + content + raw toggle)
├── ThinkingBlock.tsx            # Collapsible thinking/reasoning (already exists)
├── ExecutionMeta.tsx            # Provider/model/agent_type tags
├── registry.ts                 # output_type → React.lazy component map
├── renderers/
│   ├── MarkdownRenderer.tsx    # prose + ReactMarkdown (AI responses)
│   ├── JsonRenderer.tsx        # react-json-view-lite wrapper
│   ├── SearchRenderer.tsx      # Card list with title/snippet/url
│   ├── CodeRenderer.tsx        # Prism + console output
│   ├── ShellRenderer.tsx       # Pre-formatted stdout + exit code badge
│   ├── FileContentRenderer.tsx # Content with file path header
│   ├── FileListRenderer.tsx    # Directory listing / grep matches
│   ├── TableRenderer.tsx       # @tanstack/react-table for tabular data
│   ├── TodoRenderer.tsx        # Checklist with status icons
│   └── ErrorRenderer.tsx       # Styled error display
└── utils/
    ├── detect.ts               # Fallback type detection if output_type missing
    └── types.ts                # OutputType enum + renderer props interfaces
```

### Registry pattern

```tsx
// registry.ts
import { lazy, type ComponentType } from 'react';

export type OutputType =
  | 'markdown' | 'search_results' | 'code_output' | 'shell'
  | 'file_content' | 'file_op' | 'file_list' | 'document'
  | 'browser' | 'todo' | 'json';

export interface RendererProps {
  data: Record<string, any>;
}

const RENDERERS: Record<OutputType, () => Promise<{ default: ComponentType<RendererProps> }>> = {
  markdown:       () => import('./renderers/MarkdownRenderer'),
  search_results: () => import('./renderers/SearchRenderer'),
  code_output:    () => import('./renderers/CodeRenderer'),
  shell:          () => import('./renderers/ShellRenderer'),
  file_content:   () => import('./renderers/FileContentRenderer'),
  file_op:        () => import('./renderers/FileContentRenderer'),
  file_list:      () => import('./renderers/FileListRenderer'),
  document:       () => import('./renderers/TableRenderer'),
  browser:        () => import('./renderers/JsonRenderer'),
  todo:           () => import('./renderers/TodoRenderer'),
  json:           () => import('./renderers/JsonRenderer'),
};

const cache = new Map<OutputType, ComponentType<RendererProps>>();

export function getRenderer(type: OutputType): ComponentType<RendererProps> {
  if (!cache.has(type)) {
    cache.set(type, lazy(RENDERERS[type] ?? RENDERERS.json));
  }
  return cache.get(type)!;
}
```

### OutputPanel (the dispatcher)

```tsx
// OutputPanel.tsx
import { Suspense } from 'react';
import { Spin } from 'antd';
import { getRenderer, type OutputType } from './registry';
import { detectOutputType } from './utils/detect';
import OutputCard from './OutputCard';
import ThinkingBlock from './ThinkingBlock';
import ExecutionMeta from './ExecutionMeta';

function OutputPanel({ result }: { result: ExecutionResult }) {
  const data = result.outputs || result.data || result.nodeData?.[0]?.[0]?.json || {};
  const inner = data.result || data;

  // Backend sets output_type; fallback to client-side detection
  const outputType: OutputType = inner.output_type || detectOutputType(inner);
  const Renderer = getRenderer(outputType);

  return (
    <OutputCard result={result}>
      {inner.thinking && <ThinkingBlock thinking={inner.thinking} provider={inner.provider} />}
      <Suspense fallback={<Spin size="small" />}>
        <Renderer data={inner} />
      </Suspense>
      <ExecutionMeta data={inner} />
    </OutputCard>
  );
}
```

### Example renderer (MarkdownRenderer)

```tsx
// renderers/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { RendererProps } from '../registry';

export default function MarkdownRenderer({ data }: RendererProps) {
  const text = data.response || data.text || data.content || data.message || '';
  const formatted = typeof text === 'string'
    ? text.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    : JSON.stringify(text, null, 2);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {formatted}
      </ReactMarkdown>
    </div>
  );
}
```

### Example renderer (JsonRenderer)

```tsx
// renderers/JsonRenderer.tsx
import { JsonView, darkTheme, defaultTheme } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { useAppTheme } from '../../../hooks/useAppTheme';
import type { RendererProps } from '../registry';

export default function JsonRenderer({ data }: RendererProps) {
  const theme = useAppTheme();
  return (
    <JsonView
      data={data}
      shouldExpandNode={(level) => level < 2}
      style={theme.isDarkMode ? darkTheme : defaultTheme}
    />
  );
}
```

## Fallback type detection (for backends that haven't added `output_type` yet)

```ts
// utils/detect.ts
import type { OutputType } from '../registry';

export function detectOutputType(data: any): OutputType {
  if (!data || typeof data !== 'object') return 'json';
  if (data.response || data.thinking) return 'markdown';
  if (data.query && Array.isArray(data.results)) return 'search_results';
  if (data.output !== undefined || data.console_output) return 'code_output';
  if (data.stdout !== undefined && data.command !== undefined) return 'shell';
  if (data.content && data.file_path) return 'file_content';
  if (data.operation && data.file_path) return 'file_op';
  if (data.entries || data.matches) return 'file_list';
  if (Array.isArray(data.items) && data.item_count !== undefined) return 'document';
  if (data.todos) return 'todo';
  return 'json';
}
```

## Migration plan

| Phase | Work | Effort |
|---|---|---|
| **A** | Add `output_type` field to all backend handlers (11 handler files) | 1 hour |
| **B** | Install `react-json-view-lite`, create `components/output/` directory structure, implement `registry.ts` + `OutputPanel.tsx` + `OutputCard.tsx` | 2 hours |
| **C** | Implement `MarkdownRenderer` + `JsonRenderer` + `ErrorRenderer` (covers 80% of output) | 1 hour |
| **D** | Implement `ShellRenderer` + `CodeRenderer` + `FileContentRenderer` + `FileListRenderer` | 2 hours |
| **E** | Implement `SearchRenderer` + `TodoRenderer` + `TableRenderer` | 2 hours |
| **F** | Replace `NodeOutputPanel` import in `OutputSection.tsx` with new `OutputPanel` | 30 min |
| **G** | Delete old `NodeOutputPanel.tsx` + `OutputDisplayPanel.tsx` | 10 min |
| **H** | Verify all node types render correctly | 1 hour |

Total: ~10 hours across 8 phases. Each phase is independently shippable.

## Dependencies to add

```bash
pnpm add react-json-view-lite    # ~3 KB, JSON tree viewer with dark mode
```

Everything else (`ReactMarkdown`, `remarkGfm`, `remarkBreaks`, `prismjs`, `@tanstack/react-table`, `@tailwindcss/typography`) is already installed.

## What NOT to build

- Custom JSON syntax highlighter (use `react-json-view-lite`)
- Custom markdown CSS (use Tailwind `prose`)
- Custom type detection DSL (simple `if` chain in `detect.ts` is sufficient)
- Server-side rendering of output HTML (keep it client-side, same as Vercel/OpenWebUI)
- Per-node-type rendering logic in the dispatcher (renderers are per-OUTPUT-TYPE, not per-node-type)

## References

- Vercel AI SDK message parts: https://vercel.com/blog/ai-sdk-6
- react-json-view-lite: https://www.npmjs.com/package/react-json-view-lite
- Tailwind Typography: https://tailwindcss.com/docs/plugins/typography
- Shadcn Collapsible: https://ui.shadcn.com/docs/components/collapsible
- n8n binary data: https://ryanandmattdatascience.com/n8n-binary-data/
- Open WebUI tool rendering: https://deepwiki.com/open-webui/open-webui/6.3-tool-execution-system
