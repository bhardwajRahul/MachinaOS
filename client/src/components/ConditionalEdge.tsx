/**
 * ConditionalEdge - Custom React Flow edge with condition label display
 *
 * Renders edges with visual indicators for conditional branching:
 * - Displays condition label as a badge on the edge
 * - Different styling for conditional vs unconditional edges
 * - Click-to-edit condition support
 */
import React, { useState, useCallback, memo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import { useAppTheme } from '../hooks/useAppTheme';
import { ConditionalEdgeData, formatConditionLabel } from '../types/EdgeCondition';
import EdgeConditionEditor from './EdgeConditionEditor';

interface ConditionalEdgeProps extends EdgeProps<ConditionalEdgeData> {
  /** Callback when condition is updated */
  onConditionUpdate?: (
    edgeId: string,
    condition: ConditionalEdgeData['condition'],
    label: string | undefined
  ) => void;
}

const ConditionalEdge: React.FC<ConditionalEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
  onConditionUpdate,
}) => {
  const theme = useAppTheme();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Calculate edge path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });

  const hasCondition = !!data?.condition;
  const displayLabel = data?.label || (hasCondition && data?.condition ? formatConditionLabel(data.condition) : null);

  const handleLabelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditorOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const handleConditionSave = useCallback(
    (condition: ConditionalEdgeData['condition'], label: string | undefined) => {
      if (onConditionUpdate) {
        onConditionUpdate(id, condition, label);
      }
    },
    [id, onConditionUpdate]
  );

  // Label badge style
  const labelBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'all',
    cursor: 'pointer',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    fontFamily: 'system-ui, sans-serif',
    backgroundColor: hasCondition
      ? `${theme.dracula.cyan}20`
      : theme.colors.backgroundPanel,
    border: `1px solid ${hasCondition ? `${theme.dracula.cyan}60` : theme.colors.border}`,
    color: hasCondition ? theme.dracula.cyan : theme.colors.textSecondary,
    whiteSpace: 'nowrap',
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxShadow: selected ? `0 0 6px ${theme.dracula.purple}` : 'none',
    transition: theme.transitions.fast,
  };

  // Add condition button (shown when no condition)
  const addButtonStyle: React.CSSProperties = {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'all',
    cursor: 'pointer',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: theme.colors.backgroundPanel,
    border: `1px dashed ${theme.colors.border}`,
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    opacity: selected ? 1 : 0,
    transition: theme.transitions.fast,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hasCondition ? theme.dracula.cyan : undefined,
          strokeWidth: hasCondition ? 2 : undefined,
          strokeDasharray: hasCondition ? '5 3' : undefined,
        }}
      />

      <EdgeLabelRenderer>
        {/* Condition label or add button */}
        {displayLabel ? (
          <div
            style={{
              ...labelBadgeStyle,
              left: labelX,
              top: labelY,
            }}
            onClick={handleLabelClick}
            title={`Click to edit condition: ${displayLabel}`}
          >
            <span style={{ marginRight: '4px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5"/>
                <path d="M8 3H3v5"/>
                <path d="M21 3l-7 7"/>
                <path d="M3 3l7 7"/>
                <path d="M3 21l7-7"/>
                <path d="M21 21l-7-7"/>
                <path d="M16 21h5v-5"/>
                <path d="M8 21H3v-5"/>
              </svg>
            </span>
            {displayLabel}
          </div>
        ) : (
          <div
            style={{
              ...addButtonStyle,
              left: labelX,
              top: labelY,
            }}
            onClick={handleLabelClick}
            title="Click to add condition"
          >
            +
          </div>
        )}
      </EdgeLabelRenderer>

      {/* Condition Editor Modal */}
      <EdgeConditionEditor
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        condition={data?.condition}
        label={data?.label}
        onSave={handleConditionSave}
      />
    </>
  );
};

export default memo(ConditionalEdge);
