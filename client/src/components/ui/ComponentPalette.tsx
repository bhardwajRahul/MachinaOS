import React from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ComponentPaletteProps } from '../../types/ComponentTypes';
import { INodeTypeDescription } from '../../types/INodeProperties';
import ComponentItem from './ComponentItem';
import CollapsibleSection from './CollapsibleSection';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { resolveIcon, resolveLibraryIcon, isImageIcon } from '../../assets/icons';
import { useNodeGroups, NodeGroupEntry } from '../../lib/nodeSpec';

// Wave 10.B: palette section metadata (icon / label / color / visibility)
// is fetched from the backend GET /api/schemas/nodes/groups endpoint.
// Frontend retains zero per-category tables.

const ComponentPalette: React.FC<ComponentPaletteProps> = ({
  nodeDefinitions,
  searchQuery,
  onSearchChange,
  collapsedSections,
  onToggleSection,
  onDragStart,
  proMode = false,  // Default to simple mode
}) => {
  const theme = useAppTheme();

  // Backend-driven group metadata via the shared WS-in-queryFn hook.
  // `useNodeGroups` returns the full query result so we can render a
  // loading skeleton on cold first-paint instead of masking the filter
  // or flashing an empty palette.
  const { data: groupIndex, isPending: groupsLoading } = useNodeGroups();

  const getCategoryConfig = React.useCallback((category: string) => {
    const entry = groupIndex?.[category.toLowerCase()] as NodeGroupEntry | undefined;
    // No icon/color fallback: if the backend doesn't declare the
    // group via register_group(), the empty string surfaces the gap.
    return {
      icon: entry?.icon ?? '',
      color: entry?.color || theme.colors.textSecondary,
      label: entry?.label || category,
    };
  }, [groupIndex, theme.colors.textSecondary]);

  const categorizedComponents = React.useMemo(() => {
    const categories: Record<string, INodeTypeDescription[]> = {};

    const filteredDefinitions = Object.values(nodeDefinitions).filter((definition) => {
      // Filter by search query
      if (searchQuery.trim()) {
        try {
          const query = searchQuery.toLowerCase();
          const matchesQuery = (
            (definition.displayName || '').toLowerCase().includes(query) ||
            (definition.description || '').toLowerCase().includes(query) ||
            (definition.group?.[0] || '').toLowerCase().includes(query)
          );
          if (!matchesQuery) return false;
        } catch (error) {
          return false;
        }
      }

      // Wave 10.B: simple-mode visibility comes from backend
      // GroupMetadata.visibility ('normal' shown, 'dev' hidden in simple
      // mode). No frontend SIMPLE_MODE_CATEGORIES table.
      if (!proMode) {
        const firstGroup = (definition.group?.[0] || '').toLowerCase();
        const groupVisibility = groupIndex?.[firstGroup]?.visibility;
        if (groupVisibility !== 'normal' && groupVisibility !== 'all') {
          return false;
        }
      }

      return true;
    });

    filteredDefinitions.forEach((definition) => {
      try {
        const categoryKey = (definition.group?.[0] || 'Uncategorized').toLowerCase();
        if (!categories[categoryKey]) categories[categoryKey] = [];
        categories[categoryKey].push(definition);
      } catch (error) {
        // Skip invalid definitions
      }
    });

    return categories;
  }, [nodeDefinitions, searchQuery, proMode, groupIndex]);

  const totalComponents = Object.values(categorizedComponents).reduce(
    (acc, components) => acc + components.length, 
    0
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-muted/30">
      {/* Header Section */}
      <div className="border-b border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Components</h2>
          <Badge variant="secondary" className="text-xs font-medium">
            {totalComponents}
          </Badge>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-3">
        {groupsLoading ? (
          <PaletteSkeleton />
        ) : Object.keys(categorizedComponents).length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center text-muted-foreground">
            <Search className="mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">
              No components found matching "{searchQuery}"
            </p>
          </div>
        ) : (
          Object.entries(categorizedComponents).map(([category, components]) => {
            try {
              const isCollapsed = collapsedSections[category];
              const config = getCategoryConfig(category);

              return (
                <div key={category || 'unknown'} className="mb-3">
                  <CollapsibleSection
                    title={
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md text-base"
                            style={{ backgroundColor: `${config.color}20` }}
                          >
                            {(() => {
                              const LibIcon = resolveLibraryIcon(config.icon);
                              if (LibIcon) return <LibIcon size={16} />;
                              const resolved = resolveIcon(config.icon);
                              if (resolved && isImageIcon(resolved)) {
                                return <img src={resolved} alt="" className="h-4 w-4 object-contain" />;
                              }
                              return resolved || '📦';
                            })()}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {config.label}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium"
                          style={{ backgroundColor: `${config.color}15`, color: 'hsl(var(--muted-foreground))' }}
                        >
                          {components?.length || 0}
                        </Badge>
                      </div>
                    }
                    isCollapsed={isCollapsed}
                    onToggle={() => onToggleSection(category)}
                  >
                    <div className="grid gap-2 pt-2">
                      {(components || []).map((definition, idx) => {
                        try {
                          return (
                            <ComponentItem
                              key={definition?.name || `item-${idx}`}
                              definition={definition}
                              onDragStart={onDragStart}
                            />
                          );
                        } catch (error) {
                          return null;
                        }
                      })}
                    </div>
                  </CollapsibleSection>
                </div>
              );
            } catch (error) {
              return null;
            }
          })
        )}
      </div>
    </div>
  );
};

/**
 * Loading placeholder for the palette's categories area. Mirrors the
 * shape of three collapsed category sections + a handful of items so
 * the layout does not jump when real data arrives.
 */
const PALETTE_SKELETON_CATEGORIES = 3;
const PALETTE_SKELETON_ITEMS_PER_CATEGORY = 2;

const PaletteSkeleton: React.FC = () => (
  <div aria-busy="true" aria-label="Loading components">
    {Array.from({ length: PALETTE_SKELETON_CATEGORIES }).map((_, categoryIdx) => (
      <div key={categoryIdx} className="mb-3 space-y-2">
        <div className="flex items-center gap-2.5 px-1 py-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid gap-2 pt-2">
          {Array.from({ length: PALETTE_SKELETON_ITEMS_PER_CATEGORY }).map((_, itemIdx) => (
            <Skeleton key={itemIdx} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default ComponentPalette;