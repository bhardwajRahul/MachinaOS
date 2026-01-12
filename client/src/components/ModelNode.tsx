import React, { useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useWebSocket, useNodeStatus } from '../contexts/WebSocketContext';
import { useAppTheme } from '../hooks/useAppTheme';

// Map credential names to provider keys
const CREDENTIAL_TO_PROVIDER: Record<string, string> = {
  'openaiApi': 'openai',
  'anthropicApi': 'anthropic',
  'googleAiApi': 'gemini',
  'azureOpenaiApi': 'azure_openai',
  'cohereApi': 'cohere',
  'ollamaApi': 'ollama',
  'mistralApi': 'mistral'
};

const ModelNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode } = useAppStore();
  const { apiKeyStatuses } = useWebSocket();

  // Get execution status from WebSocket
  const nodeStatus = useNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';
  const isExecuting = executionStatus === 'executing' || executionStatus === 'waiting';

  const definition = nodeDefinitions[type as keyof typeof nodeDefinitions];

  // Check if this is a tool node
  const isToolNode = type ? ['calculatorTool', 'currentTimeTool', 'webSearchTool'].includes(type) : false;

  // Determine provider from node definition or type
  const provider = useMemo(() => {
    const credentials = definition?.credentials?.[0];
    if (credentials?.name && CREDENTIAL_TO_PROVIDER[credentials.name]) {
      return CREDENTIAL_TO_PROVIDER[credentials.name];
    }

    // Fallback: extract provider from node type
    if (type?.includes('openai')) return 'openai';
    if (type?.includes('claude')) return 'anthropic';
    if (type?.includes('gemini')) return 'gemini';
    if (type?.includes('azure')) return 'azure_openai';
    if (type?.includes('cohere')) return 'cohere';
    if (type?.includes('ollama')) return 'ollama';
    if (type?.includes('mistral')) return 'mistral';

    return '';
  }, [type, definition?.credentials]);

  // Reactive API key status from WebSocket context
  const hasApiKey = useMemo(() => {
    if (!provider) return false;
    const status = apiKeyStatuses[provider];
    return status?.hasKey || false;
  }, [provider, apiKeyStatuses]);

  // Memory nodes are always "configured" (they don't need API keys)
  const isMemoryNode = type === 'simpleMemory';

  // Get the output handle ID based on node type
  // Memory nodes use 'output-memory' to match their node definition output name
  // Other nodes use 'output-model' for AI model configuration output
  const outputHandleId = isMemoryNode ? 'output-memory' : 'output-model';

  // Check if model is configured
  const isConfigured = useMemo(() => {
    // Memory nodes are always ready
    if (isMemoryNode) return true;
    const hasModel = data?.model && data.model.trim() !== '';
    return hasModel && hasApiKey;
  }, [data?.model, hasApiKey, isMemoryNode]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  const nodeColor = definition?.defaults?.color || '#6b7280';

  // Get provider icon/text for circular display
  const getProviderDisplay = () => {
    // Use the icon from the node definition if available
    if (definition?.icon) {
      return definition.icon;
    }

    // Fallback logic based on node type
    if (type?.includes('openai')) return '🤖';
    if (type?.includes('claude')) return '🧠';
    if (type?.includes('gemini')) return '⭐';
    if (type?.includes('azure')) return '☁️';
    if (type?.includes('cohere')) return '🌊';
    if (type?.includes('ollama')) return '🦙';
    if (type?.includes('mistral')) return '🌪️';

    return 'AI';
  };

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
          background: theme.isDarkMode
            ? `linear-gradient(135deg, ${nodeColor}20 0%, ${theme.colors.backgroundAlt} 100%)`
            : `linear-gradient(145deg, #ffffff 0%, ${nodeColor}10 100%)`,
          border: `2px solid ${isExecuting
            ? (theme.isDarkMode ? theme.dracula.cyan : '#2563eb')
            : selected
              ? theme.colors.focus
              : isConfigured
                ? (theme.isDarkMode ? `${nodeColor}60` : `${nodeColor}50`)
                : theme.dracula.red}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.text,
          fontSize: type === 'aiAgent' ? theme.fontSize.lg : theme.iconSize.xl,
          fontWeight: theme.fontWeight.semibold,
          transition: theme.transitions.fast,
          boxShadow: isExecuting
            ? theme.isDarkMode
              ? `0 4px 12px ${theme.dracula.cyan}66, 0 0 0 3px ${theme.dracula.cyan}4D`
              : `0 0 0 3px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(37, 99, 235, 0.35)`
            : selected
              ? `0 4px 12px ${theme.colors.focusRing}, 0 0 0 2px ${theme.colors.focusRing}`
              : isConfigured
                ? (theme.isDarkMode
                    ? `0 2px 8px ${nodeColor}30`
                    : `0 2px 8px ${nodeColor}25, 0 4px 12px rgba(0,0,0,0.06)`)
                : `0 2px 8px ${theme.dracula.red}4D`,
          animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      >

        {/* AI Text */}
        {getProviderDisplay()}

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
            backgroundColor: theme.isDarkMode ? theme.colors.backgroundAlt : '#ffffff',
            border: `1px solid ${theme.isDarkMode ? theme.colors.border : `${nodeColor}40`}`,
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
              : `0 1px 4px ${nodeColor}20`
          }}
          title="Edit Model Parameters"
        >
          ⚙️
        </button>

        {/* Configuration Status Indicator */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            width: theme.nodeSize.statusIndicator,
            height: theme.nodeSize.statusIndicator,
            borderRadius: '50%',
            backgroundColor: isExecuting
              ? theme.dracula.cyan
              : executionStatus === 'success'
                ? theme.dracula.green
                : executionStatus === 'error'
                  ? theme.dracula.red
                  : isConfigured
                    ? theme.dracula.green
                    : hasApiKey
                      ? theme.dracula.orange
                      : theme.dracula.red,
            border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
            boxShadow: isExecuting
              ? theme.isDarkMode
                ? `0 0 6px ${theme.dracula.cyan}80`
                : '0 0 4px rgba(37, 99, 235, 0.5)'
              : theme.isDarkMode
                ? `0 1px 3px ${theme.colors.shadow}`
                : '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 30,
            animation: isExecuting ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
          title={
            isExecuting
              ? 'Executing...'
              : isMemoryNode
                ? 'Memory node ready'
                : isToolNode
                  ? 'Tool ready'
                  : isConfigured
                    ? 'Model configured and ready'
                    : hasApiKey
                      ? 'API key found, model needs configuration'
                      : 'API key required'
          }
        />

        {/* Diamond Output Handle */}
        <Handle
          id={outputHandleId}
          type="source"
          position={Position.Top}
          isConnectable={isConnectable && isConfigured}
          style={{
            position: 'absolute',
            top: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: theme.nodeSize.statusIndicator,
            height: theme.nodeSize.statusIndicator,
            backgroundColor: isConfigured ? theme.dracula.cyan : theme.colors.textMuted,
            border: `2px solid ${theme.isDarkMode ? theme.colors.backgroundAlt : '#ffffff'}`,
            borderRadius: '0',
            opacity: isConfigured ? 1 : 0.6,
            zIndex: 20,
            boxShadow: theme.isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.1)'
          }}
          title={isMemoryNode ? 'Memory Output' : isConfigured ? 'Model Configuration Output' : 'Configure model to enable connection'}
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
        {data?.label || definition?.displayName}
      </div>

    </div>
  );
};

export default ModelNode;