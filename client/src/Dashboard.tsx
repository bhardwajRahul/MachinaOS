import React, { useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  ConnectionLineType,
  SelectionMode,
  Node,
  Edge,
} from 'reactflow';
import GenericNode from './components/GenericNode';
import AIAgentNode from './components/AIAgentNode';
import ModelNode from './components/ModelNode';
import SquareNode from './components/SquareNode';
import TriggerNode from './components/TriggerNode';
import ToolkitNode from './components/ToolkitNode';
import ConditionalEdge from './components/ConditionalEdge';
import NodeContextMenu from './components/ui/NodeContextMenu';
import { nodeDefinitions } from './nodeDefinitions';
import { ANDROID_SERVICE_NODE_TYPES } from './nodeDefinitions/androidServiceNodes';
import { SCHEDULER_NODE_TYPES } from './nodeDefinitions/schedulerNodes';
import { CHAT_NODE_TYPES } from './nodeDefinitions/chatNodes';
import { CODE_NODE_TYPES } from './nodeDefinitions/codeNodes';
import { UTILITY_NODE_TYPES } from './nodeDefinitions/utilityNodes';
import { TOOL_NODE_TYPES } from './nodeDefinitions/toolNodes';
import { SKILL_NODE_TYPES } from './nodeDefinitions/skillNodes';
import { DOCUMENT_NODE_TYPES } from './nodeDefinitions/documentNodes';
import ParameterPanel from './ParameterPanel';
import LocationParameterPanel from './components/LocationParameterPanel';
import { useAppStore } from './store/useAppStore';
import ComponentPalette from './components/ui/ComponentPalette';
import TopToolbar from './components/ui/TopToolbar';
import WorkflowSidebar from './components/ui/WorkflowSidebar';
import SettingsPanel, { WorkflowSettings, defaultSettings } from './components/ui/SettingsPanel';
import AIResultModal from './components/ui/AIResultModal';
import CredentialsModal from './components/CredentialsModal';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ConsolePanel from './components/ui/ConsolePanel';
import { useAppTheme } from './hooks/useAppTheme';
import { useWorkflowManagement } from './hooks/useWorkflowManagement';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useComponentPalette } from './hooks/useComponentPalette';
import { useReactFlowNodes } from './hooks/useReactFlowNodes';
import { useCopyPaste } from './hooks/useCopyPaste';
import { useWebSocket } from './contexts/WebSocketContext';
import { useTheme } from './contexts/ThemeContext';
import {
  sanitizeNodesForComparison,
  sanitizeEdgesForComparison,
  generateWorkflowId
} from './utils/workflow';
import { importWorkflowFromFile } from './utils/workflowExport';

import 'reactflow/dist/style.css';

// Node types configuration - defined outside component to prevent recreation on re-renders
// This is required by React Flow to avoid performance issues
const createNodeTypes = (): Record<string, React.ComponentType<any>> => {
  const types: Record<string, React.ComponentType<any>> = {};

  // Trigger nodes (no input handles) - check by group or specific types
  const TRIGGER_NODE_TYPES = ['start', 'cronScheduler', 'webhookTrigger', 'whatsappReceive', 'chatTrigger'];

  Object.keys(nodeDefinitions).forEach(type => {
    const definition = nodeDefinitions[type];

    // Trigger nodes - no input connections (start workflows)
    if (TRIGGER_NODE_TYPES.includes(type)) {
      types[type] = TriggerNode;
    } else if (type === 'openaiChatModel' || type === 'anthropicChatModel' || type === 'geminiChatModel' || type === 'openrouterChatModel' || type === 'groqChatModel' || type === 'cerebrasChatModel') {
      // AI chat model nodes use square design
      types[type] = SquareNode;
    } else if (type === 'aiAgent' || type === 'chatAgent') {
      types[type] = AIAgentNode;
    } else if (type === 'simpleMemory') {
      // Simple Memory node for AI conversation history - uses circular ModelNode design
      types[type] = ModelNode;
    } else if (type === 'whatsappSend' || type === 'whatsappDb') {
      // WhatsApp action nodes use SquareNode (whatsappReceive is a trigger)
      types[type] = SquareNode;
    } else if (ANDROID_SERVICE_NODE_TYPES.includes(type)) {
      // Android service nodes use SquareNode component
      types[type] = SquareNode;
    } else if (SCHEDULER_NODE_TYPES.includes(type)) {
      // Timer uses SquareNode (has input), cronScheduler already handled as trigger above
      types[type] = SquareNode;
    } else if (CHAT_NODE_TYPES.includes(type)) {
      // Chat nodes use SquareNode component
      types[type] = SquareNode;
    } else if (CODE_NODE_TYPES.includes(type)) {
      // Code execution nodes use SquareNode component
      types[type] = SquareNode;
    } else if (UTILITY_NODE_TYPES.includes(type)) {
      // Utility nodes (HTTP, Webhooks) use SquareNode component
      // Note: webhookTrigger is already handled as trigger above
      types[type] = SquareNode;
    } else if (TOOL_NODE_TYPES.includes(type)) {
      // Most tool nodes use circular ModelNode
      // Exception: androidTool uses ToolkitNode with top/bottom handles
      if (type === 'androidTool') {
        types[type] = ToolkitNode;
      } else {
        types[type] = ModelNode;
      }
    } else if (SKILL_NODE_TYPES.includes(type)) {
      // Skill nodes use ToolkitNode (vertical handle layout like Android Toolkit)
      types[type] = ToolkitNode;
    } else if (DOCUMENT_NODE_TYPES.includes(type)) {
      // Document processing nodes use SquareNode component
      types[type] = SquareNode;
    } else if (definition?.group?.includes('model')) {
      // Fallback for other model nodes
      types[type] = ModelNode;
    } else if (definition?.group?.includes('service')) {
      // Any node with 'service' group uses SquareNode component
      types[type] = SquareNode;
    } else {
      types[type] = GenericNode;
    }
  });

  return types;
};

