import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { PlayCircleFilled } from '@ant-design/icons';

const StartNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const { setSelectedNode, renamingNodeId, setRenamingNodeId, updateNodeData } = useAppStore();
  const theme = useAppTheme();

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultLabel = 'Start';

  // Sync with global renaming state
  useEffect(() => {
    if (renamingNodeId === id) {
      setIsRenaming(true);
      setEditLabel(data?.label || defaultLabel);
    } else {
      setIsRenaming(false);
    }
  }, [renamingNodeId, id, data?.label]);

  // Focus and select input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Handle save rename
  const handleSaveRename = useCallback(() => {
    const newLabel = editLabel.trim();
    const originalLabel = data?.label || defaultLabel;

    // Only save if label changed and is not empty
    if (newLabel && newLabel !== originalLabel) {
      updateNodeData(id, { ...data, label: newLabel });
    }

    setIsRenaming(false);
    setRenamingNodeId(null);
  }, [editLabel, data, id, updateNodeData, setRenamingNodeId]);

  // Handle cancel rename
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenamingNodeId(null);
  }, [setRenamingNodeId]);

  // Handle double-click to rename
  const handleLabelDoubleClick = useCallback(() => {
    setRenamingNodeId(id);
  }, [id, setRenamingNodeId]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  const nodeColor = theme.dracula.cyan; // Cyan color for start node (neutral "begin" color)

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {/* Main Square Node */}
      <div
        style={{
          position: 'relative',
          width: '60px',
          height: '60px',
          borderRadius: '8px',
          background: theme.isDarkMode
            ? `linear-gradient(135deg, ${nodeColor}20 0%, ${theme.colors.background} 100%)`
            : `linear-gradient(145deg, #ffffff 0%, ${nodeColor}10 100%)`,
          border: `2px solid ${selected
            ? theme.colors.focus
            : theme.isDarkMode ? `${nodeColor}60` : `${nodeColor}50`}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.text,
          fontSize: '28px',
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: selected
            ? `0 4px 12px ${theme.colors.focusRing}, 0 0 0 1px ${theme.colors.focusRing}`
            : theme.isDarkMode
              ? `0 2px 8px ${nodeColor}30`
              : `0 2px 8px ${nodeColor}25, 0 4px 12px rgba(0,0,0,0.06)`,
        }}
      >
        {/* Play Icon */}
        <PlayCircleFilled style={{ fontSize: 28, color: nodeColor }} />

        {/* Parameters Button */}
        <button
          onClick={handleParametersClick}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '16px',
            height: '16px',
            borderRadius: '3px',
            backgroundColor: theme.isDarkMode ? theme.colors.backgroundAlt : '#ffffff',
            border: `1px solid ${theme.isDarkMode ? theme.colors.border : `${nodeColor}40`}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            color: theme.colors.textSecondary,
            fontWeight: '400',
            transition: 'all 0.2s ease',
            zIndex: 30,
            boxShadow: theme.isDarkMode
              ? `0 1px 3px ${theme.colors.shadow}`
              : `0 1px 4px ${nodeColor}20`
          }}
          title="Edit Parameters"
        >
          {'\u2699\uFE0F'}
        </button>

        {/* Status Indicator - always green for start */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: nodeColor,
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            boxShadow: theme.isDarkMode
              ? `0 1px 2px ${theme.colors.shadow}`
              : '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 30,
          }}
          title="Workflow start point"
        />

        {/* Input Handle - hidden but present for consistency */}
        <Handle
          id="input-main"
          type="target"
          position={Position.Left}
          isConnectable={false}
          style={{
            visibility: 'hidden',
            width: '1px',
            height: '1px',
          }}
        />

        {/* Output Handle */}
        <Handle
          id="output-main"
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          style={{
            position: 'absolute',
            right: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '8px',
            height: '8px',
            backgroundColor: nodeColor,
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            borderRadius: '50%',
            zIndex: 20
          }}
          title="Workflow Output"
        />
      </div>

      {/* Name Below Square */}
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSaveRename();
            } else if (e.key === 'Escape') {
              handleCancelRename();
            }
            e.stopPropagation();
          }}
          onBlur={handleSaveRename}
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: '8px',
            width: '100%',
            maxWidth: '120px',
            padding: '2px 4px',
            fontSize: '12px',
            fontWeight: '500',
            color: theme.colors.text,
            backgroundColor: theme.colors.backgroundElevated,
            border: `1px solid ${theme.dracula.purple}`,
            borderRadius: theme.borderRadius.sm,
            outline: 'none',
            textAlign: 'center',
          }}
        />
      ) : (
        <div
          onDoubleClick={handleLabelDoubleClick}
          style={{
            marginTop: '8px',
            fontSize: '12px',
            fontWeight: '500',
            color: theme.colors.text,
            lineHeight: '1.2',
            textAlign: 'center',
            maxWidth: '120px',
            cursor: 'text',
          }}
          title="Double-click to rename"
        >
          {data?.label || defaultLabel}
        </div>
      )}

    </div>
  );
};

export default StartNode;
