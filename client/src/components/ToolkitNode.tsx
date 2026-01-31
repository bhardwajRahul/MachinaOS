/**
 * ToolkitNode - A node component with top/bottom connectors for aggregating services.
 * Used by Android Toolkit to receive Android service nodes from bottom and output to AI Agent from top.
 *
 * Based on SquareNode but with vertical handle layout:
 * - Input handle at BOTTOM (receives from Android service nodes)
 * - Output handle at TOP (connects to AI Agent's input-tools)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWebSocket } from '../contexts/WebSocketContext';
import { SKILL_NODE_TYPES } from '../nodeDefinitions/skillNodes';

const ToolkitNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode, renamingNodeId, setRenamingNodeId, updateNodeData } = useAppStore();

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get node status from WebSocket context
  const { getNodeStatus } = useWebSocket();
  const nodeStatus = getNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';

  const definition = nodeDefinitions[type as keyof typeof nodeDefinitions];

  // Check if this is a skill node (skill nodes don't have bottom input handle)
  const isSkillNode = type ? SKILL_NODE_TYPES.includes(type) : false;

  // Execution state
  const isExecuting = executionStatus === 'executing' || executionStatus === 'waiting';

  // Sync with global renaming state
  useEffect(() => {
    if (renamingNodeId === id) {
      setIsRenaming(true);
      setEditLabel(data?.label || definition?.displayName || type || '');
    } else {
      setIsRenaming(false);
    }
  }, [renamingNodeId, id, data?.label, definition?.displayName, type]);

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
    const originalLabel = data?.label || definition?.displayName || type || '';

    if (newLabel && newLabel !== originalLabel) {
      updateNodeData(id, { ...data, label: newLabel });
    }

    setIsRenaming(false);
    setRenamingNodeId(null);
  }, [editLabel, data, definition?.displayName, type, id, updateNodeData, setRenamingNodeId]);

  // Handle cancel rename
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenamingNodeId(null);
  }, [setRenamingNodeId]);

  // Handle double-click to rename
  const handleLabelDoubleClick = useCallback(() => {
    setRenamingNodeId(id);
  }, [id, setRenamingNodeId]);

  // Handle parameters click
  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  // Get the node color from definition or use Android green
  const nodeColor = definition?.defaults?.color || '#3DDC84';

  // Helper to check if string is emoji
  const isEmoji = (str: string): boolean => {
    const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;
    return emojiRegex.test(str);
  };

  // Helper to render icon (handles URLs, emojis, and icon names)
  const renderIcon = (icon: string) => {
    // Handle image URLs and data URIs
    if (icon.startsWith('http') || icon.startsWith('data:') || icon.startsWith('/')) {
      return (
        <img
          src={icon}
          alt="icon"
          style={{
            width: '28px',
            height: '28px',
            objectFit: 'contain',
            borderRadius: '4px'
          }}
        />
      );
    }

    // If it's already an emoji, return it directly
    if (isEmoji(icon)) {
      return icon;
    }

    // Fallback
    return icon;
  };

  // Get icon from definition
  const getIcon = () => {
    if (definition?.icon) {
      return renderIcon(definition.icon);
    }
    return '📱'; // Default Android icon
  };

  // Get status indicator color
  const getStatusIndicatorColor = () => {
    if (isExecuting) return theme.dracula.cyan;
    if (executionStatus === 'success') return theme.dracula.green;
    if (executionStatus === 'error') return theme.dracula.red;
    return theme.dracula.green; // Toolkit is always ready
  };

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
          width: theme.nodeSize.square,
          height: theme.nodeSize.square,
          borderRadius: theme.borderRadius.lg,
          background: theme.isDarkMode
            ? `linear-gradient(135deg, ${nodeColor}25 0%, ${theme.colors.background} 100%)`
            : `linear-gradient(145deg, #ffffff 0%, ${nodeColor}08 100%)`,
          border: `2px solid ${isExecuting
            ? (theme.isDarkMode ? theme.dracula.cyan : '#2563eb')
            : selected
              ? theme.colors.focus
              : theme.isDarkMode ? nodeColor + '80' : `${nodeColor}40`}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.text,
          fontSize: theme.nodeSize.squareIcon,
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: isExecuting
            ? theme.isDarkMode
              ? `0 4px 12px ${theme.dracula.cyan}66, 0 0 0 3px ${theme.dracula.cyan}4D`
              : `0 0 0 3px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(37, 99, 235, 0.35)`
            : selected
              ? `0 4px 12px ${theme.colors.focusRing}, 0 0 0 1px ${theme.colors.focusRing}`
              : theme.isDarkMode
                ? `0 2px 8px ${nodeColor}40`
                : `0 2px 8px ${nodeColor}20, 0 4px 12px rgba(0,0,0,0.06)`,
          animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      >
        {/* Service Icon */}
        {getIcon()}

        {/* Parameters Button */}
        <button
          onClick={handleParametersClick}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: theme.nodeSize.paramButton,
            height: theme.nodeSize.paramButton,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.isDarkMode ? theme.colors.backgroundAlt : '#ffffff',
            border: `1px solid ${theme.isDarkMode ? theme.colors.border : '#d1d5db'}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.fontSize.xs,
            color: theme.colors.textSecondary,
            fontWeight: '400',
            transition: theme.transitions.fast,
            zIndex: 30,
            boxShadow: theme.isDarkMode
              ? `0 1px 3px ${theme.colors.shadow}`
              : '0 1px 4px rgba(0,0,0,0.1)'
          }}
          title="Edit Toolkit Parameters"
        >
          ⚙️
        </button>

        {/* Status Indicator */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            width: theme.nodeSize.statusIndicator,
            height: theme.nodeSize.statusIndicator,
            borderRadius: '50%',
            backgroundColor: getStatusIndicatorColor(),
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            boxShadow: isExecuting
              ? theme.isDarkMode
                ? `0 0 6px ${theme.dracula.cyan}80`
                : '0 0 4px rgba(37, 99, 235, 0.5)'
              : theme.isDarkMode
                ? `0 1px 2px ${theme.colors.shadow}`
                : '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 30,
            animation: isExecuting ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
          title={isExecuting ? 'Executing...' : 'Toolkit ready'}
        />

        {/* TOP Output Handle - connects to AI Agent/Zeenie */}
        <Handle
          id="output-main"
          type="source"
          position={Position.Top}
          isConnectable={isConnectable}
          style={{
            position: 'absolute',
            top: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: theme.nodeSize.handle,
            height: theme.nodeSize.handle,
            backgroundColor: nodeColor,
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            borderRadius: '50%',
            zIndex: 20
          }}
          title={isSkillNode ? "Connect to Zeenie's skill input" : "Connect to AI Agent's tool input"}
        />

        {/* BOTTOM Input Handle - receives from Android nodes (not shown for skill nodes) */}
        {!isSkillNode && (
          <Handle
            id="input-main"
            type="target"
            position={Position.Bottom}
            isConnectable={isConnectable}
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: theme.nodeSize.handle,
              height: theme.nodeSize.handle,
              backgroundColor: theme.isDarkMode ? theme.colors.background : '#ffffff',
              border: `2px solid ${theme.isDarkMode ? theme.colors.textSecondary : '#6b7280'}`,
              borderRadius: '50%',
              zIndex: 20
            }}
            title="Connect Android service nodes here"
          />
        )}

        {/* Output Data Indicator */}
        {executionStatus === 'success' && nodeStatus?.data && (
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: theme.nodeSize.outputBadge,
              height: theme.nodeSize.outputBadge,
              borderRadius: theme.borderRadius.sm,
              backgroundColor: theme.dracula.green,
              border: `1px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.fontSize.xs,
              color: 'white',
              fontWeight: 'bold',
              zIndex: 30,
              boxShadow: theme.isDarkMode
                ? '0 1px 3px rgba(0,0,0,0.2)'
                : '0 1px 3px rgba(0,0,0,0.15)',
            }}
            title="Output data available"
          >
            <span style={{ lineHeight: 1 }}>D</span>
          </div>
        )}
      </div>

      {/* Node Name Below */}
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            if (e.key === 'Escape') handleCancelRename();
          }}
          style={{
            marginTop: theme.spacing.sm,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text,
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.focus}`,
            borderRadius: theme.borderRadius.sm,
            padding: '2px 6px',
            textAlign: 'center',
            width: '100px',
            outline: 'none',
          }}
        />
      ) : (
        <div
          onDoubleClick={handleLabelDoubleClick}
          style={{
            marginTop: theme.spacing.sm,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text,
            lineHeight: '1.2',
            textAlign: 'center',
            maxWidth: '120px',
            cursor: 'text',
          }}
        >
          {data?.label || definition?.displayName}
        </div>
      )}
    </div>
  );
};

export default ToolkitNode;
