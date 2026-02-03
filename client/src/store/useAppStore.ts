import { create } from 'zustand';
import { Node, Edge } from 'reactflow';
import { SavedWorkflow } from '../components/ui/WorkflowSidebar';
import { generateWorkflowId } from '../utils/workflow';
import { theme } from '../styles/theme';
import {
  exportWorkflowToJSON as exportToJSON,
  exportWorkflowToFile as exportToFile,
  importWorkflowFromJSON as importFromJSON
} from '../utils/workflowExport';
import { workflowApi } from '../services/workflowApi';

export interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  name: string;
  id: string;
  createdAt: Date;
  lastModified: Date;
}

// Per-workflow UI state (n8n pattern - each workflow has isolated execution state)
export interface WorkflowUIState {
  selectedNodeId: string | null;
  executedNodes: string[];  // Array instead of Set for serialization
  executionOrder: string[];
  isExecuting: boolean;
  viewport?: { x: number; y: number; zoom: number };
}

interface AppStore {
  // Core state - SINGLE source of truth
  currentWorkflow: WorkflowData | null;
  hasUnsavedChanges: boolean;

  // Per-workflow UI state (n8n pattern - isolated per workflow)
  workflowUIStates: Record<string, WorkflowUIState>;

  // Global UI state (not workflow-specific)
  selectedNode: Node | null;  // Kept for backward compatibility, derived from workflowUIStates
  sidebarVisible: boolean;
  componentPaletteVisible: boolean;
  consolePanelVisible: boolean;
  proMode: boolean;  // false = noob mode (only AI categories), true = pro mode (all categories)
  renamingNodeId: string | null;

  // Saved workflows
  savedWorkflows: SavedWorkflow[];

  // Workflow actions
  setCurrentWorkflow: (workflow: WorkflowData) => void;
  updateWorkflow: (updates: Partial<Omit<WorkflowData, 'id' | 'createdAt'>>) => void;
  createNewWorkflow: () => void;
  saveWorkflow: () => Promise<void>;
  loadWorkflow: (id: string) => Promise<void>;
  loadSavedWorkflows: () => Promise<void>;
  deleteWorkflow: (id: string) => Promise<boolean>;
  migrateCurrentWorkflow: () => Promise<void>;

  // UI actions
  setSelectedNode: (node: Node | null) => void;
  toggleSidebar: () => void;
  toggleComponentPalette: () => void;
  toggleProMode: () => void;
  setRenamingNodeId: (nodeId: string | null) => void;

  // UI defaults from database
  setSidebarVisible: (visible: boolean) => void;
  setComponentPaletteVisible: (visible: boolean) => void;
  setConsolePanelVisible: (visible: boolean) => void;
  toggleConsolePanelVisible: () => void;
  applyUIDefaults: (defaults: { sidebarDefaultOpen?: boolean; componentPaletteDefaultOpen?: boolean; consolePanelDefaultOpen?: boolean }) => void;

  // Per-workflow UI state actions (n8n pattern)
  getWorkflowUIState: (workflowId: string) => WorkflowUIState;
  setWorkflowExecuting: (workflowId: string, isExecuting: boolean) => void;
  setWorkflowExecutedNodes: (workflowId: string, nodes: string[]) => void;
  setWorkflowExecutionOrder: (workflowId: string, order: string[]) => void;
  setWorkflowViewport: (workflowId: string, viewport: { x: number; y: number; zoom: number }) => void;
  clearWorkflowExecutionState: (workflowId: string) => void;

  // Node/Edge actions (operate on currentWorkflow)
  updateNodeData: (nodeId: string, newData: any) => void;
  updateNodes: (nodes: Node[]) => void;
  updateEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNodes: (nodeIds: string[]) => void;
  removeEdges: (edgeIds: string[]) => void;

  // Workflow export/import
  exportWorkflowToJSON: () => string;
  exportWorkflowToFile: () => void;
  importWorkflowFromJSON: (jsonString: string) => void;
}

// Helper functions
const createDefaultWorkflow = (): WorkflowData => ({
  id: generateWorkflowId(),
  name: theme.constants.defaultWorkflowName,
  nodes: [],
  edges: [],
  createdAt: new Date(),
  lastModified: new Date(),
});

const createDefaultUIState = (): WorkflowUIState => ({
  selectedNodeId: null,
  executedNodes: [],
  executionOrder: [],
  isExecuting: false,
  viewport: undefined,
});

// Helper to migrate old node types
const migrateNodes = (nodes: Node[]): Node[] => {
  return nodes.map(node => {
    if (node.type === 'googleChatModel') {
      return { ...node, type: 'geminiChatModel' };
    }
    return node;
  });
};

