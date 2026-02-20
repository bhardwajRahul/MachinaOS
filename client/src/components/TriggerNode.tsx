/**
 * TriggerNode - Visual component for trigger nodes (no input connections)
 *
 * Trigger nodes start workflows and have only output handles.
 * Based on SquareNode design but without input handles.
 *
 * Used for: cronScheduler, webhookTrigger, whatsappReceive, start
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWebSocket, useWhatsAppStatus } from '../contexts/WebSocketContext';
import { PlayCircleFilled, ScheduleOutlined } from '@ant-design/icons';
import { Google } from '@lobehub/icons';

const TriggerNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode, renamingNodeId, setRenamingNodeId, updateNodeData } = useAppStore();
  const [isConfigured, setIsConfigured] = useState(false);
  const isDisabled = data?.disabled === true;

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get node status from WebSocket context
  const { getNodeStatus } = useWebSocket();
  const nodeStatus = getNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';

  // Check if this is a WhatsApp trigger
  const isWhatsAppTrigger = type === 'whatsappReceive';
  const whatsappStatus = useWhatsAppStatus();

  // Combine waiting and executing states for glow animation (matching SquareNode pattern)
  // - waiting: Trigger is listening for events (cron scheduled, webhook listening)
  // - executing: Trigger is actively running
  // Both states show the glow animation to indicate active state
  const isExecuting = executionStatus === 'executing' || executionStatus === 'waiting';

  const definition = nodeDefinitions[type as keyof typeof nodeDefinitions];

  // Check configuration status
  useEffect(() => {
    const hasRequiredParams = data && Object.keys(data).length > 0;
    setIsConfigured(hasRequiredParams);
  }, [data]);

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

    // Only save if label changed and is not empty
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

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  // Get status indicator color based on execution state
  const getStatusIndicatorColor = () => {
    // Combined executing/waiting state - show purple with glow
    if (isExecuting) {
      return theme.dracula.purple;
    }
    if (executionStatus === 'success') {
      return theme.dracula.green;
    }
    if (executionStatus === 'error') {
      return theme.dracula.red;
    }

    // WhatsApp trigger - use connection status when idle
    if (isWhatsAppTrigger) {
      if (whatsappStatus.connected) return theme.dracula.green;
      if (whatsappStatus.pairing) return theme.dracula.orange;
      return theme.dracula.red;
    }

    // Idle state - show configured status
    return isConfigured ? theme.dracula.green : theme.dracula.orange;
  };

  const getStatusTitle = () => {
    switch (executionStatus) {
      case 'executing':
        return 'Executing...';
      case 'waiting':
        return nodeStatus?.message || 'Waiting for trigger event...';
      case 'success':
        return 'Trigger fired successfully';
      case 'error':
        return `Error: ${nodeStatus?.data?.error || 'Unknown error'}`;
      default:
        // WhatsApp trigger status
        if (isWhatsAppTrigger) {
          if (whatsappStatus.connected) return 'WhatsApp connected - ready to receive';
          if (whatsappStatus.pairing) return 'Pairing in progress...';
          return 'WhatsApp not connected';
        }
        return isConfigured ? 'Trigger configured and ready' : 'Click to configure trigger';
    }
  };

  // Check if string is likely an emoji
  const isEmoji = (str: string): boolean => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{231A}-\u{231B}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{E000}-\u{F8FF}]/u;
    return emojiRegex.test(str);
  };

  // Helper to render icon
  const renderIcon = (icon: string) => {
    // Handle component markers (e.g., 'component:Gmail')
    if (icon.startsWith('component:')) {
      const componentName = icon.replace('component:', '');
      if (componentName === 'Gmail') {
        return <Google.Color size={28} />;
      }
      // Fallback for unknown component markers
      return '⚡';
    }

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

    if (isEmoji(icon)) {
      return icon;
    }

    // Fallback
    return '⚡';
  };

  // Get trigger icon for display
  const getTriggerIcon = () => {
    // Start node - use PlayCircleFilled icon
    if (type === 'start') {
      return <PlayCircleFilled style={{ fontSize: 28, color: theme.dracula.cyan }} />;
    }

    // Cron Scheduler - use ScheduleOutlined
    if (type === 'cronScheduler') {
      return <ScheduleOutlined style={{ fontSize: 28, color: definition?.defaults?.color || nodeColor }} />;
    }

    // Use the icon from the node definition if available
    if (definition?.icon && typeof definition.icon === 'string') {
      return renderIcon(definition.icon);
    }

    // Fallback to lightning bolt for triggers
    return '⚡';
  };

  // Get the node color from definition or use default trigger color
  const nodeColor = definition?.defaults?.color || '#f59e0b';

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
      {/* Main Trigger Node */}
      {/* Show glow animation for both executing and waiting states */}
      <div
        style={{
          position: 'relative',
          width: theme.nodeSize.square,
          height: theme.nodeSize.square,
          borderRadius: theme.borderRadius.lg,
          background: theme.isDarkMode
            ? `linear-gradient(135deg, ${nodeColor}25 0%, ${theme.colors.background} 100%)`
            : `linear-gradient(145deg, #ffffff 0%, ${nodeColor}08 100%)`,
          border: `2px solid ${
            isExecuting
              ? (theme.isDarkMode ? theme.dracula.purple : '#2563eb')
              : selected
                ? theme.colors.focus
                : theme.isDarkMode ? nodeColor + '80' : `${nodeColor}40`
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.text,
          fontSize: theme.nodeSize.squareIcon,
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: isExecuting
            ? theme.isDarkMode
              ? `0 4px 12px ${theme.dracula.purple}66, 0 0 0 3px ${theme.dracula.purple}4D`
              : `0 0 0 3px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(37, 99, 235, 0.35)`
            : selected
              ? `0 4px 12px ${theme.colors.focusRing}, 0 0 0 1px ${theme.colors.focusRing}`
              : theme.isDarkMode
                ? `0 2px 8px ${nodeColor}40`
                : `0 2px 8px ${nodeColor}20, 0 4px 12px rgba(0,0,0,0.06)`,
          // Subtle animation for both modes
          animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {/* Disabled Overlay */}
        {isDisabled && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(128, 128, 128, 0.4)',
            borderRadius: 'inherit',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: '20px', opacity: 0.8, color: theme.colors.textSecondary }}>||</span>
          </div>
        )}

        {/* Trigger Icon */}
        {getTriggerIcon()}

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
          title="Configure Trigger"
        >
          ⚙️
        </button>

        {/* Execution Status Indicator */}
        {/* Status Indicator - glows for both waiting and executing states */}
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
                ? `0 0 6px ${theme.dracula.purple}80`
                : '0 0 4px rgba(37, 99, 235, 0.5)'
              : theme.isDarkMode
                ? `0 1px 2px ${theme.colors.shadow}`
                : '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 30,
            // Subtle pulse animation for both modes
            animation: isExecuting ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
          title={getStatusTitle()}
        />

        {/* NO INPUT HANDLE - Trigger nodes don't have inputs */}

        {/* Trigger Badge - Lightning bolt indicator on bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '-4px',
            width: theme.nodeSize.outputBadge,
            height: theme.nodeSize.outputBadge,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.dracula.yellow,
            border: `1px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.fontSize.xs,
            zIndex: 30,
            boxShadow: theme.isDarkMode
              ? `0 1px 3px ${theme.colors.shadow}`
              : '0 1px 3px rgba(0,0,0,0.15)',
          }}
          title="Trigger Node - Starts workflow execution"
        >
          <span style={{ lineHeight: 1, color: theme.isDarkMode ? theme.colors.background : '#1a1d21' }}>⚡</span>
        </div>

        {/* Output Handle (right side) */}
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
            width: theme.nodeSize.handle,
            height: theme.nodeSize.handle,
            backgroundColor: isConfigured ? nodeColor : theme.colors.textSecondary,
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            borderRadius: '50%',
            zIndex: 20
          }}
          title="Trigger Output"
        />

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
            title="Output data available - click node to view"
          >
            <span style={{ lineHeight: 1 }}>D</span>
          </div>
        )}
      </div>

      {/* Trigger Name Below Node */}
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
            marginTop: theme.spacing.sm,
            width: '100%',
            maxWidth: '120px',
            padding: '2px 4px',
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
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
            marginTop: theme.spacing.sm,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text,
            lineHeight: '1.2',
            textAlign: 'center',
            maxWidth: '120px',
            cursor: 'text',
          }}
          title="Double-click to rename"
        >
          {data?.label || definition?.displayName}
        </div>
      )}

    </div>
  );
};

export default TriggerNode;
