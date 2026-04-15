// Main Node Definitions - Central registry importing from modular files
import { INodeTypeDescription } from './types/INodeProperties';

// Import modular node definitions
import { aiModelNodes } from './nodeDefinitions/aiModelNodes';
import { aiAgentNodes } from './nodeDefinitions/aiAgentNodes';
import { toolNodes } from './nodeDefinitions/toolNodes';
import { specializedAgentNodes } from './nodeDefinitions/specializedAgentNodes';
import { locationNodes } from './nodeDefinitions/locationNodes';
import { whatsappNodes } from './nodeDefinitions/whatsappNodes';
import { telegramNodes } from './nodeDefinitions/telegramNodes';
import { workflowNodes } from './nodeDefinitions/workflowNodes';
import { schedulerNodes } from './nodeDefinitions/schedulerNodes';
import { androidServiceNodes } from './nodeDefinitions/androidServiceNodes';
import { chatNodes } from './nodeDefinitions/chatNodes';
import { codeNodes } from './nodeDefinitions/codeNodes';
import { utilityNodes } from './nodeDefinitions/utilityNodes';
import { skillNodes } from './nodeDefinitions/skillNodes';
import { documentNodes } from './nodeDefinitions/documentNodes';
import { socialNodes } from './nodeDefinitions/socialNodes';
import { twitterNodes } from './nodeDefinitions/twitterNodes';
import { apifyNodes } from './nodeDefinitions/apifyNodes';
import { searchNodes } from './nodeDefinitions/searchNodes';
import { googleWorkspaceNodes } from './nodeDefinitions/googleWorkspaceNodes';
import { proxyNodes } from './nodeDefinitions/proxyNodes';
import { crawleeNodes } from './nodeDefinitions/crawleeNodes';
import { browserNodes } from './nodeDefinitions/browserNodes';
import { filesystemNodes } from './nodeDefinitions/filesystemNodes';
import { processNodes } from './nodeDefinitions/processNodes';
import { emailNodes } from './nodeDefinitions/emailNodes';


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
  ...specializedAgentNodes,
  ...locationNodes,
  ...whatsappNodes,
  ...telegramNodes,
  ...androidServiceNodes,
  ...chatNodes,
  ...codeNodes,
  ...utilityNodes,
  ...skillNodes,
  ...documentNodes,
  ...socialNodes,
  ...twitterNodes,
  ...apifyNodes,
  ...searchNodes,
  ...googleWorkspaceNodes,
  ...proxyNodes,
  ...crawleeNodes,
  ...browserNodes,
  ...filesystemNodes,
  ...processNodes,
  ...emailNodes
};

export { createBaseChatModel } from './nodeDefinitions/aiModelNodes';
