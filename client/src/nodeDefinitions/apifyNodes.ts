// Apify Node Definitions - Web scraping and social media data extraction
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// ============================================================================
// APIFY NODES
// ============================================================================

export const apifyNodes: Record<string, INodeTypeDescription> = {
  // Apify Actor - Run any Apify actor (scraper)
  apifyActor: {
    displayName: 'Apify Actor',
    name: 'apifyActor',
    group: ['api', 'scraper', 'tool'],
    version: 1,
    subtitle: 'Run Web Scraper',
    description: 'Run web scrapers for social media, websites, and search engines using Apify actors',
    defaults: { name: 'Apify Actor', color: '#FF9012' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Actor input data'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Scraped data results'
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

export const APIFY_NODE_TYPES = ['apifyActor'];
