import React, { useState } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface SavedWorkflow {
  id: string;
  name: string;
  createdAt: Date;
  lastModified: Date;
  nodeCount: number;
}

interface WorkflowSidebarProps {
  workflows: SavedWorkflow[];
  currentWorkflowId?: string;
  onSelectWorkflow: (workflow: SavedWorkflow) => void;
  onDeleteWorkflow?: (id: string) => void;
}

const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  workflows,
  currentWorkflowId,
  onSelectWorkflow,
  onDeleteWorkflow,
}) => {
  const theme = useAppTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Debug: Force component update when workflows change
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    forceUpdate();
  }, [workflows]);
  
  return (
    <div
      style={{
        width: theme.layout.workflowSidebarWidth,
        height: '100%',
        backgroundColor: theme.colors.backgroundPanel,
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: theme.spacing.xl,
          borderBottom: `1px solid ${theme.colors.border}`,
          background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundAlt} 100%)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <div
            style={{
              width: theme.spacing.xxl,
              height: theme.spacing.xxl,
              borderRadius: theme.borderRadius.md,
              background: `linear-gradient(135deg, ${theme.accent.blue}30 0%, ${theme.accent.cyan}30 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.fontSize.lg,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.accent.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.semibold,
                color: theme.colors.text,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Workflows
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSize.xs,
                color: theme.colors.textSecondary,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {workflows.length} saved
            </p>
          </div>
        </div>
      </div>

      {/* Workflows List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: theme.spacing.md,
        }}
      >
        {workflows.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: `${theme.spacing.xxl} ${theme.spacing.lg}`,
              color: theme.colors.textSecondary,
              fontSize: theme.fontSize.sm,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: `0 auto ${theme.spacing.lg}`,
                borderRadius: theme.borderRadius.lg,
                background: `linear-gradient(135deg, ${theme.colors.backgroundAlt} 0%, ${theme.colors.background} 100%)`,
                border: `2px dashed ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <p style={{ margin: 0, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>No workflows yet</p>
            <p style={{ margin: `${theme.spacing.sm} 0 0`, fontSize: theme.fontSize.xs, lineHeight: '1.5' }}>
              Create your first workflow<br />to get started
            </p>
          </div>
        ) : (
          workflows.map((workflow) => {
            const isSelected = currentWorkflowId === workflow.id;
            const isHovered = hoveredId === workflow.id;
            const accentColor = theme.accent.cyan;

            return (
              <div
                key={workflow.id}
                style={{
                  position: 'relative',
                  padding: theme.spacing.lg,
                  marginBottom: theme.spacing.sm,
                  backgroundColor: isSelected
                    ? `${accentColor}20`
                    : isHovered
                      ? theme.colors.backgroundAlt
                      : theme.colors.background,
                  border: `1px solid ${isSelected ? `${accentColor}50` : theme.colors.border}`,
                  borderLeft: isSelected ? `3px solid ${accentColor}` : `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.fast}`,
                  boxShadow: isSelected
                    ? `0 2px 8px ${accentColor}25`
                    : `0 1px 3px ${theme.colors.shadowLight}`,
                }}
                onClick={() => {
                  onSelectWorkflow(workflow);
                }}
                onMouseEnter={() => setHoveredId(workflow.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: theme.borderRadius.sm,
                      background: isSelected
                        ? `linear-gradient(135deg, ${accentColor}40 0%, ${accentColor}20 100%)`
                        : `linear-gradient(135deg, ${theme.colors.backgroundAlt} 0%, ${theme.colors.background} 100%)`,
                      border: `1px solid ${isSelected ? `${accentColor}50` : theme.colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: `all ${theme.transitions.fast}`,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isSelected ? accentColor : theme.colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"/>
                      <polyline points="8 6 2 12 8 18"/>
                    </svg>
                  </div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: theme.fontSize.base,
                      fontWeight: theme.fontWeight.medium,
                      color: isSelected ? accentColor : theme.colors.text,
                      fontFamily: 'system-ui, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {workflow.name}
                  </h4>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: theme.fontSize.xs,
                    color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  <span>{workflow.nodeCount} nodes</span>
                  <span>{formatDate(workflow.lastModified)}</span>
                </div>

                {/* Delete button - show on hover */}
                {isHovered && onDeleteWorkflow && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${workflow.name}"?`)) {
                        onDeleteWorkflow(workflow.id);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: theme.spacing.sm,
                      right: theme.spacing.sm,
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: theme.dracula.red + '20',
                      color: theme.dracula.red,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      transition: `all ${theme.transitions.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.dracula.red + '40';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.dracula.red + '20';
                    }}
                    title="Delete workflow"
                  >
                    x
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkflowSidebar;