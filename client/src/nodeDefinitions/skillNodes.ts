// Skill Node Definitions - Skill nodes for Zeenie capabilities
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { WHATSAPP_CONNECT_ICON } from './whatsappNodes';

// ============================================================================
// SKILL NODES - Connect to Zeenie's input-skill handle
// ============================================================================

// Factory function for creating skill node definitions
function createSkillNode(config: {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  skillName: string;
  description: string;
  subtitle: string;
  properties?: any[];
}): INodeTypeDescription {
  return {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon,
    group: ['skill'],
    version: 1,
    subtitle: config.subtitle,
    description: config.description,
    defaults: { name: config.displayName, color: config.color },
    inputs: [],  // No input - skill node is passive
    outputs: [{
      name: 'skill',
      displayName: 'Skill',
      type: 'main' as NodeConnectionType,
      description: 'Connect to Zeenie skill handle'
    }],
    properties: [
      {
        displayName: 'Skill Name',
        name: 'skillName',
        type: 'string',
        default: config.skillName,
        required: true,
        description: 'Internal skill identifier',
        typeOptions: { readonly: true }
      },
      {
        displayName: 'Instructions',
        name: 'instructions',
        type: 'string',
        default: '',
        description: 'Skill instructions in Markdown format. Loaded from SKILL.md file.',
        typeOptions: {
          rows: 20,
          editor: 'code',
          editorLanguage: 'markdown'
        }
      },
      ...(config.properties || [])
    ]
  };
}

export const skillNodes: Record<string, INodeTypeDescription> = {
  // Assistant Personality Skill - Default assistant personality
  assistantPersonality: createSkillNode({
    name: 'assistantPersonality',
    displayName: 'Assistant Personality',
    icon: '✨',
    color: '#D97706',
    skillName: 'assistant-personality',
    subtitle: 'AI Personality',
    description: 'Default assistant personality with helpful, harmless, and honest responses'
  }),

  // WhatsApp Skill - Send and receive messages
  whatsappSkill: createSkillNode({
    name: 'whatsappSkill',
    displayName: 'WhatsApp Skill',
    icon: WHATSAPP_CONNECT_ICON,
    color: '#25D366',
    skillName: 'whatsapp-skill',
    subtitle: 'Messaging',
    description: 'Send and receive WhatsApp messages via Zeenie'
  }),

  // Memory Skill - Remember and recall information
  memorySkill: createSkillNode({
    name: 'memorySkill',
    displayName: 'Memory Skill',
    icon: '🧠',
    color: '#8B5CF6',
    skillName: 'memory-skill',
    subtitle: 'Long-term Memory',
    description: 'Remember information across conversations with short and long-term memory',
    properties: [
      {
        displayName: 'Default Session',
        name: 'defaultSession',
        type: 'string',
        default: 'default',
        description: 'Default session ID for memory storage'
      }
    ]
  }),

  // Maps Skill - Location and geocoding services
  mapsSkill: createSkillNode({
    name: 'mapsSkill',
    displayName: 'Maps Skill',
    icon: '🗺️',
    color: '#4285F4',
    skillName: 'maps-skill',
    subtitle: 'Location Services',
    description: 'Geocoding, nearby places, and map creation via Google Maps'
  }),

  // HTTP Skill - Make API requests
  httpSkill: createSkillNode({
    name: 'httpSkill',
    displayName: 'HTTP Skill',
    icon: '🌐',
    color: '#EF4444',
    skillName: 'http-skill',
    subtitle: 'API Requests',
    description: 'Make HTTP requests to external APIs and web services'
  }),

  // Scheduler Skill - Timers and cron jobs
  schedulerSkill: createSkillNode({
    name: 'schedulerSkill',
    displayName: 'Scheduler Skill',
    icon: '⏰',
    color: '#10B981',
    skillName: 'scheduler-skill',
    subtitle: 'Task Scheduling',
    description: 'Schedule tasks with timers and cron expressions'
  }),

  // Android Skill - Device control
  androidSkill: createSkillNode({
    name: 'androidSkill',
    displayName: 'Android Skill',
    icon: '📱',
    color: '#3DDC84',
    skillName: 'android-skill',
    subtitle: 'Device Control',
    description: 'Control Android devices - battery, wifi, bluetooth, apps, location, camera'
  }),

  // Code Skill - Execute code
  codeSkill: createSkillNode({
    name: 'codeSkill',
    displayName: 'Code Skill',
    icon: '💻',
    color: '#F59E0B',
    skillName: 'code-skill',
    subtitle: 'Code Execution',
    description: 'Execute Python or JavaScript code for calculations and data processing'
  }),

  // Web Search Skill - Search the web for information
  webSearchSkill: createSkillNode({
    name: 'webSearchSkill',
    displayName: 'Web Search Skill',
    icon: '🔍',
    color: '#bd93f9',
    skillName: 'web-search-skill',
    subtitle: 'Web Search',
    description: 'Search the web for current information, news, facts, and real-time data'
  }),

  // Master Skill - Aggregates multiple skills with enable/disable toggles
  masterSkill: {
    displayName: 'Master Skill',
    name: 'masterSkill',
    icon: '🎯',
    group: ['skill'],
    version: 1,
    subtitle: 'Skill Aggregator',
    description: 'Combine multiple skills with enable/disable toggles in a single connection',
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
        displayName: 'Skills Configuration',
        name: 'skillsConfig',
        type: 'json',
        default: {},
        description: 'Enabled skills and their instructions'
      }
    ]
  },

  // Custom Skill - User-created skill
  customSkill: {
    displayName: 'Custom Skill',
    name: 'customSkill',
    icon: '⭐',
    group: ['skill'],
    version: 1,
    subtitle: 'User-defined',
    description: 'User-created custom skill with configurable capabilities',
    defaults: { name: 'Custom Skill', color: '#6366F1' },
    inputs: [],
    outputs: [{
      name: 'skill',
      displayName: 'Skill',
      type: 'main' as NodeConnectionType,
      description: 'Connect to Zeenie skill handle'
    }],
    properties: [
      {
        displayName: 'Skill',
        name: 'selectedSkill',
        type: 'options',
        default: '',
        required: true,
        description: 'Select a user-created skill',
        typeOptions: {
          dynamicOptions: true
        }
      }
    ]
  }
};

// List of skill node types for easy identification
export const SKILL_NODE_TYPES = [
  'assistantPersonality',
  'whatsappSkill',
  'memorySkill',
  'mapsSkill',
  'httpSkill',
  'schedulerSkill',
  'androidSkill',
  'codeSkill',
  'webSearchSkill',
  'masterSkill',
  'customSkill'
];

// Export for nodeDefinitions.ts
export default skillNodes;
