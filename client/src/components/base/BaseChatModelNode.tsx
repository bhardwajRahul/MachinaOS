import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../../types/NodeTypes';
import { useAppStore } from '../../store/useAppStore';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useApiKeys } from '../../hooks/useApiKeys';
import { useAppTheme } from '../../hooks/useAppTheme';

interface BaseChatModelNodeProps extends NodeProps<NodeData> {
  providerId: string;
  displayName: string;
  icon: string;
  color: string;
}

const BaseChatModelNode: React.FC<BaseChatModelNodeProps> = ({
  id,
  type,
  data,
  isConnectable,
  selected,
  providerId,
  displayName,
  icon,
  color
}) => {
  const theme = useAppTheme();
  const { setSelectedNode } = useAppStore();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const isDisabled = data?.disabled === true;

  // Get node status from WebSocket context
  const { getNodeStatus } = useWebSocket();
  const { getStoredApiKey } = useApiKeys();
  const nodeStatus = getNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';

  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const apiKey = await getStoredApiKey(providerId);
        const hasApiKeyStored = !!apiKey;
        setHasApiKey(hasApiKeyStored);

        const hasModel = data?.model && data.model.trim() !== '';
        const configured = hasModel && hasApiKeyStored;

        setIsConfigured(configured);
      } catch (error) {
        console.error(`[BaseChatModelNode] ${displayName} ${id}: Configuration check error:`, error);
        setHasApiKey(false);
        setIsConfigured(false);
      }
    };

    checkConfiguration();
  }, [data?.model, id, providerId, displayName, getStoredApiKey]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  // Get status indicator color based on execution state
  const getStatusIndicatorColor = () => {
    switch (executionStatus) {
      case 'executing':
        return theme.dracula.cyan; // Executing
      case 'success':
        return theme.dracula.green; // Success
      case 'error':
        return theme.dracula.red; // Error
      default:
        // Idle - use configuration status
        return isConfigured ? theme.dracula.green : hasApiKey ? theme.dracula.orange : theme.dracula.red;
    }
  };

  const getStatusTitle = () => {
    switch (executionStatus) {
      case 'executing':
        return 'Executing...';
      case 'success':
        return 'Execution successful';
      case 'error':
        return `Error: ${nodeStatus?.data?.error || 'Unknown error'}`;
      default:
        return isConfigured
          ? 'Model configured and ready'
          : hasApiKey
            ? 'API key found, model needs configuration'
            : 'API key required';
    }
  };

  const isExecuting = executionStatus === 'executing';

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: theme.fontSize.xs,
        cursor: 'pointer',
      }}
    >
      {/* Main Circular Node */}
      <div
        style={{
          position: 'relative',
          width: theme.nodeSize.square,
          height: theme.nodeSize.square,
          borderRadius: '50%',
          background: isConfigured ? color : theme.colors.textMuted,
          border: `2px solid ${selected ? theme.colors.focus : isExecuting ? theme.dracula.cyan : isConfigured ? color : theme.dracula.red}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: type === 'aiAgent' ? theme.fontSize.lg : theme.nodeSize.squareIcon,
          fontWeight: theme.fontWeight.semibold,
          transition: theme.transitions.fast,
          boxShadow: selected
            ? `0 4px 12px ${theme.colors.focusRing}, 0 0 0 2px ${theme.colors.focusRing}`
            : isExecuting
              ? `0 4px 12px ${theme.dracula.cyan}66, 0 0 0 3px ${theme.dracula.cyan}4D`
              : isConfigured
                ? `0 2px 8px ${theme.colors.shadow}`
                : `0 2px 8px ${theme.dracula.red}4D`,
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

        {/* Provider Icon */}
        {icon}

        {/* Parameters Button */}
        <button
          onClick={handleParametersClick}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: theme.nodeSize.paramButton,
            height: theme.nodeSize.paramButton,
            borderRadius: '50%',
            backgroundColor: theme.colors.backgroundAlt,
            border: `1px solid ${theme.colors.border}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.fontSize.xs,
            color: theme.colors.textSecondary,
            fontWeight: '400',
            transition: theme.transitions.fast,
            zIndex: 30,
            boxShadow: `0 1px 3px ${theme.colors.shadow}`
          }}
          title="Edit Model Parameters"
        >
          ⚙️
        </button>

        {/* Configuration/Execution Status Indicator */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            width: theme.nodeSize.statusIndicator,
            height: theme.nodeSize.statusIndicator,
            borderRadius: '50%',
            backgroundColor: getStatusIndicatorColor(),
            border: `2px solid ${theme.colors.background}`,
            boxShadow: isExecuting
              ? `0 0 8px ${theme.dracula.cyan}99`
              : `0 1px 3px ${theme.colors.shadow}`,
            zIndex: 30,
            animation: isExecuting ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
          title={getStatusTitle()}
        />

        {/* Diamond Output Handle */}
        <Handle
          id="output-model"
          type="source"
          position={Position.Top}
          isConnectable={isConnectable}
          style={{
            position: 'absolute',
            top: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: theme.nodeSize.statusIndicator,
            height: theme.nodeSize.statusIndicator,
            backgroundColor: isConfigured ? color : theme.colors.textMuted,
            border: `2px solid ${theme.colors.background}`,
            borderRadius: '0',
            opacity: isConfigured ? 1 : 0.6,
            zIndex: 20
          }}
          title={isConfigured ? 'Model Configuration Output - Connect to AI Agent' : 'Connect to AI Agent (configure API key and model before running)'}
        />

        {/* Diamond Input Handle for Prompt */}
        <Handle
          id="input-prompt"
          type="target"
          position={Position.Bottom}
          isConnectable={isConnectable}
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: theme.nodeSize.statusIndicator,
            height: theme.nodeSize.statusIndicator,
            backgroundColor: theme.colors.background,
            border: `2px solid ${theme.colors.textMuted}`,
            borderRadius: '0',
            zIndex: 20
          }}
          title="Prompt Input (optional)"
        />
      </div>

      {/* Model Name Below Circle */}
      <div
        style={{
          marginTop: theme.spacing.sm,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          color: theme.colors.text,
          lineHeight: '1.2',
          textAlign: 'center',
          maxWidth: '120px'
        }}
      >
        {data?.label || displayName}
      </div>
    </div>
  );
};

export default BaseChatModelNode;