// Create node types once at module load time
const moduleNodeTypes = createNodeTypes();

// Edge types configuration - enables conditional edge rendering
const moduleEdgeTypes = {
  conditional: ConditionalEdge,
};

// Edge styles generator using theme colors - supports light and dark modes
const getEdgeStyles = (colors: {
  edgeDefault: string;
  edgeSelected: string;
  edgeExecuting: string;
  edgeCompleted: string;
  edgeError: string;
}, isDark: boolean) => `
  /* Base style for ALL edges */
  .react-flow__edge path {
    stroke: ${colors.edgeDefault} !important;
    stroke-width: 2px;
  }

  .react-flow__edge.selected path {
    stroke: ${colors.edgeSelected} !important;
    stroke-width: 4px !important;
  }

  /* Executing edge - subtle blue in light mode, cyan in dark mode */
  .react-flow__edge.executing path {
    stroke: ${isDark ? colors.edgeExecuting : '#2563eb'} !important;
    stroke-width: 3px !important;
    stroke-dasharray: 8 4;
    animation: dashFlow 0.5s linear infinite;
  }

  /* Completed edge - subtle green in both modes */
  .react-flow__edge.completed path {
    stroke: ${isDark ? colors.edgeCompleted : '#16a34a'} !important;
    stroke-width: 2px !important;
  }

  /* Error edge - keep red for visibility */
  .react-flow__edge.error path {
    stroke: ${colors.edgeError} !important;
    stroke-width: 3px !important;
  }

  /* Pending edge - animated dash in both modes */
  .react-flow__edge.pending path {
    stroke: ${isDark ? colors.edgeDefault : '#6b7280'} !important;
    stroke-width: 2px !important;
    stroke-dasharray: 8 4;
    animation: dashFlow 0.5s linear infinite;
  }

  /* Memory connection active */
  .react-flow__edge.memory-active path {
    stroke: ${isDark ? '#ff79c6' : '#db2777'} !important;
    stroke-width: 3px !important;
  }

  /* Tool connection active */
  .react-flow__edge.tool-active path {
    stroke: ${isDark ? '#ffb86c' : '#ea580c'} !important;
    stroke-width: 3px !important;
  }

  @keyframes dashFlow {
    0% { stroke-dashoffset: 24; }
    100% { stroke-dashoffset: 0; }
  }

  /* Executing node - visible glow in both modes */
  .react-flow__node.executing {
    filter: ${isDark
      ? `drop-shadow(0 0 8px ${colors.edgeExecuting}) drop-shadow(0 0 16px ${colors.edgeExecuting}80)`
      : 'drop-shadow(0 0 10px rgba(37, 99, 235, 0.8)) drop-shadow(0 0 20px rgba(37, 99, 235, 0.6))'};
    animation: ${isDark ? 'nodeGlowDark' : 'nodeGlowLight'} 1.2s ease-in-out infinite;
  }

  @keyframes nodeGlowDark {
    0%, 100% {
      filter: drop-shadow(0 0 8px ${colors.edgeExecuting}) drop-shadow(0 0 16px ${colors.edgeExecuting}80);
    }
    50% {
      filter: drop-shadow(0 0 14px ${colors.edgeExecuting}) drop-shadow(0 0 24px ${colors.edgeExecuting});
    }
  }

  @keyframes nodeGlowLight {
    0%, 100% {
      filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.8)) drop-shadow(0 0 20px rgba(37, 99, 235, 0.6));
    }
    50% {
      filter: drop-shadow(0 0 16px rgba(37, 99, 235, 1)) drop-shadow(0 0 30px rgba(37, 99, 235, 0.8));
    }
  }
`;

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Inner component that uses useReactFlow() - must be inside ReactFlowProvider
const DashboardContent: React.FC = () => {
  const theme = useAppTheme();
  const { isDarkMode } = useTheme();
  const {
    currentWorkflow,
    hasUnsavedChanges,
    savedWorkflows,
    sidebarVisible,
    componentPaletteVisible,
    updateWorkflow,
    loadSavedWorkflows,
    createNewWorkflow,
    saveWorkflow,
    deleteWorkflow,
    migrateCurrentWorkflow,
    toggleSidebar,
    toggleComponentPalette,
    proMode,
    toggleProMode,
    exportWorkflowToJSON,
    exportWorkflowToFile,
    setCurrentWorkflow,
    selectedNode,
    setSelectedNode,
    renamingNodeId,
    setRenamingNodeId,
    // Per-workflow UI state (n8n pattern)
    setWorkflowExecuting,
    setWorkflowExecutionOrder,
    setWorkflowViewport,
    clearWorkflowExecutionState,
  } = useAppStore();
  
  // ReactFlow state management (local state for performance)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // ReactFlow instance for viewport control (n8n pattern - per-workflow viewport)
  const reactFlowInstance = useReactFlow();

  // AI execution state - result and modal are local, execution tracking is per-workflow
  const [executionResult, setExecutionResult] = React.useState<any>(null);
  const [showResult, setShowResult] = React.useState(false);

  // Get per-workflow execution state (n8n pattern - isolated per workflow)
  // Subscribe to workflowUIStates directly so Zustand triggers re-renders when it changes
  const workflowUIStates = useAppStore(state => state.workflowUIStates);
  const workflowUIState = React.useMemo(() => {
    if (!currentWorkflow?.id) return null;
    return workflowUIStates[currentWorkflow.id] || { isExecuting: false, executedNodes: [], executionOrder: [], selectedNodeId: null };
  }, [workflowUIStates, currentWorkflow?.id]);
  const isExecuting = workflowUIState?.isExecuting || false;
  const executedNodes = React.useMemo(() => new Set(workflowUIState?.executedNodes || []), [workflowUIState?.executedNodes]);
  const executionOrder = workflowUIState?.executionOrder || [];
  // Custom hooks for different concerns
  const { 
    handleWorkflowNameChange,
    handleSave,
    handleNew,
    handleOpen,
    handleSelectWorkflow,
  } = useWorkflowManagement();

  const { collapsedSections, searchQuery, setSearchQuery, toggleSection } = useComponentPalette();
  const { saveNodeParameters, executeWorkflow, deployWorkflow, cancelDeployment, nodeStatuses, deploymentStatus, workflowLock } = useWebSocket();

  // Scope deployment and lock to current workflow (n8n pattern)
  // Only show as "running" or "locked" if it applies to the currently viewed workflow
  const isCurrentWorkflowDeployed = deploymentStatus.isRunning &&
    deploymentStatus.workflow_id === currentWorkflow?.id;
  const isCurrentWorkflowLocked = workflowLock.locked &&
    workflowLock.workflow_id === currentWorkflow?.id;
  const { onDragOver, onDrop, handleComponentDragStart } = useDragAndDrop({ nodes, setNodes, saveNodeParameters });
  const { onConnect, onNodesDelete, onEdgesDelete } = useReactFlowNodes({ setNodes, setEdges });
  const { copySelectedNodes, pasteNodes } = useCopyPaste({ nodes, edges, setNodes, setEdges, saveNodeParameters });

  // Toggle disabled state on selected nodes
  const toggleDisableSelected = React.useCallback(() => {
    setNodes(nds => nds.map(node => {
      if (node.selected) {
        return {
          ...node,
          data: {
            ...node.data,
            disabled: !node.data?.disabled,
          },
        };
      }
      return node;
    }));
  }, [setNodes]);

  // Note: executedNodes and executionOrder are now derived from per-workflow state above

  // Settings state with localStorage persistence
  const [settings, setSettings] = React.useState<WorkflowSettings>(() => {
    try {
      const saved = localStorage.getItem('workflow_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [credentialsOpen, setCredentialsOpen] = React.useState(false);
  const [consolePanelOpen, setConsolePanelOpen] = React.useState(false);

  // Context menu state for node right-click
  const [contextMenu, setContextMenu] = React.useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  // Persist settings to localStorage
  React.useEffect(() => {
    localStorage.setItem('workflow_settings', JSON.stringify(settings));
  }, [settings]);

  // Update nodes with execution status classes
  const styledNodes = React.useMemo(() => {
    return nodes.map(node => {
      const nodeStatus = nodeStatuses[node.id];
      let className = '';

      if (nodeStatus?.status === 'executing' || nodeStatus?.status === 'waiting') {
        className = 'executing';
      } else if (nodeStatus?.status === 'success') {
        className = 'completed';
      } else if (nodeStatus?.status === 'error') {
        className = 'error';
      } else if (isExecuting && executionOrder.includes(node.id) && !executedNodes.has(node.id)) {
        className = 'pending';
      }

      return {
        ...node,
        className
      };
    });
  }, [nodes, nodeStatuses, isExecuting, executionOrder, executedNodes]);

  // Update edges with execution status classes
  const styledEdges = React.useMemo(() => {
    return edges.map(edge => {
      const sourceStatus = nodeStatuses[edge.source];
      const targetStatus = nodeStatuses[edge.target];
      const targetNode = nodes.find(n => n.id === edge.target);

      let className = '';

      // Check if this edge connects to an AI Agent's memory or tools/skill handle
      const isMemoryConnection = edge.targetHandle === 'input-memory';
      const isToolConnection = edge.targetHandle === 'input-tools';
      const isSkillConnection = edge.targetHandle === 'input-skill';
      const isAIAgentTarget = targetNode?.type === 'aiAgent' || targetNode?.type === 'chatAgent';

      // Highlight memory/tool connections when AI Agent is executing and using them
      if (isAIAgentTarget && targetStatus?.status === 'executing') {
        const phase = targetStatus?.data?.phase as string | undefined;
        const hasMemory = targetStatus?.data?.has_memory;

        // Memory connection highlights during memory phases
        if (isMemoryConnection && hasMemory) {
          if (phase === 'loading_memory' || phase === 'memory_loaded' || phase === 'saving_memory') {
            className = 'memory-active';
          } else if (phase === 'invoking_llm') {
            // Keep memory edge highlighted during LLM invocation to show context is being used
            className = 'memory-active';
          }
        }
        // Tool connection highlights when the specific tool node is executing
        // Only highlight the edge whose source (tool node) is actually being used
        else if (isToolConnection) {
          const toolNodeStatus = sourceStatus?.status;
          if (toolNodeStatus === 'executing') {
            // This specific tool is being executed - highlight its edge
            className = 'tool-active';
          } else if ((phase === 'invoking_llm' || phase === 'building_graph') && toolNodeStatus === 'success') {
            // Tool completed successfully - keep edge showing success
            className = 'completed';
          }
        }
        // Skill connection highlights during skill loading phase (Zeenie)
        // Skills provide context to LLM, so highlight only when loading skills
        else if (isSkillConnection) {
          if (phase === 'loading_skills') {
            className = 'skill-active';
          }
        }
      }

      // Standard edge status classes - ONLY apply during active execution or deployment
      // When not executing/deploying, all edges should have the same default cyan color
      const isActiveExecution = isExecuting || isCurrentWorkflowDeployed;
      if (!className && isActiveExecution) {
        const srcStatus = sourceStatus?.status;
        const tgtStatus = targetStatus?.status;

        // Edge is executing if target is currently executing (data flowing into it)
        if (tgtStatus === 'executing') {
          className = 'executing';
        }
        // Edge is completed if both source and target are successful during this execution
        else if (srcStatus === 'success' && tgtStatus === 'success') {
          className = 'completed';
        }
        // Edge has error if target has error
        else if (tgtStatus === 'error') {
          className = 'error';
        }
        // Edge shows data flowing when source completed and target is waiting for inputs
        // This indicates data has been produced and is available to the target
        else if (srcStatus === 'success' && tgtStatus === 'waiting') {
          className = 'executing';
        }
        // Edge is pending if source completed but target hasn't started
        else if (srcStatus === 'success' && !tgtStatus) {
          className = 'pending';
        }
        // Edge is pending if source is waiting (hasn't produced output yet)
        // This keeps downstream edges from glowing until source completes
        else if (srcStatus === 'waiting') {
          className = 'pending';
        }
      }

      return {
        ...edge,
        className
      };
    });
  }, [edges, nodeStatuses, isExecuting, isCurrentWorkflowDeployed, nodes]);

  // Memoize ReactFlow options to prevent unnecessary re-renders
  const defaultEdgeOptions = React.useMemo(() => ({
    type: 'smoothstep',
    animated: true,
    style: { stroke: theme.dracula.cyan, strokeWidth: 3 },
  }), [theme.dracula.cyan]);

  const connectionLineStyle = React.useMemo(() => ({
    stroke: theme.dracula.cyan,
    strokeWidth: 2
  }), [theme.dracula.cyan]);

  const reactFlowStyle = React.useMemo(() => ({
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.background,
  }), [theme.colors.background]);

  const snapGrid: [number, number] = React.useMemo(() => [20, 20], []);

  const proOptions = React.useMemo(() => ({ hideAttribution: true }), []);

  // Use useRef for nodeTypes to guarantee the same object reference across all renders
  // including React.StrictMode's double-render cycle. useMemo can't guarantee this
  // because it may run during both render cycles.
  const nodeTypesRef = React.useRef(moduleNodeTypes);
  const edgeTypesRef = React.useRef(moduleEdgeTypes);

  // Execute entire workflow from start node to end
  const handleRun = async () => {
    if (!currentWorkflow) return;
    const workflowId = currentWorkflow.id;

    // Use per-workflow state setters (n8n pattern)
    setWorkflowExecuting(workflowId, true);
    setExecutionResult(null);
    clearWorkflowExecutionState(workflowId);
    setWorkflowExecuting(workflowId, true); // Re-set after clear

    try {
      // Check if there's a start node
      const startNode = nodes.find(node => node.type === 'start');
      if (!startNode) {
        alert('No Start node found in workflow.\n\nAdd a Start node to begin workflow execution.');
        setWorkflowExecuting(workflowId, false);
        return;
      }

      // Build execution order for visual feedback (BFS from start node)
      const buildOrder = () => {
        const order: string[] = [];
        const visited = new Set<string>();
        const queue = [startNode.id];
        const adjacencyMap = new Map<string, string[]>();

        edges.forEach(edge => {
          const sources = adjacencyMap.get(edge.source) || [];
          sources.push(edge.target);
          adjacencyMap.set(edge.source, sources);
        });

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          if (visited.has(currentId)) continue;
          visited.add(currentId);
          order.push(currentId);

          const connected = adjacencyMap.get(currentId) || [];
          connected.forEach(id => {
            if (!visited.has(id)) queue.push(id);
          });
        }
        return order;
      };

      const order = buildOrder();
      setWorkflowExecutionOrder(workflowId, order);

      console.log('[Workflow Run] Starting workflow execution with', nodes.length, 'nodes and', edges.length, 'edges');
      console.log('[Workflow Run] Execution order:', order);

      // Execute the entire workflow via WebSocket
      const workflowResult = await executeWorkflow(nodes, edges);

      console.log('[Workflow Run] Execution complete:', workflowResult);

      // Build result for display
      const result = {
        success: workflowResult.success,
        nodeId: 'workflow',
        nodeName: currentWorkflow.name || 'Workflow',
        timestamp: new Date().toISOString(),
        executionTime: workflowResult.execution_time || 0,
        outputs: workflowResult.node_results || {},
        data: workflowResult,
        error: workflowResult.error || (workflowResult.errors?.length > 0 ? workflowResult.errors[0].error : undefined),
        nodeData: workflowResult,
        // Workflow-specific display data
        nodesExecuted: workflowResult.nodes_executed || [],
        executionOrder: workflowResult.execution_order || [],
        totalNodes: workflowResult.total_nodes || 0,
        completedNodes: workflowResult.completed_nodes || 0,
        nodeResults: workflowResult.node_results || {},
        errors: workflowResult.errors || [],
        // For backwards compatibility with AI result modal
        response: workflowResult.success
          ? `Workflow executed successfully. ${workflowResult.completed_nodes}/${workflowResult.total_nodes} nodes completed.`
          : `Workflow failed: ${workflowResult.error || 'Unknown error'}`,
        model: 'workflow'
      };

      // Set result and show modal
      setExecutionResult(result);
      setShowResult(true);

    } catch (error: any) {
      console.error('Workflow execution error:', error);

      // Create error result for modal display
      const errorResult = {
        success: false,
        nodeId: 'workflow',
        nodeName: currentWorkflow?.name || 'Workflow',
        timestamp: new Date().toISOString(),
        executionTime: 0,
        error: error.message || 'Unknown execution error',
        response: `Error: ${error.message}`,
        model: 'workflow'
      };

      setExecutionResult(errorResult);
      setShowResult(true);
    } finally {
      setWorkflowExecuting(workflowId, false);
    }
  };

  // Deploy workflow - runs continuously until cancelled
  const handleDeploy = async () => {
    if (!currentWorkflow) return;

    // Check if there's at least one trigger node (workflow entry points)
    // Trigger types: start, cronScheduler, webhookTrigger, whatsappReceive, workflowTrigger, chatTrigger
    const triggerTypes = ['start', 'cronScheduler', 'webhookTrigger', 'whatsappReceive', 'workflowTrigger', 'chatTrigger'];
    const hasTriggerNode = nodes.some(node => triggerTypes.includes(node.type || ''));
    if (!hasTriggerNode) {
      alert('No trigger node found in workflow.\n\nAdd a trigger node (Cron Scheduler, WhatsApp Receive, Webhook, Chat Trigger, etc.) to begin deployment.');
      return;
    }

    try {
      // Settings are already synced to backend via WebSocket from SettingsPanel
      // Backend will use the stored settings

      // DEBUG: Log edges being sent to deployment
      console.log('[Dashboard] Deploying with edges:', {
        edgeCount: edges.length,
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle
        })),
        // Check for toolkit connections specifically
        toolkitEdges: edges.filter(e =>
          e.target?.includes('androidTool') || e.source?.includes('androidTool')
        )
      });

      const result = await deployWorkflow(currentWorkflow.id, nodes, edges, 'default');

      if (!result.success) {
        console.error('[Dashboard] Deployment failed:', result.error);
        alert(`Failed to start deployment: ${result.error}`);
      }
    } catch (error: any) {
      console.error('[Dashboard] Deployment error:', error);
      alert(`Deployment error: ${error.message}`);
    }
  };

  // Cancel running deployment for current workflow
  const handleCancelDeployment = async () => {
    try {
      const workflowId = currentWorkflow?.id;
      console.log('[Dashboard] Cancelling deployment for workflow:', workflowId);
      const result = await cancelDeployment(workflowId);

      if (result.success) {
        console.log('[Dashboard] Deployment cancelled:', result);
      } else {
        console.error('[Dashboard] Failed to cancel deployment:', result.message);
      }
    } catch (error: any) {
      console.error('[Dashboard] Cancel deployment error:', error);
    }
  };

  const handleExportJSON = async () => {
    try {
      const jsonString = exportWorkflowToJSON();
      await navigator.clipboard.writeText(jsonString);
      alert('Workflow JSON copied to clipboard');
    } catch (error) {
      console.error('Export JSON error:', error);
      alert('Failed to export workflow JSON');
    }
  };

  const handleExportFile = () => {
    try {
      exportWorkflowToFile();
    } catch (error) {
      console.error('Export file error:', error);
      alert('Failed to export workflow file');
    }
  };

  const handleImportJSON = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (e) => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const importedWorkflow = await importWorkflowFromFile(file);

        // Check for name conflict with existing workflows
        const existingNames = savedWorkflows.map(w => w.name.toLowerCase());
        let finalName = importedWorkflow.name;

        if (existingNames.includes(finalName.toLowerCase())) {
          // Name conflict detected - prompt user for new name
          const suggestedName = `${importedWorkflow.name} (imported)`;
          const userInput = window.prompt(
            `A workflow named "${importedWorkflow.name}" already exists.\n\nEnter a new name for the imported workflow:`,
            suggestedName
          );

          if (userInput === null) {
            // User cancelled the import
            return;
          }

          finalName = userInput.trim();

          if (!finalName) {
            alert('Workflow name cannot be empty');
            return;
          }

          // Check if the new name also conflicts
          if (existingNames.includes(finalName.toLowerCase())) {
            alert(`A workflow named "${finalName}" also exists. Please try again with a different name.`);
            return;
          }
        }

        const workflow = {
          ...importedWorkflow,
          name: finalName,
          id: generateWorkflowId(),
          createdAt: new Date(),
          lastModified: new Date()
        };

        console.log('Importing workflow:', workflow);

        // Save node parameters to database
        for (const node of workflow.nodes) {
          if (node.data && Object.keys(node.data).length > 0) {
            try {
              await saveNodeParameters(node.id, node.data);
              console.log(`Saved parameters for node ${node.id}:`, node.data);
            } catch (error) {
              console.error(`Failed to save parameters for node ${node.id}:`, error);
            }
          }
        }

        // Set as current workflow first
        setCurrentWorkflow(workflow);

        // Auto-save to database so it appears in sidebar immediately
        await saveWorkflow();

        console.log('Workflow imported and saved successfully');
        alert(`Workflow "${workflow.name}" imported with ${workflow.nodes.length} nodes and ${workflow.edges.length} connections`);
      } catch (error: any) {
        console.error('Import error:', error);
        alert(`Failed to import workflow: ${error.message}`);
      }
    };
    fileInput.click();
  };
  // Load saved workflows on mount and auto-select most recent or create new if none exist
  const hasMigrated = React.useRef(false);
  const hasInitialized = React.useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    console.log('[Dashboard] Mount effect - loading workflows', {
      hasCurrentWorkflow: !!currentWorkflow,
      currentWorkflowId: currentWorkflow?.id,
    });

    const initWorkflows = async () => {
      await loadSavedWorkflows();
      // loadSavedWorkflows auto-loads the most recent workflow if none is set
      // Only create new if still no workflow after loading
      const state = useAppStore.getState();
      if (!state.currentWorkflow) {
        console.log('[Dashboard] No saved workflows found, creating new one');
        createNewWorkflow();
      }
    };

    if (!currentWorkflow) {
      initWorkflows();
    } else if (!hasMigrated.current) {
      console.log('[Dashboard] Migrating current workflow');
      migrateCurrentWorkflow();
      hasMigrated.current = true;
      loadSavedWorkflows(); // Still load sidebar list
    }
  }, [loadSavedWorkflows, currentWorkflow, createNewWorkflow, migrateCurrentWorkflow]);

  // Sync workflow state → ReactFlow state (when loading workflows or data changes)
  // Note: Database is the source of truth for parameters - node.data should NOT store parameters
  // Parameters are loaded from database when parameter panel opens (useParameterPanel hook)
  // and when backend executes nodes (NodeExecutor._prepare_parameters)
  useEffect(() => {
    if (currentWorkflow && currentWorkflow.id) {
      const workflowNodes = currentWorkflow.nodes || [];
      setNodes(workflowNodes);
      setEdges(currentWorkflow.edges || []);
      // Do NOT sync database parameters to node.data
      // Database is the single source of truth for parameters
      // This prevents dual storage issues where node.data could diverge from database
    }
  }, [currentWorkflow?.id, currentWorkflow?.lastModified, setNodes, setEdges]);
  
  // Sync ReactFlow state → workflow state (debounced for performance)
  useEffect(() => {
    if (!currentWorkflow || !currentWorkflow.id) return;

    const timeoutId = setTimeout(() => {
      try {
        const currentNodesStr = JSON.stringify(sanitizeNodesForComparison(nodes));
        const currentEdgesStr = JSON.stringify(sanitizeEdgesForComparison(edges));
        const workflowNodesStr = JSON.stringify(sanitizeNodesForComparison(currentWorkflow.nodes || []));
        const workflowEdgesStr = JSON.stringify(sanitizeEdgesForComparison(currentWorkflow.edges || []));

        if (currentNodesStr !== workflowNodesStr || currentEdgesStr !== workflowEdgesStr) {
          console.log('[Dashboard] Syncing ReactFlow -> Store', {
            reactFlowEdgeCount: edges.length,
            storeEdgeCount: (currentWorkflow.edges || []).length,
            newEdges: edges.filter(e => !(currentWorkflow.edges || []).find(we => we.id === e.id))
          });
          updateWorkflow({ nodes, edges });
        }
      } catch (error) {
        console.warn('Failed to sync workflow state:', error);
      }
    }, theme.constants.debounceDelay.workflowUpdate);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, currentWorkflow?.id, updateWorkflow]);

  // Track previous workflow ID for viewport save/restore (n8n pattern)
  const prevWorkflowIdRef = React.useRef<string | null>(null);
  // Track if we've already restored viewport for current workflow (prevent duplicate restores)
  const viewportRestoredForRef = React.useRef<string | null>(null);

  // Save viewport when switching workflows, restore after nodes load (n8n pattern)
  useEffect(() => {
    const currentId = currentWorkflow?.id;
    const prevId = prevWorkflowIdRef.current;

    // Save viewport of previous workflow before switching
    if (prevId && prevId !== currentId) {
      try {
        const viewport = reactFlowInstance.getViewport();
        setWorkflowViewport(prevId, viewport);
      } catch {
        // Failed to save viewport - ignore
      }
      // Reset the restored flag when switching to new workflow
      viewportRestoredForRef.current = null;
    }

    prevWorkflowIdRef.current = currentId || null;
  }, [currentWorkflow?.id, reactFlowInstance, setWorkflowViewport]);

  // Restore viewport AFTER nodes are loaded and rendered
  // Only restores saved viewport - never auto-centers
  useEffect(() => {
    const currentId = currentWorkflow?.id;
    if (!currentId) return;

    // Skip if we already restored viewport for this workflow
    if (viewportRestoredForRef.current === currentId) {
      return;
    }

    // Get saved viewport from store
    const uiState = workflowUIStates[currentId];
    const savedViewport = uiState?.viewport;

    // Only restore if we have a saved viewport
    if (!savedViewport) {
      viewportRestoredForRef.current = currentId;
      return;
    }

    // Use delay to ensure ReactFlow has finished rendering nodes
    const timeoutId = setTimeout(() => {
      try {
        reactFlowInstance.setViewport(savedViewport, { duration: 0 });
        viewportRestoredForRef.current = currentId;
      } catch {
        // Viewport restore failed - ignore silently
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentWorkflow?.id, nodes.length, workflowUIStates, reactFlowInstance]);

  // Node context menu handler (right-click)
  const onNodeContextMenu = React.useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // Select the node when right-clicking
      setSelectedNode(node);
      setContextMenu({
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [setSelectedNode]
  );

  // Close context menu
  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu actions
  const handleContextMenuRename = React.useCallback(() => {
    if (contextMenu) {
      setRenamingNodeId(contextMenu.nodeId);
    }
    closeContextMenu();
  }, [contextMenu, setRenamingNodeId, closeContextMenu]);

  const handleContextMenuCopy = React.useCallback(() => {
    if (contextMenu) {
      // Select the node first, then copy
      const node = nodes.find(n => n.id === contextMenu.nodeId);
      if (node) {
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === contextMenu.nodeId })));
        // Small delay to ensure selection is applied before copy
        setTimeout(() => copySelectedNodes(), 0);
      }
    }
    closeContextMenu();
  }, [contextMenu, nodes, setNodes, copySelectedNodes, closeContextMenu]);

  const handleContextMenuDelete = React.useCallback(() => {
    if (contextMenu) {
      onNodesDelete([nodes.find(n => n.id === contextMenu.nodeId)].filter(Boolean) as Node[]);
    }
    closeContextMenu();
  }, [contextMenu, nodes, onNodesDelete, closeContextMenu]);

  // Keyboard shortcut handler for workflow operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in input/textarea
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignore shortcuts when renaming a node
      if (renamingNodeId) {
        return;
      }

      // F2 to rename selected node
      if (event.key === 'F2' && selectedNode) {
        event.preventDefault();
        setRenamingNodeId(selectedNode.id);
        return;
      }

      // Check for Ctrl/Cmd key shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 's':
            event.preventDefault();
            handleSave();
            break;
          case 'c':
            event.preventDefault();
            copySelectedNodes();
            break;
          case 'v':
            event.preventDefault();
            pasteNodes();
            break;
        }
      } else {
        // Non-modifier shortcuts
        switch (event.key.toLowerCase()) {
          case 'd':
            // Toggle disable on selected nodes
            event.preventDefault();
            toggleDisableSelected();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSave, copySelectedNodes, pasteNodes, toggleDisableSelected, selectedNode, renamingNodeId, setRenamingNodeId]);

  return (
    <>
      <style>{getEdgeStyles(theme.colors, isDarkMode)}</style>
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Top Toolbar */}
        <TopToolbar
          workflowName={currentWorkflow?.name || 'Untitled Workflow'}
          onWorkflowNameChange={handleWorkflowNameChange}
          onSave={handleSave}
          onNew={handleNew}
          onOpen={handleOpen}
          onRun={handleRun}
          isRunning={isExecuting}
          onDeploy={handleDeploy}
          onCancelDeployment={handleCancelDeployment}
          isDeploying={isCurrentWorkflowDeployed}
          hasUnsavedChanges={hasUnsavedChanges}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={toggleSidebar}
          componentPaletteVisible={componentPaletteVisible}
          onToggleComponentPalette={toggleComponentPalette}
          proMode={proMode}
          onToggleProMode={toggleProMode}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCredentials={() => setCredentialsOpen(true)}
          onExportJSON={handleExportJSON}
          onExportFile={handleExportFile}
          onImportJSON={handleImportJSON}
        />
        
        {/* Main Content Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}>
          {/* Left Workflow Sidebar */}
          <div style={{
            width: sidebarVisible ? '280px' : '0px',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
            borderRight: sidebarVisible ? `1px solid ${theme.colors.border}` : 'none',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {sidebarVisible && (
              <WorkflowSidebar
                workflows={savedWorkflows}
                currentWorkflowId={currentWorkflow?.id}
                onSelectWorkflow={handleSelectWorkflow}
                onDeleteWorkflow={deleteWorkflow}
              />
            )}
          </div>
          
          {/* Canvas Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            position: 'relative',
          }}>
            <div style={{
              flex: 1,
              backgroundColor: theme.colors.backgroundAlt,
            }}>
              <ErrorBoundary>
                <ReactFlow
                  nodes={styledNodes}
                  edges={styledEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodesDelete={onNodesDelete}
                  onEdgesDelete={onEdgesDelete}
                  onConnect={onConnect}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onNodeContextMenu={onNodeContextMenu}
                  nodeTypes={nodeTypesRef.current}
                  edgeTypes={edgeTypesRef.current}
                  connectionMode={ConnectionMode.Loose}
                  deleteKeyCode={isCurrentWorkflowLocked ? [] : ['Delete', 'Backspace']}
                  edgesFocusable={!isCurrentWorkflowLocked}
                  edgesUpdatable={!isCurrentWorkflowLocked}
                  nodesDraggable={!isCurrentWorkflowLocked}
                  nodesConnectable={!isCurrentWorkflowLocked}
                  nodesFocusable={!isCurrentWorkflowLocked}
                  elementsSelectable={!isCurrentWorkflowLocked}
                  selectNodesOnDrag={false}
                  selectionOnDrag={true}
                  selectionMode={SelectionMode.Partial}
                  selectionKeyCode="Control"
                  panOnDrag={true}
                  panOnScroll={false}
                  zoomOnScroll={true}
                  preventScrolling={true}
                  proOptions={proOptions}
                  defaultEdgeOptions={defaultEdgeOptions}
                  connectionLineStyle={connectionLineStyle}
                  connectionLineType={ConnectionLineType.SmoothStep}
                  snapToGrid={true}
                  snapGrid={snapGrid}
                  style={reactFlowStyle}
                >
                  <Controls />
                </ReactFlow>
              </ErrorBoundary>
            </div>
            
            {/* Right Component Palette */}
            <div style={{
              width: componentPaletteVisible ? theme.layout.sidebarWidth : '0px',
              overflow: 'hidden',
              transition: 'width 0.3s ease',
              borderLeft: componentPaletteVisible ? `1px solid ${theme.colors.border}` : 'none',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {componentPaletteVisible && (
                <ComponentPalette
                  nodeDefinitions={nodeDefinitions}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  collapsedSections={collapsedSections}
                  onToggleSection={toggleSection}
                  onDragStart={handleComponentDragStart}
                  proMode={proMode}
                />
              )}
            </div>
          </div>
        </div>

        {/* Console Panel - n8n-style debug output at bottom */}
        <ConsolePanel
          isOpen={consolePanelOpen}
          onToggle={() => setConsolePanelOpen(prev => !prev)}
          nodes={nodes}
        />

        {/* Parameter Panels */}
        <ErrorBoundary>
          <ParameterPanel />
          <LocationParameterPanel />
        </ErrorBoundary>
        
        {/* AI Result Modal */}
        <AIResultModal
          isOpen={showResult}
          onClose={() => setShowResult(false)}
          result={executionResult}
        />

        {/* Settings Panel Modal */}
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettingsChange={setSettings}
        />

        {/* Credentials Modal */}
        <CredentialsModal
          visible={credentialsOpen}
          onClose={() => setCredentialsOpen(false)}
        />

        {/* Node Context Menu (right-click) */}
        {contextMenu && (
          <NodeContextMenu
            nodeId={contextMenu.nodeId}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={closeContextMenu}
            onRename={handleContextMenuRename}
            onCopy={handleContextMenuCopy}
            onDelete={handleContextMenuDelete}
          />
        )}
      </div>
    </>
  );
};

// Outer wrapper component that provides ReactFlowProvider context
const Dashboard: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DashboardContent />
    </ReactFlowProvider>
  );
};

export default Dashboard;