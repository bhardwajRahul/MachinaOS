// Skill Node Definitions - Skill nodes for Zeenie capabilities
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

// ============================================================================
// SKILL NODES - Connect to Zeenie's input-skill handle
// ============================================================================
// Master Skill node aggregates built-in skills from server/skills/ folders
// and user-created skills from database. Supports inline skill creation/editing.

export const skillNodes: Record<string, INodeTypeDescription> = {
  // Master Skill - Aggregates multiple skills with enable/disable toggles
  masterSkill: {
    displayName: 'Master Skill',
    name: 'masterSkill',
    icon: '🎯',
    group: ['tool'],  // Appears in AI Tools category
    version: 1,
    subtitle: 'Skill Aggregator',
    description: 'Combine built-in and custom skills with enable/disable toggles',
    defaults: { name: 'Master Skill', color: '#9333EA' },
    inputs: [],
    outputs: [{
      name: 'skill',
      displayName: 'Skills',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent skill handle'
    }],
    properties: [
      {
        displayName: 'Skill Folder',
        name: 'skillFolder',
        type: 'string',
        default: 'assistant',
        description: 'Subfolder under server/skills/ to scan for skills.'
      },
      {
        displayName: 'Skills Configuration',
        name: 'skillsConfig',
        type: 'json',
        default: {},
        description: 'Enabled skills and their instructions'
      }
    ]
  }
};

// List of skill node types for easy identification
export const SKILL_NODE_TYPES = [
  'masterSkill'
];

// Export for nodeDefinitions.ts
export default skillNodes;
