// Search API Node Definitions - Brave Search, Serper, Perplexity Sonar
// Dual-purpose nodes: work as standalone workflow nodes AND AI Agent tools
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { BRAVE_SEARCH_ICON, SERPER_ICON, PERPLEXITY_ICON } from '../assets/icons/search';

// ============================================================================
// SEARCH NODES
// ============================================================================

export const searchNodes: Record<string, INodeTypeDescription> = {
  // Brave Search - Web search via Brave Search API
  braveSearch: {
    displayName: 'Brave Search',
    name: 'braveSearch',
    icon: BRAVE_SEARCH_ICON,
    group: ['search', 'tool'],
    version: 1,
    subtitle: 'Web Search',
    description: 'Search the web using Brave Search API. Returns web results with titles, snippets, and URLs.',
    defaults: { name: 'Brave Search', color: '#FB542B' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Search input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Search results'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // Serper Search - Google-powered search via Serper API
  serperSearch: {
    displayName: 'Serper Search',
    name: 'serperSearch',
    icon: SERPER_ICON,
    group: ['search', 'tool'],
    version: 1,
    subtitle: 'Google Search',
    description: 'Search the web using Google via Serper API. Returns web results with titles, snippets, and URLs.',
    defaults: { name: 'Serper Search', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Search input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Search results'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // Perplexity Search - AI-powered search via Perplexity Sonar API
  perplexitySearch: {
    displayName: 'Perplexity Search',
    name: 'perplexitySearch',
    icon: PERPLEXITY_ICON,
    group: ['search', 'tool'],
    version: 1,
    subtitle: 'AI Search',
    description: 'Search the web using Perplexity Sonar AI. Returns an AI-generated answer with citations.',
    defaults: { name: 'Perplexity Search', color: '#20808D' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Search input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'AI-powered search results with citations'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const SEARCH_NODE_TYPES = ['braveSearch', 'serperSearch', 'perplexitySearch'];
