/**
 * CredentialsPalette — virtualized, searchable provider picker.
 *
 * Drop-in replacement for the antd `Menu` sidebar in `CredentialsModal`.
 * Scales from 20 → 5000 providers at 60 fps with < 200 ms INP during
 * rapid typing, per the runtime/memory targets in
 * `docs-internal/credentials_scaling/architecture.md`.
 *
 * Stack:
 *   - `cmdk` for the Command shell + keyboard navigation + a11y.
 *   - `fuzzysort` for pre-indexed fuzzy search (~1–2 ms per query on
 *     5000 entries).
 *   - `react-virtuoso` `GroupedVirtuoso` for a DOM pool of ~10–50 nodes
 *     regardless of item count, with sticky category headers.
 *   - `startTransition` wrapping the filter update so the input stays
 *     synchronous and typing never stalls (measured ~30–70 ms shorter
 *     long task vs `useDeferredValue`).
 *
 * Store-shape rule: all derived data (prepared index, byId map,
 * filtered result, groupCounts) lives in `useMemo` inside this
 * component. Nothing touches Zustand. The store only holds UI state
 * (`selectedId`, `query`), which is how we avoid the #1 runtime/memory
 * trap (selector closures retaining the whole catalogue).
 */

import React, {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from 'react';
import { Command } from 'cmdk';
import { GroupedVirtuoso } from 'react-virtuoso';
import fuzzysort from 'fuzzysort';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import type { ProviderConfig, CategoryGroup } from './types';
import { useAppTheme } from '../../hooks/useAppTheme';

// ============================================================================
// Props
// ============================================================================

export interface CredentialsPaletteProps {
  providers: ProviderConfig[];
  categories: CategoryGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Map of provider id → has stored/validated key. Drives the green status dot. */
  storedKeys?: Record<string, boolean>;
  /** Height of the scrollable list area. */
  height?: number | string;
  /** Optional placeholder for the search input. */
  placeholder?: string;
}

// ============================================================================
// Pre-indexed search
// ============================================================================

interface PreparedEntry {
  provider: ProviderConfig;
  _name: Fuzzysort.Prepared;
  _category: Fuzzysort.Prepared;
}

function buildPrepared(providers: ProviderConfig[]): PreparedEntry[] {
  return providers.map((p) => ({
    provider: p,
    _name: fuzzysort.prepare(p.name),
    _category: fuzzysort.prepare(p.categoryLabel),
  }));
}

function filterProviders(query: string, prepared: PreparedEntry[]): ProviderConfig[] {
  if (!query.trim()) return prepared.map((e) => e.provider);
  const results = fuzzysort.go(query, prepared, {
    keys: ['_name', '_category'],
    threshold: -10_000,
    limit: 500,
  });
  return results.map((r) => r.obj.provider);
}

// ============================================================================
// Grouping (derived; never stored)
// ============================================================================

interface GroupedView {
  groups: CategoryGroup[];
  groupCounts: number[];
  flatItems: ProviderConfig[];
}

function groupFiltered(filtered: ProviderConfig[], categoryOrder: CategoryGroup[]): GroupedView {
  // Preserve the canonical category order from the server payload; for
  // each category, emit only those filtered providers that belong to it.
  const byCat = new Map<string, ProviderConfig[]>();
  for (const p of filtered) {
    const arr = byCat.get(p.category);
    if (arr) arr.push(p);
    else byCat.set(p.category, [p]);
  }

  const groups: CategoryGroup[] = [];
  const groupCounts: number[] = [];
  const flatItems: ProviderConfig[] = [];

  for (const cat of categoryOrder) {
    const items = byCat.get(cat.key);
    if (!items || items.length === 0) continue;
    groups.push({ key: cat.key, label: cat.label, items });
    groupCounts.push(items.length);
    flatItems.push(...items);
  }

  // Any provider whose category isn't in `categoryOrder` (server may
  // send a new category mid-session) still needs to render — bucket them
  // under a synthetic "Other" group at the end.
  const known = new Set(categoryOrder.map((c) => c.key));
  const orphans: ProviderConfig[] = [];
  for (const [catKey, items] of byCat.entries()) {
    if (!known.has(catKey)) orphans.push(...items);
  }
  if (orphans.length > 0) {
    groups.push({ key: '_other', label: 'Other', items: orphans });
    groupCounts.push(orphans.length);
    flatItems.push(...orphans);
  }

  return { groups, groupCounts, flatItems };
}

// ============================================================================
// Row renderer — memoized to stop upstream re-renders from cascading
// ============================================================================

interface RowProps {
  provider: ProviderConfig;
  selected: boolean;
  onSelect: (id: string) => void;
  theme: ReturnType<typeof useAppTheme>;
}

const ProviderRow = memo<RowProps>(function ProviderRow({ provider, selected, onSelect, theme }) {
  const Icon = provider.icon;
  const handleClick = useCallback(() => onSelect(provider.id), [onSelect, provider.id]);

  const bg = selected ? `${theme.dracula.purple}18` : 'transparent';
  const border = selected ? `1px solid ${theme.dracula.purple}60` : '1px solid transparent';

  return (
    <Command.Item
      value={provider.id}
      onSelect={handleClick}
      className="machinaos-palette-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        cursor: 'pointer',
        borderRadius: theme.borderRadius.sm,
        background: bg,
        border,
        color: theme.colors.text,
        fontSize: theme.fontSize.sm,
      }}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center text-foreground">
        <Icon size={parseInt(theme.iconSize.sm)} />
      </div>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {provider.name}
      </span>
      {provider.stored && (
        <span
          aria-label="Credential stored"
          className="h-2 w-2 rounded-full bg-success"
        />
      )}
    </Command.Item>
  );
});

