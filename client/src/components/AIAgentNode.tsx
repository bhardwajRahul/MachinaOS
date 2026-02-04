import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import AIAgentExecutionService from '../services/execution/aiAgentExecutionService';
import { useAppTheme } from '../hooks/useAppTheme';
import { useNodeStatus } from '../contexts/WebSocketContext';
import { dracula } from '../styles/theme';

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

// Theme color keys for accent colors
type ThemeColorKey = 'purple' | 'cyan' | 'green' | 'pink' | 'orange' | 'yellow' | 'red';

// Configuration for different agent types
interface AgentConfig {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  themeColorKey: ThemeColorKey;  // Use theme color key instead of hardcoded color
  bottomHandles: Array<{ id: string; label: string; position: string }>;
  leftHandles?: Array<{ id: string; label: string; position: string }>;  // For input handles on left side (below main input)
  rightHandles?: Array<{ id: string; label: string; position: string }>;  // For nodes with multiple outputs
  topOutputHandle?: { id: string; label: string };  // For nodes with top output (like Android Toolkit)
  skipInputHandle?: boolean;  // For passive nodes like tool nodes that don't have left input
  skipRightOutput?: boolean;  // Skip right output handle (use top output instead)
  wider?: boolean;  // Make node wider (e.g., for Android Control) - 220px
  width?: number;  // Custom width in pixels (overrides wider)
  height?: number;  // Custom height in pixels (default 120px)
}