// Storage keys for UI state persistence
const STORAGE_KEYS = {
  sidebarVisible: 'ui_sidebar_visible',
  componentPaletteVisible: 'ui_component_palette_visible',
  consolePanelVisible: 'ui_console_panel_visible',
  proMode: 'ui_pro_mode',
};

// Helper to load boolean from localStorage
const loadBooleanFromStorage = (key: string, defaultValue: boolean): boolean => {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore storage errors
  }
  return defaultValue;
};

// Helper to save boolean to localStorage
const saveBooleanToStorage = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage errors
  }
};

export const useAppStore = create<AppStore>((set, get) => ({
  currentWorkflow: null,
  hasUnsavedChanges: false,
  workflowUIStates: {},
  selectedNode: null,
  sidebarVisible: loadBooleanFromStorage(STORAGE_KEYS.sidebarVisible, true),
  componentPaletteVisible: loadBooleanFromStorage(STORAGE_KEYS.componentPaletteVisible, true),
  consolePanelVisible: loadBooleanFromStorage(STORAGE_KEYS.consolePanelVisible, false),
  proMode: loadBooleanFromStorage(STORAGE_KEYS.proMode, false),  // Default to noob mode
  renamingNodeId: null,
  savedWorkflows: [],
  
  // Workflow management
  setCurrentWorkflow: (workflow) => {
    set({ currentWorkflow: workflow, hasUnsavedChanges: false });
  },
  
  updateWorkflow: (updates) => {
    const current = get().currentWorkflow;
    if (!current) return;
    
    const updatedWorkflow = {
      ...current,
      ...updates,
      lastModified: new Date(),
    };
    
    set({ 
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
    });
  },
  
  createNewWorkflow: () => {
    const newWorkflow = createDefaultWorkflow();
    set({ 
      currentWorkflow: newWorkflow,
      hasUnsavedChanges: false,
      selectedNode: null,
    });
  },
  
  saveWorkflow: async () => {
    const { currentWorkflow, savedWorkflows } = get();
    if (!currentWorkflow) return;

    const updatedWorkflow = {
      ...currentWorkflow,
      lastModified: new Date(),
    };

    // Save to database
    const success = await workflowApi.saveWorkflow(
      updatedWorkflow.id,
      updatedWorkflow.name,
      { nodes: updatedWorkflow.nodes, edges: updatedWorkflow.edges }
    );

    if (!success) {
      console.error('Failed to save workflow to database');
      return;
    }

    // Update local saved workflows list
    const existingIndex = savedWorkflows.findIndex(w => w.id === updatedWorkflow.id);

    const workflowSummary: SavedWorkflow = {
      id: updatedWorkflow.id,
      name: updatedWorkflow.name,
      createdAt: updatedWorkflow.createdAt,
      lastModified: updatedWorkflow.lastModified,
      nodeCount: updatedWorkflow.nodes.length,
    };

    let newSavedWorkflows: SavedWorkflow[];
    if (existingIndex >= 0) {
      newSavedWorkflows = [...savedWorkflows];
      newSavedWorkflows[existingIndex] = workflowSummary;
    } else {
      newSavedWorkflows = [workflowSummary, ...savedWorkflows];
    }

    set({
      currentWorkflow: updatedWorkflow,
      savedWorkflows: newSavedWorkflows,
      hasUnsavedChanges: false,
    });
  },
  
  loadWorkflow: async (id) => {
    const result = await workflowApi.getWorkflow(id);
    if (result) {
      // Migrate old node types
      const nodes = migrateNodes(result.data?.nodes || []);
      const edges = result.data?.edges || [];

      const workflowData: WorkflowData = {
        id: result.id,
        name: result.name,
        nodes,
        edges,
        createdAt: new Date(result.createdAt),
        lastModified: new Date(result.lastModified),
      };

      set({
        currentWorkflow: workflowData,
        hasUnsavedChanges: false,
        selectedNode: null,
      });
    }
  },
  
  loadSavedWorkflows: async () => {
    const workflows = await workflowApi.getAllWorkflows();
    const savedWorkflows: SavedWorkflow[] = workflows.map(w => ({
      id: w.id,
      name: w.name,
      nodeCount: w.nodeCount,
      createdAt: new Date(w.createdAt),
      lastModified: new Date(w.lastModified),
    }));
    set({ savedWorkflows });

    // Auto-load the most recent workflow if no current workflow is set
    const { currentWorkflow } = get();
    if (!currentWorkflow && savedWorkflows.length > 0) {
      // Sort by lastModified descending and load the first one
      const sortedWorkflows = [...savedWorkflows].sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
      );
      const mostRecent = sortedWorkflows[0];
      await get().loadWorkflow(mostRecent.id);
    }
  },

  deleteWorkflow: async (id) => {
    const { currentWorkflow, savedWorkflows } = get();

    const success = await workflowApi.deleteWorkflow(id);
    if (!success) {
      console.error('Failed to delete workflow from database');
      return false;
    }

    // Remove from saved workflows list
    const newSavedWorkflows = savedWorkflows.filter(w => w.id !== id);

    // If deleting current workflow, create a new one
    if (currentWorkflow?.id === id) {
      const newWorkflow = createDefaultWorkflow();
      set({
        currentWorkflow: newWorkflow,
        savedWorkflows: newSavedWorkflows,
        hasUnsavedChanges: false,
        selectedNode: null,
      });
    } else {
      set({ savedWorkflows: newSavedWorkflows });
    }

    return true;
  },

  migrateCurrentWorkflow: async () => {
    const { currentWorkflow } = get();
    if (!currentWorkflow || !currentWorkflow.nodes) return;

    const migratedNodes = migrateNodes(currentWorkflow.nodes);

    const hasChanges = migratedNodes.some((node, idx) =>
      node.type !== currentWorkflow.nodes[idx]?.type
    );

    if (hasChanges) {
      const migratedWorkflow = {
        ...currentWorkflow,
        nodes: migratedNodes
      };

      // Save migrated workflow to database
      await workflowApi.saveWorkflow(
        migratedWorkflow.id,
        migratedWorkflow.name,
        { nodes: migratedWorkflow.nodes, edges: migratedWorkflow.edges }
      );

      set({
        currentWorkflow: migratedWorkflow,
        hasUnsavedChanges: false
      });
    }
  },

  // UI management
  setSelectedNode: (node) => {
    set({ selectedNode: node });
  },

  toggleSidebar: () => {
    set((state) => {
      const newValue = !state.sidebarVisible;
      saveBooleanToStorage(STORAGE_KEYS.sidebarVisible, newValue);
      return { sidebarVisible: newValue };
    });
  },

  toggleComponentPalette: () => {
    set((state) => {
      const newValue = !state.componentPaletteVisible;
      saveBooleanToStorage(STORAGE_KEYS.componentPaletteVisible, newValue);
      return { componentPaletteVisible: newValue };
    });
  },

  toggleProMode: () => {
    set((state) => {
      const newValue = !state.proMode;
      saveBooleanToStorage(STORAGE_KEYS.proMode, newValue);
      return { proMode: newValue };
    });
  },

  setRenamingNodeId: (nodeId) => {
    set({ renamingNodeId: nodeId });
  },

  // UI defaults setters (for database sync)
  setSidebarVisible: (visible) => {
    saveBooleanToStorage(STORAGE_KEYS.sidebarVisible, visible);
    set({ sidebarVisible: visible });
  },

  setComponentPaletteVisible: (visible) => {
    saveBooleanToStorage(STORAGE_KEYS.componentPaletteVisible, visible);
    set({ componentPaletteVisible: visible });
  },

  setConsolePanelVisible: (visible) => {
    saveBooleanToStorage(STORAGE_KEYS.consolePanelVisible, visible);
    set({ consolePanelVisible: visible });
  },

  toggleConsolePanelVisible: () => {
    set((state) => {
      const newValue = !state.consolePanelVisible;
      saveBooleanToStorage(STORAGE_KEYS.consolePanelVisible, newValue);
      return { consolePanelVisible: newValue };
    });
  },

  applyUIDefaults: (defaults) => {
    const updates: Partial<{ sidebarVisible: boolean; componentPaletteVisible: boolean; consolePanelVisible: boolean }> = {};

    if (defaults.sidebarDefaultOpen !== undefined) {
      updates.sidebarVisible = defaults.sidebarDefaultOpen;
      saveBooleanToStorage(STORAGE_KEYS.sidebarVisible, defaults.sidebarDefaultOpen);
    }

    if (defaults.componentPaletteDefaultOpen !== undefined) {
      updates.componentPaletteVisible = defaults.componentPaletteDefaultOpen;
      saveBooleanToStorage(STORAGE_KEYS.componentPaletteVisible, defaults.componentPaletteDefaultOpen);
    }

    if (defaults.consolePanelDefaultOpen !== undefined) {
      updates.consolePanelVisible = defaults.consolePanelDefaultOpen;
      saveBooleanToStorage(STORAGE_KEYS.consolePanelVisible, defaults.consolePanelDefaultOpen);
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  // Per-workflow UI state management (n8n pattern - isolated execution state per workflow)
  getWorkflowUIState: (workflowId) => {
    const { workflowUIStates } = get();
    return workflowUIStates[workflowId] || createDefaultUIState();
  },

  setWorkflowExecuting: (workflowId, isExecuting) => {
    set((state) => {
      const prevState = state.workflowUIStates[workflowId];
      return {
        workflowUIStates: {
          ...state.workflowUIStates,
          [workflowId]: {
            ...(prevState || createDefaultUIState()),
            isExecuting,
          },
        },
      };
    });
  },

  setWorkflowExecutedNodes: (workflowId, nodes) => {
    set((state) => ({
      workflowUIStates: {
        ...state.workflowUIStates,
        [workflowId]: {
          ...(state.workflowUIStates[workflowId] || createDefaultUIState()),
          executedNodes: nodes,
        },
      },
    }));
  },

  setWorkflowExecutionOrder: (workflowId, order) => {
    set((state) => ({
      workflowUIStates: {
        ...state.workflowUIStates,
        [workflowId]: {
          ...(state.workflowUIStates[workflowId] || createDefaultUIState()),
          executionOrder: order,
        },
      },
    }));
  },

  setWorkflowViewport: (workflowId, viewport) => {
    set((state) => ({
      workflowUIStates: {
        ...state.workflowUIStates,
        [workflowId]: {
          ...(state.workflowUIStates[workflowId] || createDefaultUIState()),
          viewport,
        },
      },
    }));
  },

  clearWorkflowExecutionState: (workflowId) => {
    set((state) => ({
      workflowUIStates: {
        ...state.workflowUIStates,
        [workflowId]: {
          ...(state.workflowUIStates[workflowId] || createDefaultUIState()),
          isExecuting: false,
          executedNodes: [],
          executionOrder: [],
        },
      },
    }));
  },

  updateNodeData: (nodeId, newData) => {
    const { currentWorkflow, selectedNode } = get();
    if (!currentWorkflow) return;
    
    const updatedNodes = currentWorkflow.nodes.map(node => 
      node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
    );
    
    const updatedWorkflow = {
      ...currentWorkflow,
      nodes: updatedNodes,
      lastModified: new Date(),
    };
    
    set({ 
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
      selectedNode: selectedNode?.id === nodeId ? 
        { ...selectedNode, data: { ...selectedNode.data, ...newData } } : 
        selectedNode
    });
  },
  
  updateNodes: (nodes) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;
    
    const updatedWorkflow = {
      ...currentWorkflow,
      nodes,
      lastModified: new Date(),
    };
    
    set({ 
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
    });
  },
  
  updateEdges: (edges) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;
    
    const updatedWorkflow = {
      ...currentWorkflow,
      edges,
      lastModified: new Date(),
    };
    
    set({ 
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
    });
  },
  
  addNode: (node) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;
    
    const updatedWorkflow = {
      ...currentWorkflow,
      nodes: [...currentWorkflow.nodes, node],
      lastModified: new Date(),
    };
    
    set({ 
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
    });
  },
  
  removeNodes: (nodeIds) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;
    
    const updatedNodes = currentWorkflow.nodes.filter(node => !nodeIds.includes(node.id));
    const updatedEdges = currentWorkflow.edges.filter(edge => 
      !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
    );
    
    const updatedWorkflow = {
      ...currentWorkflow,
      nodes: updatedNodes,
      edges: updatedEdges,
      lastModified: new Date(),
    };
    
    set({ 
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
      selectedNode: nodeIds.includes(get().selectedNode?.id || '') ? null : get().selectedNode,
    });
  },
  
  removeEdges: (edgeIds) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    const updatedEdges = currentWorkflow.edges.filter(edge => !edgeIds.includes(edge.id));

    const updatedWorkflow = {
      ...currentWorkflow,
      edges: updatedEdges,
      lastModified: new Date(),
    };

    set({
      currentWorkflow: updatedWorkflow,
      hasUnsavedChanges: true,
    });
  },

  exportWorkflowToJSON: () => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) {
      throw new Error('No workflow to export');
    }

    return exportToJSON(currentWorkflow);
  },

  exportWorkflowToFile: () => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) {
      throw new Error('No workflow to export');
    }

    exportToFile(currentWorkflow);
  },

  importWorkflowFromJSON: (jsonString: string) => {
    const workflow = importFromJSON(jsonString);
    set({
      currentWorkflow: workflow,
      hasUnsavedChanges: true
    });
  },
}));