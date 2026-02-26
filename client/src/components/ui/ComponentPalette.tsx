import React from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ComponentPaletteProps } from '../../types/ComponentTypes';
import { INodeTypeDescription } from '../../types/INodeProperties';
import ComponentItem from './ComponentItem';
import CollapsibleSection from './CollapsibleSection';
import googleSvg from '../../assets/icons/search/google.svg?raw';

// Category icons - emoji strings or { svg: string } for inline SVG icons
const CATEGORY_ICONS: Record<string, string | { svg: string }> = {
  workflow: '⚡',
  trigger: '🕐',
  ai: '🤖',
  agent: '🤖',
  model: '🧬',
  skill: '🎯',
  tool: '🛠️',
  location: '📍',
  social: '📱',
  android: '📱',
  chat: '💭',
  code: '💻',
  document: '🗄️',
  utility: '🔧',
  api: '🕷️',
  search: '🔍',
  google: { svg: googleSvg },
  scheduler: '📅',
};

// Categories that should be merged into 'social' (Social Media)
const SOCIAL_CATEGORIES = ['whatsapp', 'social'];

// Categories shown in simple (noob) mode - only AI related
const SIMPLE_MODE_CATEGORIES = ['agent', 'model', 'skill', 'tool'];

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

  const getCategoryConfig = (category: string) => {
    const key = category.toLowerCase();
    // Use theme-specific category colors (darker for light mode, vibrant for dark mode)
    const colors = theme.colors as Record<string, string>;
    const colorMap: Record<string, string> = {
      workflow: colors.categoryWorkflow || theme.dracula.orange,
      trigger: colors.categoryTrigger || theme.dracula.pink,
      ai: colors.categoryAI || theme.dracula.purple,
      agent: colors.categoryAgent || theme.dracula.purple,
      model: colors.categoryModel || theme.dracula.cyan,
      skill: colors.categorySkill || theme.dracula.green,
      tool: colors.categoryTool || theme.dracula.green,
      location: colors.categoryLocation || theme.dracula.red,
      social: colors.categorySocial || theme.dracula.green,
      android: colors.categoryAndroid || theme.dracula.cyan,
      chat: colors.categoryChat || theme.dracula.yellow,
      code: colors.categoryCode || theme.dracula.orange,
      document: colors.categoryTrigger || theme.dracula.pink,
      utility: colors.categoryUtil || theme.dracula.purple,
      api: colors.categoryCode || theme.dracula.orange,
      search: colors.categoryModel || theme.dracula.cyan,
      google: theme.accent.blue,
      scheduler: colors.categoryTrigger || theme.dracula.pink,
    };
    const labelMap: Record<string, string> = {
      workflow: 'Workflows',
      trigger: 'Triggers',
      ai: 'AI',
      agent: 'AI Agents',
      model: 'AI Models',
      skill: 'AI Skills',
      tool: 'AI Tools',
      location: 'Location',
      social: 'Social',
      android: 'Android',
      chat: 'Chat',
      code: 'Code',
      document: 'Documents',
      utility: 'Utilities',
      api: 'API & Scraping',
      search: 'Search',
      google: 'Google Workspace',
      scheduler: 'Schedulers',
    };
    return {
      icon: CATEGORY_ICONS[key] || '📦',
      color: colorMap[key] || theme.colors.textSecondary,
      label: labelMap[key] || category
    };
  };

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

      // Filter by proMode - in simple mode, only show AI-related categories
      if (!proMode) {
        const categoryKey = (definition.group?.[0] || '').toLowerCase();
        if (!SIMPLE_MODE_CATEGORIES.includes(categoryKey)) {
          return false;
        }
      }

      return true;
    });

    filteredDefinitions.forEach((definition) => {
      try {
        let categoryKey = definition.group?.[0] || 'Uncategorized';

        // Merge whatsapp and social categories into 'social'
        if (SOCIAL_CATEGORIES.includes(categoryKey.toLowerCase())) {
          categoryKey = 'social';
        }

        if (!categories[categoryKey]) {
          categories[categoryKey] = [];
        }
        categories[categoryKey].push(definition);
      } catch (error) {
        // Skip invalid definitions
      }
    });

    return categories;
  }, [nodeDefinitions, searchQuery, proMode]);

  const totalComponents = Object.values(categorizedComponents).reduce(
    (acc, components) => acc + components.length, 
    0
  );

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: theme.colors.backgroundPanel,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header Section */}
      <div style={{
        padding: theme.spacing.lg,
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.background,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
          <h2 style={{
            margin: 0,
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
            fontFamily: 'system-ui, sans-serif',
          }}>
            Components
          </h2>
          <span style={{
            fontSize: theme.fontSize.xs,
            padding: '4px 10px',
            backgroundColor: theme.colors.backgroundAlt,
            borderRadius: '12px',
            color: theme.colors.textSecondary,
            fontWeight: theme.fontWeight.medium,
          }}>
            {totalComponents}
          </span>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              paddingLeft: '36px',
              fontSize: theme.fontSize.sm,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.colors.backgroundAlt,
              color: theme.colors.text,
              fontFamily: 'system-ui, sans-serif',
              outline: 'none',
              transition: `all ${theme.transitions.fast}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.focus;
              e.currentTarget.style.backgroundColor = theme.colors.background;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
            }}
          />
          <svg
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              color: theme.colors.textSecondary,
              pointerEvents: 'none',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Categories */}
      <div style={{ 
        padding: theme.spacing.md,
        flex: 1,
        overflowY: 'auto',
      }}>
        {Object.keys(categorizedComponents).length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: theme.spacing.xxl,
            color: theme.colors.textSecondary,
          }}>
            <svg
              style={{ width: '48px', height: '48px', marginBottom: theme.spacing.md, opacity: 0.5 }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p style={{ margin: 0, fontSize: theme.fontSize.sm }}>
              No components found matching "{searchQuery}"
            </p>
          </div>
        ) : (
          Object.entries(categorizedComponents).map(([category, components]) => {
            try {
              const isCollapsed = collapsedSections[category];
              const config = getCategoryConfig(category);

              return (
                <div key={category || 'unknown'} style={{ marginBottom: theme.spacing.md }}>
                  <CollapsibleSection
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: `${config.color}20`,
                            borderRadius: '6px',
                            fontSize: '16px',
                          }}>
                            {typeof config.icon === 'object' && 'svg' in config.icon ? (
                              <span
                                dangerouslySetInnerHTML={{ __html: config.icon.svg }}
                                style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              />
                            ) : (
                              config.icon
                            )}
                          </span>
                          <span style={{
                            fontWeight: theme.fontWeight.semibold,
                            color: theme.colors.text,
                          }}>
                            {config.label}
                          </span>
                        </div>
                        <span style={{
                          fontSize: theme.fontSize.xs,
                          padding: '3px 10px',
                          backgroundColor: `${config.color}15`,
                          borderRadius: '12px',
                          color: theme.colors.textSecondary,
                          fontWeight: theme.fontWeight.medium,
                        }}>
                          {components?.length || 0}
                        </span>
                      </div>
                    }
                    isCollapsed={isCollapsed}
                    onToggle={() => onToggleSection(category)}
                  >
                    <div style={{
                      display: 'grid',
                      gap: theme.spacing.sm,
                      paddingTop: theme.spacing.sm,
                    }}>
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

export default ComponentPalette;