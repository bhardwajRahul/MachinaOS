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
  building_tools: { icon: '🔧', label: 'Building Tools', color: '#ffb86c' },
  building_graph: { icon: '🔗', label: 'Building Graph', color: '#ffb86c' },
  invoking_llm: { icon: '🧠', label: 'Thinking...', color: '#ff79c6' },
  executing_tool: { icon: '⚡', label: 'Using Tool', color: '#ff79c6' },
  tool_completed: { icon: '✓', label: 'Tool Done', color: '#50fa7b' },
  saving_memory: { icon: '💾', label: 'Saving Memory', color: '#bd93f9' },
};

// Configuration for different agent types
interface AgentConfig {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  bottomHandles: Array<{ id: string; label: string; position: string }>;
}

// Lucide-style SVG icons
const RobotIcon = ({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
    <circle cx="8" cy="16" r="1" fill={color} />
    <circle cx="16" cy="16" r="1" fill={color} />
  </svg>
);

// Lucide MessageSquare icon - clean chat bubble
const ChatAgentIcon = ({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  aiAgent: {
    icon: <RobotIcon />,
    title: 'AI Agent',
    subtitle: 'LangGraph Agent',
    accentColor: '#9333EA',
    bottomHandles: [
      { id: 'input-memory', label: 'Memory', position: '35%' },
      { id: 'input-tools', label: 'Tool', position: '65%' },
    ],
  },
  chatAgent: {
    icon: <ChatAgentIcon />,
    title: 'Chat Agent',
    subtitle: 'Conversational Agent',
    accentColor: '#3B82F6',
    bottomHandles: [
      { id: 'input-memory', label: 'Memory', position: '35%' },
      { id: 'input-skill', label: 'Skill', position: '65%' },
    ],
  },
};

const AIAgentNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode } = useAppStore();
  const [_configValid, setConfigValid] = useState(true);
  const [_configErrors, setConfigErrors] = useState<string[]>([]);

  // Get config based on node type
  const config = AGENT_CONFIGS[type || 'aiAgent'] || AGENT_CONFIGS.aiAgent;

  // Get real-time node status from WebSocket
  const nodeStatus = useNodeStatus(id);
  const isExecuting = nodeStatus?.status === 'executing';
  const currentPhase = nodeStatus?.data?.phase as string | undefined;
  const phaseConfig = currentPhase ? PHASE_CONFIG[currentPhase] : null;

  // Validate configuration whenever data changes
  useEffect(() => {
    try {
      const validation = AIAgentExecutionService.validateConfiguration(data || {});
      setConfigValid(validation.valid);
      setConfigErrors(validation.errors);

      if (!validation.valid) {
        console.warn(`${config.title} ${id} configuration issues:`, validation.errors);
      }
    } catch (error) {
      console.error('Configuration validation error:', error);
      setConfigValid(false);
      setConfigErrors(['Configuration validation failed']);
    }
  }, [data, id, config.title]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  const getBorderColor = () => {
    if (isExecuting) {
      if (theme.isDarkMode && phaseConfig) return phaseConfig.color;
      return config.accentColor;
    }
    if (selected) return theme.colors.focus;
    return theme.colors.border;
  };

  const getBoxShadow = () => {
    if (isExecuting) {
      if (theme.isDarkMode && phaseConfig) {
        return `0 0 20px ${phaseConfig.color}80, 0 0 40px ${phaseConfig.color}40`;
      }
      return `0 0 0 3px ${config.accentColor}80, 0 4px 16px ${config.accentColor}60`;
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

      {/* Status Indicator */}
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
              : `0 0 4px ${config.accentColor}80`)
            : 'none',
          animation: isExecuting ? 'pulse 1s ease-in-out infinite' : 'none',
          zIndex: 20
        }}
        title={isExecuting ? (phaseConfig?.label || 'Executing') : (nodeStatus?.status || 'Idle')}
      />

      {/* Icon */}
      <div style={{ lineHeight: '1', marginBottom: theme.spacing.xs, color: config.accentColor }}>
        {config.icon}
      </div>

      {/* Title */}
      <div style={{
        fontSize: theme.fontSize.base,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.text,
        lineHeight: '1.2',
        marginBottom: theme.spacing.xs
      }}>
        {config.title}
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.normal,
        color: isExecuting && phaseConfig ? phaseConfig.color : theme.colors.focus,
        lineHeight: '1.2',
        marginBottom: theme.spacing.lg,
        transition: 'color 0.3s ease'
      }}>
        {isExecuting && phaseConfig ? phaseConfig.label : config.subtitle}
      </div>

      {/* Bottom Handle Labels */}
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
        {config.bottomHandles.map(h => <span key={h.id}>{h.label}</span>)}
      </div>

      {/* Bottom Handles */}
      {config.bottomHandles.map(h => (
        <Handle
          key={h.id}
          id={h.id}
          type="target"
          position={Position.Bottom}
          isConnectable={isConnectable}
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: h.position,
            width: theme.nodeSize.handle,
            height: theme.nodeSize.handle,
            backgroundColor: theme.colors.background,
            border: `2px solid ${theme.colors.textSecondary}`,
            borderRadius: '0',
            transform: 'translateX(-50%) rotate(45deg)'
          }}
          title={h.label}
        />
      ))}

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