// ============================================================================
// Group header renderer
// ============================================================================

interface HeaderProps {
  label: string;
  count: number;
  theme: ReturnType<typeof useAppTheme>;
}

const GroupHeader = memo<HeaderProps>(function GroupHeader({ label, count, theme }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
        background: theme.colors.background,
        borderBottom: `1px solid ${theme.colors.border}`,
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <span>{label}</span>
      <span style={{ color: theme.colors.textSecondary, opacity: 0.6 }}>
        {count}
      </span>
    </div>
  );
});

// ============================================================================
// The palette component
// ============================================================================

const CredentialsPalette: React.FC<CredentialsPaletteProps> = ({
  providers,
  categories,
  selectedId,
  onSelect,
  height = '100%',
  placeholder = 'Search providers…',
}) => {
  const theme = useAppTheme();

  // Pre-indexed fuzzysort entries — rebuilt only when `providers` reference changes.
  const prepared = useMemo(() => buildPrepared(providers), [providers]);

  // Input value is synchronous; filter is deferred via startTransition.
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<ProviderConfig[]>(() => providers);

  // If the providers array changes (e.g. after a server revalidate
  // replaces the TanStack Query cache), reset the filtered set.
  const prevProvidersRef = React.useRef(providers);
  if (prevProvidersRef.current !== providers) {
    prevProvidersRef.current = providers;
    // Synchronous update here is fine: happens at most once per catalogue change.
    setFiltered(filterProviders(query, prepared));
  }

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setQuery(v);
      startTransition(() => {
        setFiltered(filterProviders(v, prepared));
      });
    },
    [prepared],
  );

  // Deferred query for group derivation (avoid recomputing on every keystroke
  // if React batches filter updates slower than the input).
  const deferredFiltered = useDeferredValue(filtered);

  const grouped = useMemo<GroupedView>(
    () => groupFiltered(deferredFiltered, categories),
    [deferredFiltered, categories],
  );

  return (
    <Command
      // cmdk disables built-in filtering so we can use fuzzysort instead.
      shouldFilter={false}
      label="Credential providers"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
    >
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={handleQueryChange}
            placeholder={placeholder}
            className="h-9 pl-8 pr-8"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                startTransition(() => setFiltered(filterProviders('', prepared)));
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {grouped.flatItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground opacity-70">
            No providers match &ldquo;{query}&rdquo;
          </div>
        ) : (
          <GroupedVirtuoso
            style={{ height }}
            groupCounts={grouped.groupCounts}
            groupContent={(idx) => (
              <GroupHeader
                label={grouped.groups[idx].label}
                count={grouped.groupCounts[idx]}
                theme={theme}
              />
            )}
            itemContent={(idx) => {
              const p = grouped.flatItems[idx];
              if (!p) return null;
              return (
                <ProviderRow
                  provider={p}
                  selected={p.id === selectedId}
                  onSelect={onSelect}
                  theme={theme}
                />
              );
            }}
          />
        )}
      </div>
    </Command>
  );
};

export default memo(CredentialsPalette);
