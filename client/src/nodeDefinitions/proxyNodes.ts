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
    properties: [
      {
        displayName: 'Method',
        name: 'method',
        type: 'options',
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' }
        ]
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://api.example.com/endpoint'
      },
      {
        displayName: 'Headers',
        name: 'headers',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 3 },
        placeholder: '{"Authorization": "Bearer token"}'
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        default: '',
        typeOptions: { rows: 4 },
        placeholder: '{"key": "value"}',
        displayOptions: { show: { method: ['POST', 'PUT', 'PATCH'] } }
      },
      {
        displayName: 'Timeout (seconds)',
        name: 'timeout',
        type: 'number',
        default: 30,
        typeOptions: { minValue: 5, maxValue: 300 }
      },

      // ===== PROXY CONFIG =====
      {
        displayName: 'Proxy Provider',
        name: 'proxyProvider',
        type: 'string',
        default: '',
        placeholder: 'Auto-select (best score)',
        description: 'Provider name to use, or leave empty for auto-selection'
      },
      {
        displayName: 'Country',
        name: 'proxyCountry',
        type: 'string',
        default: '',
        placeholder: 'US',
        description: 'ISO 3166-1 alpha-2 country code for geo-targeting (e.g., US, GB, DE)'
      },
      {
        displayName: 'Session Type',
        name: 'sessionType',
        type: 'options',
        default: 'rotating',
        options: [
          { name: 'Rotating', value: 'rotating' },
          { name: 'Sticky', value: 'sticky' }
        ],
        description: 'Rotating: new IP per request. Sticky: same IP for duration.'
      },
      {
        displayName: 'Sticky Duration (seconds)',
        name: 'stickyDuration',
        type: 'number',
        default: 300,
        typeOptions: { minValue: 30, maxValue: 3600 },
        displayOptions: { show: { sessionType: ['sticky'] } },
        description: 'How long to maintain the same IP address'
      },
      {
        displayName: 'Max Retries',
        name: 'maxRetries',
        type: 'number',
        default: 3,
        typeOptions: { minValue: 0, maxValue: 10 },
        description: 'Number of retry attempts on failure (with failover to other providers)'
      },
      {
        displayName: 'Follow Redirects',
        name: 'followRedirects',
        type: 'boolean',
        default: true,
        description: 'Automatically follow HTTP redirects'
      }
    ]
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
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: 'list_providers',
        required: true,
        options: [
          { name: 'List Providers', value: 'list_providers' },
          { name: 'Add Provider', value: 'add_provider' },
          { name: 'Update Provider', value: 'update_provider' },
          { name: 'Remove Provider', value: 'remove_provider' },
          { name: 'Set Credentials', value: 'set_credentials' },
          { name: 'Test Provider', value: 'test_provider' },
          { name: 'Get Stats', value: 'get_stats' },
          { name: 'Add Routing Rule', value: 'add_routing_rule' },
          { name: 'List Routing Rules', value: 'list_routing_rules' },
          { name: 'Remove Routing Rule', value: 'remove_routing_rule' }
        ]
      },
      // Provider fields
      {
        displayName: 'Provider Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'my_proxy_provider',
        description: 'Unique name for the proxy provider',
        displayOptions: { show: { operation: ['add_provider', 'update_provider', 'remove_provider', 'set_credentials', 'test_provider'] } }
      },
      {
        displayName: 'Gateway Host',
        name: 'gateway_host',
        type: 'string',
        default: '',
        placeholder: 'gate.example.com',
        description: 'Proxy gateway hostname',
        displayOptions: { show: { operation: ['add_provider', 'update_provider'] } }
      },
      {
        displayName: 'Gateway Port',
        name: 'gateway_port',
        type: 'number',
        default: 0,
        placeholder: '7777',
        description: 'Proxy gateway port',
        displayOptions: { show: { operation: ['add_provider', 'update_provider'] } }
      },
      {
        displayName: 'URL Template (JSON)',
        name: 'url_template',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 6 },
        description: 'JSON template config for proxy URL encoding',
        displayOptions: { show: { operation: ['add_provider', 'update_provider'] } }
      },
      {
        displayName: 'Cost per GB (USD)',
        name: 'cost_per_gb',
        type: 'number',
        default: 0,
        typeOptions: { minValue: 0, maxValue: 100 },
        description: 'Cost per gigabyte in USD',
        displayOptions: { show: { operation: ['add_provider', 'update_provider'] } }
      },
      {
        displayName: 'Priority',
        name: 'priority',
        type: 'number',
        default: 50,
        typeOptions: { minValue: 0, maxValue: 100 },
        description: 'Provider priority (lower = preferred)',
        displayOptions: { show: { operation: ['add_provider', 'update_provider'] } }
      },
      {
        displayName: 'Enabled',
        name: 'enabled',
        type: 'boolean',
        default: true,
        displayOptions: { show: { operation: ['add_provider', 'update_provider'] } }
      },
      // Credential fields
      {
        displayName: 'Username',
        name: 'username',
        type: 'string',
        default: '',
        description: 'Proxy username',
        displayOptions: { show: { operation: ['set_credentials'] } }
      },
      {
        displayName: 'Password',
        name: 'password',
        type: 'string',
        default: '',
        description: 'Proxy password',
        displayOptions: { show: { operation: ['set_credentials'] } }
      },
      // Routing rule fields
      {
        displayName: 'Domain Pattern',
        name: 'domain_pattern',
        type: 'string',
        default: '',
        placeholder: '*.linkedin.com',
        description: 'Domain glob pattern for routing (e.g., *.linkedin.com, *)',
        displayOptions: { show: { operation: ['add_routing_rule'] } }
      },
      {
        displayName: 'Preferred Providers (JSON)',
        name: 'preferred_providers',
        type: 'string',
        default: '[]',
        placeholder: '["provider1", "provider2"]',
        description: 'JSON array of preferred provider names',
        displayOptions: { show: { operation: ['add_routing_rule'] } }
      },
      {
        displayName: 'Required Country',
        name: 'required_country',
        type: 'string',
        default: '',
        placeholder: 'US',
        description: 'ISO country code required for this domain',
        displayOptions: { show: { operation: ['add_routing_rule'] } }
      },
      {
        displayName: 'Session Type',
        name: 'session_type',
        type: 'options',
        default: 'rotating',
        options: [
          { name: 'Rotating', value: 'rotating' },
          { name: 'Sticky', value: 'sticky' }
        ],
        displayOptions: { show: { operation: ['add_routing_rule'] } }
      },
      {
        displayName: 'Rule ID',
        name: 'rule_id',
        type: 'number',
        default: 0,
        description: 'ID of the routing rule to remove',
        displayOptions: { show: { operation: ['remove_routing_rule'] } }
      }
    ]
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
    properties: [
      {
        displayName: 'Provider',
        name: 'providerFilter',
        type: 'string',
        default: '',
        placeholder: 'All providers',
        description: 'Filter by specific provider name, or leave empty for all'
      }
    ]
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
