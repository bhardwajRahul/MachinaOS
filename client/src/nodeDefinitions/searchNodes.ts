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
    properties: [
      // ===== TOOL CONFIG =====
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'brave_search',
        description: 'Name of this tool when used by AI Agent'
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Search the web using Brave Search. Returns web results with titles, snippets, and URLs.',
        description: 'Description shown to AI Agent'
      },

      // ===== SEARCH QUERY =====
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'What is the latest news about AI?',
        description: 'Search query to look up on the web'
      },

      // ===== RESULT OPTIONS =====
      {
        displayName: 'Max Results',
        name: 'maxResults',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Maximum number of results to return (1-100)'
      },
      {
        displayName: 'Country',
        name: 'country',
        type: 'string',
        default: '',
        placeholder: 'US',
        description: 'Country code for localized results (e.g., US, GB, DE). Leave empty for global.'
      },
      {
        displayName: 'Search Language',
        name: 'searchLang',
        type: 'string',
        default: '',
        placeholder: 'en',
        description: 'Language code for results (e.g., en, fr, de). Leave empty for default.'
      },
      {
        displayName: 'Safe Search',
        name: 'safeSearch',
        type: 'options',
        options: [
          { name: 'Off', value: 'off' },
          { name: 'Moderate', value: 'moderate' },
          { name: 'Strict', value: 'strict' }
        ],
        default: 'moderate',
        description: 'Safe search filter level'
      }
    ]
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
    properties: [
      // ===== TOOL CONFIG =====
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'serper_search',
        description: 'Name of this tool when used by AI Agent'
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Search the web using Google via Serper API. Returns web results with titles, snippets, and URLs.',
        description: 'Description shown to AI Agent'
      },

      // ===== SEARCH QUERY =====
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'best restaurants in New York',
        description: 'Search query to look up on Google'
      },

      // ===== SEARCH TYPE =====
      {
        displayName: 'Search Type',
        name: 'searchType',
        type: 'options',
        options: [
          { name: 'Web Search', value: 'search' },
          { name: 'News', value: 'news' },
          { name: 'Images', value: 'images' },
          { name: 'Places', value: 'places' }
        ],
        default: 'search',
        description: 'Type of search to perform'
      },

      // ===== RESULT OPTIONS =====
      {
        displayName: 'Max Results',
        name: 'maxResults',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Maximum number of results to return (1-100)'
      },
      {
        displayName: 'Country',
        name: 'country',
        type: 'string',
        default: '',
        placeholder: 'us',
        description: 'Country code for localized results (e.g., us, gb, de). Leave empty for global.'
      },
      {
        displayName: 'Language',
        name: 'language',
        type: 'string',
        default: '',
        placeholder: 'en',
        description: 'Language code for results (e.g., en, fr, de). Leave empty for default.'
      }
    ]
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
    properties: [
      // ===== TOOL CONFIG =====
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'perplexity_search',
        description: 'Name of this tool when used by AI Agent'
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Search the web using Perplexity Sonar AI. Returns an AI-generated answer with citations and source URLs.',
        description: 'Description shown to AI Agent'
      },

      // ===== SEARCH QUERY =====
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'What are the latest developments in quantum computing?',
        description: 'Search query to get AI-powered answer with citations'
      },

      // ===== MODEL =====
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        options: [
          { name: 'Sonar (Default)', value: 'sonar' },
          { name: 'Sonar Pro', value: 'sonar-pro' },
          { name: 'Sonar Reasoning', value: 'sonar-reasoning' },
          { name: 'Sonar Reasoning Pro', value: 'sonar-reasoning-pro' }
        ],
        default: 'sonar',
        description: 'Perplexity Sonar model to use'
      },

      // ===== OPTIONS =====
      {
        displayName: 'Search Recency Filter',
        name: 'searchRecencyFilter',
        type: 'options',
        options: [
          { name: 'None', value: '' },
          { name: 'Last Month', value: 'month' },
          { name: 'Last Week', value: 'week' },
          { name: 'Last Day', value: 'day' },
          { name: 'Last Hour', value: 'hour' }
        ],
        default: '',
        description: 'Filter results by recency'
      },
      {
        displayName: 'Return Images',
        name: 'returnImages',
        type: 'boolean',
        default: false,
        description: 'Include images in the response'
      },
      {
        displayName: 'Return Related Questions',
        name: 'returnRelatedQuestions',
        type: 'boolean',
        default: false,
        description: 'Include related questions in the response'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const SEARCH_NODE_TYPES = ['braveSearch', 'serperSearch', 'perplexitySearch'];
