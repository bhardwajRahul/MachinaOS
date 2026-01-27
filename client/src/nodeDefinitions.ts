// Main Node Definitions - Central registry importing from modular files
import { INodeTypeDescription } from './types/INodeProperties';

// Import modular node definitions
import { aiModelNodes } from './nodeDefinitions/aiModelNodes';
import { aiAgentNodes, AI_NODE_TYPES } from './nodeDefinitions/aiAgentNodes';
import { toolNodes, TOOL_NODE_TYPES } from './nodeDefinitions/toolNodes';
import { locationNodes, LOCATION_NODE_TYPES } from './nodeDefinitions/locationNodes';
import { whatsappNodes, WHATSAPP_NODE_TYPES } from './nodeDefinitions/whatsappNodes';
import { workflowNodes } from './nodeDefinitions/workflowNodes';
import { schedulerNodes, SCHEDULER_NODE_TYPES } from './nodeDefinitions/schedulerNodes';
import { androidServiceNodes, ANDROID_SERVICE_NODE_TYPES } from './nodeDefinitions/androidServiceNodes';
import { androidDeviceNodes } from './nodeDefinitions/androidDeviceNodes';
import { chatNodes, CHAT_NODE_TYPES } from './nodeDefinitions/chatNodes';
import { codeNodes, CODE_NODE_TYPES } from './nodeDefinitions/codeNodes';
import { utilityNodes, UTILITY_NODE_TYPES } from './nodeDefinitions/utilityNodes';
import { skillNodes, SKILL_NODE_TYPES } from './nodeDefinitions/skillNodes';
import { documentNodes, DOCUMENT_NODE_TYPES } from './nodeDefinitions/documentNodes';

// ============================================================================
// MAIN NODE REGISTRY - Combining all modular definitions
// ============================================================================

// Merge all node definitions from modular files
export const nodeDefinitions: Record<string, INodeTypeDescription> = {
  ...workflowNodes,
  ...schedulerNodes,
  ...aiModelNodes,
  ...aiAgentNodes,
  ...toolNodes,
  ...locationNodes,
  ...whatsappNodes,
  ...androidServiceNodes,
  ...androidDeviceNodes,
  ...chatNodes,
  ...codeNodes,
  ...utilityNodes,
  ...skillNodes,
  ...documentNodes
};

// ============================================================================
// HELPER FUNCTIONS AND EXPORTS
// ============================================================================

// Export helper function to get all node types
export const getNodeTypes = (): string[] => {
  return Object.keys(nodeDefinitions);
};

// Export helper function to get nodes by group
export const getNodesByGroup = (group: string): INodeTypeDescription[] => {
  return Object.values(nodeDefinitions).filter(node =>
    node.group?.includes(group)
  );
};

// Export AI and Location node lists for easy reference (updated with new nodes)
export const AI_NODES = [
  ...AI_NODE_TYPES
];

export const LOCATION_NODES = [
  ...LOCATION_NODE_TYPES
];

export const WHATSAPP_NODES = [
  ...WHATSAPP_NODE_TYPES
];

export const ANDROID_SERVICE_NODES = [
  ...ANDROID_SERVICE_NODE_TYPES
];

export const SCHEDULER_NODES = [
  ...SCHEDULER_NODE_TYPES
];

export const CHAT_NODES = [
  ...CHAT_NODE_TYPES
];

export const CODE_NODES = [
  ...CODE_NODE_TYPES
];

export const UTILITY_NODES = [
  ...UTILITY_NODE_TYPES
];

export const TOOL_NODES = [
  ...TOOL_NODE_TYPES
];

export const SKILL_NODES = [
  ...SKILL_NODE_TYPES
];

export const DOCUMENT_NODES = [
  ...DOCUMENT_NODE_TYPES
];

// Re-export types and utilities from modular files for external access
export { createBaseChatModel } from './nodeDefinitions/aiModelNodes';