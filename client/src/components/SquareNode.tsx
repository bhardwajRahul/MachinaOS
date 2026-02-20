import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useAppTheme } from '../hooks/useAppTheme';
import { ANDROID_SERVICE_NODE_TYPES } from '../nodeDefinitions/androidServiceNodes';
import { useWebSocket, useWhatsAppStatus } from '../contexts/WebSocketContext';
import { useApiKeys } from '../hooks/useApiKeys';
import { getAIProviderIcon } from './icons/AIProviderIcons';
import { PlayCircleFilled, ScheduleOutlined } from '@ant-design/icons';
import { Google } from '@lobehub/icons';

// Android service nodes that can connect to Android Toolkit as tools
const ANDROID_TOOL_CAPABLE_NODES = ANDROID_SERVICE_NODE_TYPES;

// Nodes with 'tool' in their group can connect to AI Agent/Zeenie tool handles
const hasToolGroup = (definition: any): boolean => {
  const groups = definition?.group || [];
  return groups.includes('tool');
};

// Google Maps node types
const GOOGLE_MAPS_NODE_TYPES = ['gmaps_create', 'gmaps_locations', 'gmaps_nearby_places'];

// WhatsApp node types
const WHATSAPP_NODE_TYPES = ['whatsappSend', 'whatsappReceive', 'whatsappDb'];

// Nodes that should not have output handles (input-only nodes)
const NO_OUTPUT_NODE_TYPES = ['console'];

// AI Model node types with their provider IDs
const AI_MODEL_NODE_TYPES: Record<string, string> = {
  'openaiChatModel': 'openai',
  'anthropicChatModel': 'anthropic',
  'geminiChatModel': 'gemini',
  'openrouterChatModel': 'openrouter',
  'groqChatModel': 'groq',
  'cerebrasChatModel': 'cerebras',
};

const SquareNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode, renamingNodeId, setRenamingNodeId, updateNodeData } = useAppStore();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const isDisabled = data?.disabled === true;

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get Android status, node status, and API key status from WebSocket context
  const { androidStatus, getNodeStatus, getApiKeyStatus } = useWebSocket();
  const { getStoredApiKey, isConnected: wsConnected } = useApiKeys();
  const nodeStatus = getNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';

  // Minimum glow duration state - keeps glow visible for at least 500ms
  const [isGlowing, setIsGlowing] = useState(false);
  const glowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track when execution starts to ensure minimum glow duration
  useEffect(() => {
    if (executionStatus === 'executing' || executionStatus === 'waiting') {
      // Start glowing immediately
      setIsGlowing(true);
      // Clear any existing timeout that would stop the glow
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
        glowTimeoutRef.current = null;
      }
    } else if (isGlowing) {
      // Execution ended but we're still glowing - set timeout to stop after minimum duration
      if (!glowTimeoutRef.current) {
        glowTimeoutRef.current = setTimeout(() => {
          setIsGlowing(false);
          glowTimeoutRef.current = null;
        }, 500);
      }
    }

    return () => {
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
        glowTimeoutRef.current = null;
      }
    };
  }, [executionStatus, isGlowing]);

  // Check if this is a Google Maps node
  const isGoogleMapsNode = type ? GOOGLE_MAPS_NODE_TYPES.includes(type) : false;
  const googleMapsKeyStatus = isGoogleMapsNode ? getApiKeyStatus('google_maps') : undefined;

  // Check if this is an AI model node and get reactive API key status
  const isAIModelNode = type ? type in AI_MODEL_NODE_TYPES : false;
  const aiProviderId = type && AI_MODEL_NODE_TYPES[type] ? AI_MODEL_NODE_TYPES[type] : null;
  const aiKeyStatus = aiProviderId ? getApiKeyStatus(aiProviderId) : undefined;

  const definition = nodeDefinitions[type as keyof typeof nodeDefinitions];

  // Check if this is an Android node
  const isAndroidNode = type ? ANDROID_SERVICE_NODE_TYPES.includes(type) : false;

  // Check if this node can be used as a tool (connects to Android Toolkit or AI Agent/Zeenie tool handle)
  const isToolCapable = type ? (ANDROID_TOOL_CAPABLE_NODES.includes(type) || hasToolGroup(definition)) : false;

  // Android connection status from WebSocket (real-time updates)
  // Service nodes need a paired device to execute, not just relay connection
  const isAndroidConnected = isAndroidNode && androidStatus.paired;

  // Check if this is a WhatsApp node
  const isWhatsAppNode = type ? WHATSAPP_NODE_TYPES.includes(type) : false;

  // WhatsApp connection status from WebSocket (real-time updates)
  const whatsappStatus = useWhatsAppStatus();

  // Execution state - waiting is treated identically to executing
  // Also respect minimum glow duration for fast-executing tools
  const isExecuting = executionStatus === 'executing' || executionStatus === 'waiting' || isGlowing;


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

  // Check API key and configuration status
  useEffect(() => {
    // Only run when WebSocket is connected
    if (!wsConnected) return;

    const checkConfiguration = async () => {
      try {
        // Determine provider from node definition credentials
        let provider = '';
        const credentials = definition?.credentials?.[0];
        if (credentials?.name) {
          // Map credential names to provider keys
          const credentialToProvider: Record<string, string> = {
            'googleMapsApi': 'google_maps',
            'openaiApi': 'openai',
            'anthropicApi': 'anthropic',
            'googleAiApi': 'gemini'
          };
          provider = credentialToProvider[credentials.name] || '';
        }

        // Fallback: extract provider from node type if not found in credentials
        if (!provider) {
          if (type?.includes('map') || type?.includes('location')) provider = 'google_maps';
        }

        // Check if API key exists via WebSocket
        const apiKey = provider ? await getStoredApiKey(provider) : null;
        setHasApiKey(!!apiKey);

        // Check if service is configured (has required parameters)
        const hasRequiredParams = data && Object.keys(data).length > 0;
        setIsConfigured(hasRequiredParams && !!apiKey);

        if (!apiKey && provider) {
          console.warn(`[SquareNode] ${definition?.displayName} ${id}: No API key configured for ${provider}`);
        }
      } catch (error) {
        console.error('Configuration check error:', error);
        setHasApiKey(false);
        setIsConfigured(false);
      }
    };

    checkConfiguration();
  }, [data, id, type, definition?.displayName, definition?.credentials, isGoogleMapsNode, getStoredApiKey, wsConnected]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  // Get status indicator color based on execution state
  const getStatusIndicatorColor = () => {
    // For executing or waiting state, show blue/cyan
    if (executionStatus === 'executing' || executionStatus === 'waiting') {
      return theme.dracula.cyan;
    }
    if (executionStatus === 'success') {
      return theme.dracula.green;
    }
    if (executionStatus === 'error') {
      return theme.dracula.red;
    }

    // Idle state - use Android or configuration status
    if (isAndroidNode) {
      return isAndroidConnected ? theme.dracula.green : theme.dracula.red;
    }

    // WhatsApp nodes - use WebSocket connection status
    if (isWhatsAppNode) {
      if (whatsappStatus.connected) return theme.dracula.green;
      if (whatsappStatus.pairing) return theme.dracula.orange;
      return theme.dracula.red;
    }

    // Google Maps nodes - use WebSocket API key validation status
    if (isGoogleMapsNode && googleMapsKeyStatus) {
      return googleMapsKeyStatus.valid ? theme.dracula.green : theme.dracula.red;
    }

    // AI Model nodes - use reactive WebSocket API key status
    if (isAIModelNode) {
      if (aiKeyStatus?.valid && aiKeyStatus?.hasKey) return theme.dracula.green;
      if (aiKeyStatus?.hasKey) return theme.dracula.orange;
      return theme.dracula.red;
    }

    return isConfigured ? theme.dracula.green : hasApiKey ? theme.dracula.orange : theme.dracula.red;
  };

  const getStatusTitle = () => {
    switch (executionStatus) {
      case 'executing':
        return 'Executing...';
      case 'waiting':
        return nodeStatus?.message || 'Waiting for event...';
      case 'success':
        return 'Execution successful';
      case 'error':
        return `Error: ${nodeStatus?.data?.error || 'Unknown error'}`;
      default:
        if (isAndroidNode) {
          return isAndroidConnected ? 'Android device connected' : 'Android device not connected';
        }
        // WhatsApp nodes - use WebSocket connection status
        if (isWhatsAppNode) {
          if (whatsappStatus.connected) return 'WhatsApp connected';
          if (whatsappStatus.pairing) return 'Pairing in progress...';
          if (whatsappStatus.running) return 'WhatsApp service running';
          return 'WhatsApp not connected';
        }
        // Google Maps nodes - use WebSocket API key validation status
        if (isGoogleMapsNode && googleMapsKeyStatus) {
          return googleMapsKeyStatus.valid
            ? 'Google Maps API key validated'
            : `API key invalid: ${googleMapsKeyStatus.message || 'Validation failed'}`;
        }
        // AI Model nodes - use reactive WebSocket API key status
        if (isAIModelNode) {
          if (aiKeyStatus?.valid && aiKeyStatus?.hasKey) {
            return `${aiProviderId?.charAt(0).toUpperCase()}${aiProviderId?.slice(1)} API key validated`;
          }
          if (aiKeyStatus?.hasKey) {
            return 'API key found, validation pending';
          }
          return 'API key required - configure in Credentials';
        }
        return isConfigured
          ? 'Service configured and ready'
          : hasApiKey
            ? 'API key found, service needs configuration'
            : 'API key required';
    }
  };

  // Common icon name to emoji mapping for fallback
  const iconNameToEmoji: Record<string, string> = {
    brain: '🧠',
    memory: '🧠',
    robot: '🤖',
    ai: '🤖',
    agent: '🤖',
    chat: '💬',
    message: '💬',
    whatsapp: '📱',
    phone: '📱',
    email: '📧',
    mail: '📧',
    webhook: '🔗',
    http: '🌐',
    api: '🔌',
    database: '🗄️',
    file: '📄',
    folder: '📁',
    code: '💻',
    python: '🐍',
    javascript: '📜',
    settings: '⚙️',
    config: '⚙️',
    clock: '⏰',
    schedule: '📅',
    location: '📍',
    map: '🗺️',
    search: '🔍',
    filter: '🔍',
    play: '▶️',
    start: '▶️',
    stop: '⏹️',
    pause: '⏸️',
    send: '📤',
    receive: '📥',
    upload: '⬆️',
    download: '⬇️',
    sync: '🔄',
    refresh: '🔄',
    warning: '⚠️',
    error: '❌',
    success: '✅',
    info: '💡',
    help: '❓',
    user: '👤',
    users: '👥',
    key: '🔑',
    lock: '🔒',
    unlock: '🔓',
    star: '⭐',
    heart: '❤️',
    thunder: '⚡',
    lightning: '⚡',
    fire: '🔥',
    water: '💧',
    cloud: '☁️',
    sun: '☀️',
    moon: '🌙',
    camera: '📷',
    image: '🖼️',
    video: '🎬',
    audio: '🔊',
    music: '🎵',
    bell: '🔔',
    notification: '🔔',
    link: '🔗',
    chain: '🔗',
    tool: '🔧',
    wrench: '🔧',
    hammer: '🔨',
    gear: '⚙️',
    cog: '⚙️',
    bug: '🐛',
    debug: '🐛',
    test: '🧪',
    experiment: '🧪',
    lab: '🧪',
    book: '📖',
    docs: '📚',
    note: '📝',
    edit: '✏️',
    pencil: '✏️',
    trash: '🗑️',
    delete: '🗑️',
    copy: '📋',
    paste: '📋',
    cut: '✂️',
    scissors: '✂️',
    tag: '🏷️',
    label: '🏷️',
    flag: '🚩',
    bookmark: '🔖',
    pin: '📌',
    target: '🎯',
    goal: '🎯',
    trophy: '🏆',
    medal: '🏅',
    gift: '🎁',
    package: '📦',
    box: '📦',
    truck: '🚚',
    shipping: '🚚',
    cart: '🛒',
    shop: '🛍️',
    store: '🏪',
    money: '💰',
    dollar: '💵',
    credit: '💳',
    payment: '💳',
    chart: '📊',
    graph: '📈',
    analytics: '📊',
    stats: '📊',
    dashboard: '📊',
    terminal: '💻',
    console: '💻',
    server: '🖥️',
    computer: '💻',
    mobile: '📱',
    tablet: '📱',
    battery: '🔋',
    wifi: '📶',
    bluetooth: '📶',
    antenna: '📡',
    satellite: '🛰️',
    rocket: '🚀',
    plane: '✈️',
    car: '🚗',
    bike: '🚲',
    train: '🚂',
    ship: '🚢',
    home: '🏠',
    house: '🏠',
    building: '🏢',
    office: '🏢',
    factory: '🏭',
    hospital: '🏥',
    school: '🏫',
    university: '🎓',
    graduation: '🎓',
    world: '🌍',
    globe: '🌐',
    earth: '🌍',
    android: '🤖',
    apple: '🍎',
    windows: '🪟',
    linux: '🐧',
  };

  // Check if string is likely an emoji (contains emoji characters)
  const isEmoji = (str: string): boolean => {
    // Emoji regex pattern - matches most common emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{231A}-\u{231B}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{E000}-\u{F8FF}]/u;
    return emojiRegex.test(str);
  };

  // Helper to render icon (handles URLs, emojis, component markers, and icon names)
  const renderIcon = (icon: string) => {
    // Handle component markers (e.g., 'component:Gmail')
    if (icon.startsWith('component:')) {
      const componentName = icon.replace('component:', '');
      if (componentName === 'Gmail') {
        return <Google.Color size={28} />;
      }
      // Fallback for unknown component markers
      return '📦';
    }

    // Handle image URLs
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

    // Check if it's a known icon name and convert to emoji
    const lowerIcon = icon.toLowerCase().trim();
    if (iconNameToEmoji[lowerIcon]) {
      return iconNameToEmoji[lowerIcon];
    }

    // Fallback: return a generic icon instead of plain text
    console.warn(`[SquareNode] Unknown icon name "${icon}" - using fallback. Add emoji directly or update iconNameToEmoji mapping.`);
    return '📦';
  };

  // Get service icon for display
  const getServiceIcon = () => {
    // Priority 0: Start node - use PlayCircleFilled icon with cyan color (neutral "begin" color)
    if (type === 'start') {
      return <PlayCircleFilled style={{ fontSize: 28, color: theme.dracula.cyan }} />;
    }

    // Cron Scheduler node - use ScheduleOutlined with node definition color
    if (type === 'cronScheduler') {
      return <ScheduleOutlined style={{ fontSize: 28, color: definition?.defaults?.color || nodeColor }} />;
    }

    // Priority 1: Check if this is an AI model node - use official provider icons
    if (type && AI_MODEL_NODE_TYPES[type]) {
      const providerId = AI_MODEL_NODE_TYPES[type];
      const IconComponent = getAIProviderIcon(providerId);
      if (IconComponent) {
        return <IconComponent size={28} />;
      }
    }

    // Priority 2: Custom icon set on the node instance (via data.customIcon)
    if (data?.customIcon && typeof data.customIcon === 'string') {
      return renderIcon(data.customIcon);
    }

    // Priority 3: Use the icon from the node definition if available
    if (definition?.icon && typeof definition.icon === 'string') {
      return renderIcon(definition.icon);
    }

    // Fallback logic based on node type
    if (type?.includes('gmaps_create')) return '🗺️';
    if (type?.includes('gmaps_locations')) return '🌍';
    if (type?.includes('gmaps_nearby_places')) return '🔍';

    return '📍';
  };

  // Get the node color from definition or use default
  const nodeColor = definition?.defaults?.color || '#1A73E8';

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


        {/* Service Icon */}
        {getServiceIcon()}

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
          title="Edit Service Parameters"
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
          title={getStatusTitle()}
        />

        {/* Square Input Handle */}
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
            backgroundColor: theme.isDarkMode ? theme.colors.background : '#ffffff',
            border: `2px solid ${theme.isDarkMode ? theme.colors.textSecondary : '#6b7280'}`,
            borderRadius: '50%',
            zIndex: 20
          }}
          title="Service Input"
        />

        {/* Square Output Handle */}
        {!NO_OUTPUT_NODE_TYPES.includes(type || '') && (
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
            title="Service Output"
          />
        )}

        {/* Top Tool Output Handle - for nodes that can connect to AI Agent/Zeenie tool handle */}
        {isToolCapable && (
          <Handle
            id="output-tool"
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
              backgroundColor: ANDROID_TOOL_CAPABLE_NODES.includes(type || '') ? '#3DDC84' : nodeColor, // Android green for Android nodes, node color for others
              border: `2px solid ${theme.isDarkMode ? theme.colors.background : '#ffffff'}`,
              borderRadius: '50%',
              zIndex: 20
            }}
            title={ANDROID_TOOL_CAPABLE_NODES.includes(type || '') ? 'Connect to Android Toolkit' : 'Connect to AI Agent/Zeenie tool handle'}
          />
        )}

        {/* Output Data Indicator - shows when node has execution output */}
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

      {/* Service Name Below Square */}
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

export default SquareNode;