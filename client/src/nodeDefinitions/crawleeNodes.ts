// Crawlee Web Scraping Node - Static & Browser-based scraping via Crawlee
// Dual-purpose node: works as standalone workflow node AND AI Agent tool

import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const crawleeNodes: Record<string, INodeTypeDescription> = {
  crawleeScraper: {
    displayName: 'Web Scraper',
    name: 'crawleeScraper',
    group: ['api', 'tool'],
    version: 1,
    subtitle: 'Crawlee Scraper',
    description: 'Scrape web pages using Crawlee. Supports static HTML (BeautifulSoup) and JS-rendered content (Playwright).',
    defaults: { name: 'Web Scraper', color: '#00D1B2' },
    inputs: [
      {
        name: 'main',
        displayName: 'Input',
        type: 'main' as NodeConnectionType,
        description: 'Scraping input',
      },
    ],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Scraped content and metadata',
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle',
      },
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },
};

export const CRAWLEE_NODE_TYPES = ['crawleeScraper'];
