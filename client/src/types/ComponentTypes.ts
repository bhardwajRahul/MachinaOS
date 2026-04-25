import { INodeTypeDescription } from './INodeProperties';

export interface ComponentPaletteState {
  collapsedSections: Record<string, boolean>;
  searchQuery: string;
}

export interface ComponentPaletteActions {
  onSearchChange: (query: string) => void;
  onToggleSection: (sectionId: string) => void;
  onDragStart: (event: React.DragEvent, definition: INodeTypeDescription) => void;
}

export interface ComponentPaletteProps extends ComponentPaletteState, ComponentPaletteActions {
  proMode?: boolean;  // false = simple mode (only AI categories), true = pro mode (all categories)
  // Flips true after Dashboard's prefetchAllNodeSpecs resolves so the
  // palette's useMemo recomputes against the now-warm spec cache.
  specsReady?: boolean;
}

export interface WorkflowHandlers {
  handleWorkflowNameChange: (name: string) => void;
  handleSave: () => void;
  handleNew: () => void;
  handleOpen: () => void;
  handleSelectWorkflow: (workflow: any) => void;
  handleDeleteWorkflow: (id: string) => void;
  handleDuplicateWorkflow: (workflow: any) => void;
}

export interface DragDropHandlers {
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  handleComponentDragStart: (event: React.DragEvent, definition: any) => void;
}

export interface ReactFlowHandlers {
  onConnect: (params: any) => void;
  onNodesDelete: (deleted: any[]) => void;
  onEdgesDelete: (deleted: any[]) => void;
}