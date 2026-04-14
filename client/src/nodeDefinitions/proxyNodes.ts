// Proxy Nodes - Proxy-aware HTTP requests and provider status
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

// ============================================================================
// PROXY NODES
// ============================================================================

export const proxyNodes: Record<string, INodeTypeDescription> = {
  proxyRequest: {
    displayName: 'Proxy Request',
    name: 'proxyRequest',
    icon: '🛡',
    group: ['proxy', 'tool'],
    version: 1,
    description: 'Make HTTP requests through residential proxy providers with geo-targeting and failover',
    defaults: { name: 'Proxy Request', color: '#8B5CF6' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Trigger input' }],
    outputs: [{
      name: 'main',
      displayName: 'Response',
      type: 'main' as NodeConnectionType,
      description: 'status, data, headers, proxy_provider, proxy_country'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  proxyConfig: {
    displayName: 'Proxy Config',
    name: 'proxyConfig',
    icon: '🔧',
    group: ['proxy', 'tool'],
    version: 1,
    description: 'Configure proxy providers and routing rules. Works as workflow node or AI Agent tool.',
    defaults: { name: 'Proxy Config', color: '#8B5CF6' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Trigger input' }],
    outputs: [{
      name: 'main',
      displayName: 'Result',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  proxyStatus: {
    displayName: 'Proxy Status',
    name: 'proxyStatus',
    icon: '📊',
    group: ['proxy', 'tool'],
    version: 1,
    description: 'View proxy provider health, scores, and usage statistics',
    defaults: { name: 'Proxy Status', color: '#6366F1' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Trigger input' }],
    outputs: [{
      name: 'main',
      displayName: 'Stats',
      type: 'main' as NodeConnectionType,
      description: 'providers, routing_rules, stats'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  }
};

// ============================================================================
// PROXY PARAMETERS (shared, for injection into other nodes)
// ============================================================================

/**
 * Common proxy parameters to add to existing nodes (httpRequest, search, scraper).
 * These are appended to the node's properties array.
 */
export const PROXY_PARAMETERS = [
  {
    displayName: 'Use Proxy',
    name: 'useProxy',
    type: 'boolean' as const,
    default: false,
    description: 'Route request through a residential proxy provider'
  },
  {
    displayName: 'Proxy Provider',
    name: 'proxyProvider',
    type: 'string' as const,
    default: '',
    placeholder: 'Auto-select',
    description: 'Provider name, or leave empty for auto-selection',
    displayOptions: { show: { useProxy: [true] } }
  },
  {
    displayName: 'Proxy Country',
    name: 'proxyCountry',
    type: 'string' as const,
    default: '',
    placeholder: 'US',
    description: 'ISO country code for geo-targeting',
    displayOptions: { show: { useProxy: [true] } }
  }
];

export const PROXY_NODE_TYPES = ['proxyRequest', 'proxyStatus', 'proxyConfig'];