// Social Receive icon as React component (SVG funnel/filter)
const SocialReceiveIcon = ({ size = 32, color = '#6366F1' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.73-4.8 5.75-7.39C20.26 4.95 19.79 4 18.95 4H5.04c-.83 0-1.31.95-.79 1.61z"/>
  </svg>
);

// Social Send icon as React component (paper plane with globe)
const SocialSendIcon = ({ size = 32, color = '#6366F1' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    <circle cx="18" cy="18" r="4" fill={color} stroke="#fff" strokeWidth="1"/>
  </svg>
);

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  aiAgent: {
    icon: <span style={{ fontSize: '28px' }}>🤖</span>,
    title: 'AI Agent',
    subtitle: 'LangGraph Agent',
    themeColorKey: 'purple',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  chatAgent: {
    icon: <span style={{ fontSize: '28px' }}>🧞</span>,
    title: 'Zeenie',
    subtitle: 'Your Personal Assistant',
    themeColorKey: 'cyan',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    width: 260,
    height: 160,
  },
  socialReceive: {
    icon: <SocialReceiveIcon />,
    title: 'Social Receive',
    subtitle: 'Normalize Message',
    themeColorKey: 'purple',
    bottomHandles: [],
    rightHandles: [
      { id: 'output-message', label: 'Message', position: '20%' },
      { id: 'output-media', label: 'Media', position: '40%' },
      { id: 'output-contact', label: 'Contact', position: '60%' },
      { id: 'output-metadata', label: 'Metadata', position: '80%' },
    ],
    width: 260,
    height: 160,
  },
  socialSend: {
    icon: <SocialSendIcon />,
    title: 'Social Send',
    subtitle: 'Send Message',
    themeColorKey: 'purple',
    bottomHandles: [],
    skipInputHandle: true,  // No main input - use specific handles instead
    leftHandles: [
      { id: 'input-message', label: 'Message', position: '15%' },
      { id: 'input-media', label: 'Media', position: '35%' },
      { id: 'input-contact', label: 'Contact', position: '55%' },
      { id: 'input-metadata', label: 'Metadata', position: '75%' },
    ],
    width: 260,
    height: 160,
  },
  android_agent: {
    icon: <span style={{ fontSize: '28px' }}>📱</span>,
    title: 'Android Control Agent',
    subtitle: 'Device Control',
    themeColorKey: 'green',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  coding_agent: {
    icon: <span style={{ fontSize: '28px' }}>💻</span>,
    title: 'Coding Agent',
    subtitle: 'Code Execution',
    themeColorKey: 'cyan',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  web_agent: {
    icon: <span style={{ fontSize: '28px' }}>🌐</span>,
    title: 'Web Control Agent',
    subtitle: 'Browser Automation',
    themeColorKey: 'pink',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  task_agent: {
    icon: <span style={{ fontSize: '28px' }}>📋</span>,
    title: 'Task Management Agent',
    subtitle: 'Task Automation',
    themeColorKey: 'purple',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  social_agent: {
    icon: <span style={{ fontSize: '28px' }}>📱</span>,
    title: 'Social Media Agent',
    subtitle: 'Social Messaging',
    themeColorKey: 'green',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  travel_agent: {
    icon: <span style={{ fontSize: '28px' }}>✈️</span>,
    title: 'Travel Agent',
    subtitle: 'Travel Planning',
    themeColorKey: 'orange',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  tool_agent: {
    icon: <span style={{ fontSize: '28px' }}>🔧</span>,
    title: 'Tool Agent',
    subtitle: 'Tool Orchestration',
    themeColorKey: 'yellow',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  productivity_agent: {
    icon: <span style={{ fontSize: '28px' }}>⏰</span>,
    title: 'Productivity Agent',
    subtitle: 'Productivity',
    themeColorKey: 'cyan',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  payments_agent: {
    icon: <span style={{ fontSize: '28px' }}>💳</span>,
    title: 'Payments Agent',
    subtitle: 'Payment Processing',
    themeColorKey: 'green',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
  consumer_agent: {
    icon: <span style={{ fontSize: '28px' }}>🛒</span>,
    title: 'Consumer Agent',
    subtitle: 'Consumer Support',
    themeColorKey: 'purple',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '70%' },
    ],
    topOutputHandle: { id: 'output-top', label: 'Output' },
    width: 260,
    height: 160,
  },
};

const AIAgentNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode } = useAppStore();
  const [_configValid, setConfigValid] = useState(true);
  const [_configErrors, setConfigErrors] = useState<string[]>([]);

  // Get config based on node type
  const config = AGENT_CONFIGS[type || 'aiAgent'] || AGENT_CONFIGS.aiAgent;

  // Resolve accent color from theme based on config key
  const accentColor = useMemo(() => {
    // Use dracula colors for vibrant accents (works well in both light and dark modes)
    return dracula[config.themeColorKey] || dracula.purple;
  }, [config.themeColorKey]);

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
      return accentColor;
    }
    if (selected) return theme.colors.focus;
    return theme.colors.border;
  };

  const getBoxShadow = () => {
    if (isExecuting) {
      if (theme.isDarkMode && phaseConfig) {
        return `0 0 20px ${phaseConfig.color}80, 0 0 40px ${phaseConfig.color}40`;
      }
      return `0 0 0 3px ${accentColor}80, 0 4px 16px ${accentColor}60`;
    }
    if (selected) {
      return `0 4px 12px ${theme.colors.focusRing}, 0 0 0 1px ${theme.colors.focusRing}`;
    }
    return `0 2px 4px ${theme.colors.shadow}`;
  };

  const hasRightHandles = config.rightHandles && config.rightHandles.length > 0;

  return (
    <div
      style={{
        position: 'relative',
        padding: theme.spacing.lg,
        paddingRight: hasRightHandles ? '60px' : theme.spacing.lg,  // Extra space for right labels
        paddingLeft: theme.spacing.lg,  // Standard padding (labels positioned absolutely)
        minWidth: config.width ? `${config.width}px` : config.wider ? '220px' : hasRightHandles ? '200px' : '180px',
        minHeight: config.height ? `${config.height}px` : '120px',
        borderRadius: theme.borderRadius.lg,
        background: theme.isDarkMode
          ? `linear-gradient(135deg, ${accentColor}20 0%, ${theme.colors.backgroundAlt} 100%)`
          : `linear-gradient(145deg, #ffffff 0%, ${accentColor}08 100%)`,
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
      {/* Input Handle - skip for passive tool nodes */}
      {!config.skipInputHandle && (
        <>
          {/* Input label */}
          <div style={{
            position: 'absolute',
            left: '10px',
            top: '30%',
            transform: 'translateY(-50%)',
            fontSize: theme.fontSize.sm,
            color: theme.colors.text,
            fontWeight: theme.fontWeight.medium,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}>
            Input
          </div>
          <Handle
            id="input-main"
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            style={{
              position: 'absolute',
              left: '-6px',
              top: '30%',
              transform: 'translateY(-50%)',
              width: theme.nodeSize.handle,
              height: theme.nodeSize.handle,
              backgroundColor: theme.colors.background,
              border: `2px solid ${theme.colors.textSecondary}`,
              borderRadius: '50%'
            }}
            title="Input"
          />
        </>
      )}

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


      {/* Icon */}
      <div style={{ lineHeight: '1', marginBottom: theme.spacing.xs, color: accentColor }}>
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

      {/* Left Input Handles (below main input) */}
      {config.leftHandles && config.leftHandles.map(h => (
        <React.Fragment key={h.id}>
          {/* Handle label positioned inside the node, to the right of the handle */}
          <div style={{
            position: 'absolute',
            left: '12px',  // Inside the node border, to the right of the handle
            top: h.position,
            transform: 'translateY(-50%)',
            fontSize: theme.fontSize.sm,
            color: theme.colors.text,
            fontWeight: theme.fontWeight.medium,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}>
            {h.label}
          </div>
          <Handle
            id={h.id}
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            style={{
              position: 'absolute',
              left: '-6px',
              top: h.position,
              width: theme.nodeSize.handle,
              height: theme.nodeSize.handle,
              backgroundColor: theme.colors.background,
              border: `2px solid ${theme.colors.textSecondary}`,
              borderRadius: '0',
              transform: 'translateY(-50%) rotate(45deg)'
            }}
            title={h.label}
          />
        </React.Fragment>
      ))}

      {/* Bottom Handle Labels */}
      <div style={{
        position: 'absolute',
        bottom: theme.spacing.lg,
        left: '0',
        right: '0',
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: theme.fontSize.sm,
        color: theme.colors.text,
        fontWeight: theme.fontWeight.medium
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

      {/* Top Output Handle - for nodes like Android Toolkit that connect upward to AI Agent */}
      {config.topOutputHandle && (
        <Handle
          id={config.topOutputHandle.id}
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
            backgroundColor: accentColor,
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            borderRadius: '50%',
            zIndex: 20
          }}
          title={config.topOutputHandle.label}
        />
      )}

      {/* Output Handle(s) - Multiple if rightHandles defined, single otherwise (skip if using top output) */}
      {!config.skipRightOutput && config.rightHandles && config.rightHandles.length > 0 ? (
        <>
          {/* Multiple Output Handles with inline labels */}
          {config.rightHandles.map(h => (
            <React.Fragment key={h.id}>
              {/* Handle label positioned next to handle */}
              <div style={{
                position: 'absolute',
                right: '10px',
                top: h.position,
                transform: 'translateY(-50%)',
                fontSize: theme.fontSize.sm,
                color: theme.colors.text,
                fontWeight: theme.fontWeight.medium,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                textAlign: 'right'
              }}>
                {h.label}
              </div>
              <Handle
                id={h.id}
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                style={{
                  position: 'absolute',
                  right: '-6px',
                  top: h.position,
                  transform: 'translateY(-50%)',
                  width: theme.nodeSize.handle,
                  height: theme.nodeSize.handle,
                  backgroundColor: theme.colors.background,
                  border: `2px solid ${theme.colors.textSecondary}`,
                  borderRadius: '50%'
                }}
                title={h.label}
              />
            </React.Fragment>
          ))}
        </>
      ) : !config.skipRightOutput ? (
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
      ) : null}
    </div>
  );
};

export default AIAgentNode;
