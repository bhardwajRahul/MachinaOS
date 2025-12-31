import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import AIAgentExecutionService from '../services/execution/aiAgentExecutionService';
import { useAppTheme } from '../hooks/useAppTheme';
import { useNodeStatus } from '../contexts/WebSocketContext';

// LangGraph phase icons and labels
const PHASE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  initializing: { icon: '⚡', label: 'Initializing', color: '#8be9fd' },
  loading_memory: { icon: '💾', label: 'Loading Memory', color: '#bd93f9' },
  memory_loaded: { icon: '✓', label: 'Memory Ready', color: '#50fa7b' },
  building_graph: { icon: '🔗', label: 'Building Graph', color: '#ffb86c' },
  invoking_llm: { icon: '🧠', label: 'Thinking...', color: '#ff79c6' },
  saving_memory: { icon: '💾', label: 'Saving Memory', color: '#bd93f9' },
};

const AIAgentNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode } = useAppStore();
  const [_configValid, setConfigValid] = useState(true);
  const [_configErrors, setConfigErrors] = useState<string[]>([]);

  // Get real-time node status from WebSocket
  const nodeStatus = useNodeStatus(id);
  const isExecuting = nodeStatus?.status === 'executing';
  const currentPhase = nodeStatus?.data?.phase as string | undefined;
  const phaseConfig = currentPhase ? PHASE_CONFIG[currentPhase] : null;

  // Validate AI Agent configuration whenever data changes
  useEffect(() => {
    try {
      const validation = AIAgentExecutionService.validateConfiguration(data || {});
      setConfigValid(validation.valid);
      setConfigErrors(validation.errors);

      if (!validation.valid) {
        console.warn(`AI Agent ${id} configuration issues:`, validation.errors);
      }
    } catch (error) {
      console.error('Configuration validation error:', error);
      setConfigValid(false);
      setConfigErrors(['Configuration validation failed']);
    }
  }, [data, id]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  // Determine border and glow based on execution state
  const getBorderColor = () => {
    if (isExecuting) {
      if (theme.isDarkMode && phaseConfig) return phaseConfig.color;
      // Light mode - use consistent blue
      return '#2563eb';
    }
    if (selected) return theme.colors.focus;
    return theme.colors.border;
  };

  const getBoxShadow = () => {
    if (isExecuting) {
      if (theme.isDarkMode && phaseConfig) {
        return `0 0 20px ${phaseConfig.color}80, 0 0 40px ${phaseConfig.color}40`;
      }
      // Light mode - use consistent blue
      return `0 0 0 3px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(37, 99, 235, 0.35)`;
    }
    if (selected) {
      return `0 4px 12px ${theme.colors.focusRing}, 0 0 0 1px ${theme.colors.focusRing}`;
    }
    return `0 2px 4px ${theme.colors.shadow}`;
  };

  return (
    <div
      style={{
        position: 'relative',
        padding: theme.spacing.lg,
        minWidth: '180px',
        minHeight: '120px',
        borderRadius: theme.borderRadius.lg,
        background: theme.colors.background,
        border: `2px solid ${getBorderColor()}`,
        color: theme.colors.text,
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: getBoxShadow(),
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none'
      }}
    >

      {/* Input Handle */}
      <Handle
        id="input-main"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{
          position: 'absolute',
          left: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: theme.nodeSize.handle,
          height: theme.nodeSize.handle,
          backgroundColor: theme.colors.background,
          border: `2px solid ${theme.colors.textSecondary}`,
          borderRadius: '50%'
        }}
        title="Main Input"
      />

      {/* Parameters Button */}
      <button
        onClick={handleParametersClick}
        style={{
          position: 'absolute',
          top: theme.spacing.xs,
          right: theme.spacing.xs,
          width: theme.nodeSize.paramButton,
          height: theme.nodeSize.paramButton,
          borderRadius: theme.borderRadius.sm,
          backgroundColor: theme.colors.backgroundAlt,
          border: `1px solid ${theme.colors.border}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
          fontWeight: theme.fontWeight.normal,
          transition: theme.transitions.fast,
          zIndex: 20
        }}
        title="Edit Parameters"
      >
        ⚙️
      </button>

      {/* Status Indicator - Top Left */}
      <div
        style={{
          position: 'absolute',
          top: theme.spacing.xs,
          left: theme.spacing.xs,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isExecuting
            ? (theme.isDarkMode ? (phaseConfig?.color || theme.dracula.cyan) : theme.dracula.cyan)
            : (nodeStatus?.status === 'success' ? theme.dracula.green
              : nodeStatus?.status === 'error' ? theme.dracula.red
              : theme.colors.textSecondary),
          boxShadow: isExecuting
            ? (theme.isDarkMode
              ? `0 0 8px ${phaseConfig?.color || theme.dracula.cyan}`
              : '0 0 4px rgba(37, 99, 235, 0.5)')
            : 'none',
          animation: isExecuting ? 'pulse 1s ease-in-out infinite' : 'none',
          zIndex: 20
        }}
        title={isExecuting ? (phaseConfig?.label || 'Executing') : (nodeStatus?.status || 'Idle')}
      />

      {/* Robot Icon */}
      <div style={{
        fontSize: theme.iconSize.xl,
        lineHeight: '1',
        marginBottom: theme.spacing.xs
      }}>
        🤖
      </div>

      {/* AI Agent Text */}
      <div style={{
        fontSize: theme.fontSize.base,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.text,
        lineHeight: '1.2',
        marginBottom: theme.spacing.xs
      }}>
        AI Agent
      </div>

      {/* Subtitle - shows execution phase or default */}
      <div style={{
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.normal,
        color: isExecuting && phaseConfig ? phaseConfig.color : theme.colors.focus,
        lineHeight: '1.2',
        marginBottom: theme.spacing.lg,
        transition: 'color 0.3s ease'
      }}>
        {isExecuting && phaseConfig ? phaseConfig.label : 'LangGraph Agent'}
      </div>

      {/* Memory Info Badge - shows when loading/using memory */}
      {isExecuting && nodeStatus?.data?.has_memory && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: theme.dracula.purple,
          color: '#fff',
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '10px',
          whiteSpace: 'nowrap',
          boxShadow: `0 0 8px ${theme.dracula.purple}80`,
          animation: 'pulse 1s ease-in-out infinite',
          zIndex: 30
        }}>
          {nodeStatus?.data?.history_count !== undefined
            ? `Memory: ${nodeStatus.data.history_count} msgs`
            : 'Using Memory'}
        </div>
      )}

      {/* Parameter Labels */}
      <div style={{
        position: 'absolute',
        bottom: theme.spacing.lg,
        left: '0',
        right: '0',
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: theme.fontSize.xs,
        color: theme.colors.textSecondary,
        fontWeight: theme.fontWeight.normal
      }}>
        <span>Memory</span>
        <span>Tool</span>
      </div>

      {/* Parameter Handles */}
      <Handle
        id="input-memory"
        type="target"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{
          position: 'absolute',
          bottom: '-6px',
          left: '35%',
          width: theme.nodeSize.handle,
          height: theme.nodeSize.handle,
          backgroundColor: isExecuting && nodeStatus?.data?.has_memory
            ? theme.dracula.purple
            : theme.colors.background,
          border: `2px solid ${isExecuting && nodeStatus?.data?.has_memory
            ? theme.dracula.purple
            : theme.colors.textSecondary}`,
          borderRadius: '0',
          transform: 'translateX(-50%) rotate(45deg)',
          boxShadow: isExecuting && nodeStatus?.data?.has_memory
            ? `0 0 10px ${theme.dracula.purple}`
            : 'none',
          transition: 'all 0.3s ease'
        }}
        title="Memory"
      />

      <Handle
        id="input-tools"
        type="target"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{
          position: 'absolute',
          bottom: '-6px',
          left: '65%',
          width: theme.nodeSize.handle,
          height: theme.nodeSize.handle,
          backgroundColor: theme.colors.background,
          border: `2px solid ${theme.colors.textSecondary}`,
          borderRadius: '0',
          transform: 'translateX(-50%) rotate(45deg)'
        }}
        title="Tools"
      />

      {/* Output Handles */}
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
          backgroundColor: theme.colors.background,
          border: `2px solid ${theme.colors.textSecondary}`,
          borderRadius: '50%'
        }}
        title="Main Output"
      />

    </div>
  );
};

export default AIAgentNode;
