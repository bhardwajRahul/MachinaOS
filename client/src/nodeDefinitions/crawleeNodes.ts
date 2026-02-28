// Crawlee Web Scraping Node - Static & Browser-based scraping via Crawlee
// Dual-purpose node: works as standalone workflow node AND AI Agent tool

import {
  INodeTypeDescription,
  NodeConnectionType,
} from '../types/INodeProperties';
import { PROXY_PARAMETERS } from './proxyNodes';

export const crawleeNodes: Record<string, INodeTypeDescription> = {
  crawleeScraper: {
    displayName: 'Web Scraper',
    name: 'crawleeScraper',
    icon: '🕷',
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
    properties: [
      // ===== TOOL CONFIG =====
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'web_scraper',
        description: 'Name of this tool when used by AI Agent',
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default:
          'Scrape web pages to extract text content, links, and structured data. Supports static HTML and JavaScript-rendered pages.',
        description: 'Description shown to AI Agent',
      },

      // ===== CRAWLER TYPE =====
      {
        displayName: 'Crawler Type',
        name: 'crawlerType',
        type: 'options',
        options: [
          { name: 'BeautifulSoup (Static HTML)', value: 'beautifulsoup' },
          { name: 'Playwright (Browser)', value: 'playwright' },
          { name: 'Adaptive (Auto-detect)', value: 'adaptive' },
        ],
        default: 'beautifulsoup',
        description:
          'Crawler engine. BeautifulSoup for static pages, Playwright for JS-rendered content, Adaptive to auto-detect.',
      },

      // ===== URL =====
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://example.com',
        description: 'Starting URL to scrape',
      },

      // ===== SCRAPING MODE =====
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        options: [
          { name: 'Single Page', value: 'single' },
          { name: 'Crawl Links', value: 'crawl' },
        ],
        default: 'single',
        description:
          'Single page scraping or follow links to crawl multiple pages',
      },

      // ===== CONTENT EXTRACTION =====
      {
        displayName: 'CSS Selector',
        name: 'cssSelector',
        type: 'string',
        default: '',
        placeholder: 'article, .content, #main',
        description:
          'CSS selector to extract specific content. Leave empty for full page text.',
      },
      {
        displayName: 'Extract Links',
        name: 'extractLinks',
        type: 'boolean',
        default: false,
        description: 'Include all discovered links in the output',
      },

      // ===== CRAWL OPTIONS (shown when mode = crawl) =====
      {
        displayName: 'Link Selector',
        name: 'linkSelector',
        type: 'string',
        default: '',
        placeholder: 'a[href]',
        description:
          'CSS selector for links to follow. Leave empty to follow all links.',
        displayOptions: { show: { mode: ['crawl'] } },
      },
      {
        displayName: 'URL Pattern',
        name: 'urlPattern',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/blog/**',
        description:
          'Glob pattern to filter which URLs to crawl. Leave empty for same-domain only.',
        displayOptions: { show: { mode: ['crawl'] } },
      },
      {
        displayName: 'Max Pages',
        name: 'maxPages',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 1000 },
        description: 'Maximum number of pages to scrape (1-1000)',
        displayOptions: { show: { mode: ['crawl'] } },
      },
      {
        displayName: 'Max Depth',
        name: 'maxDepth',
        type: 'number',
        default: 2,
        typeOptions: { minValue: 0, maxValue: 10 },
        description: 'Maximum link depth to follow (0 = start URL only)',
        displayOptions: { show: { mode: ['crawl'] } },
      },

      // ===== BROWSER OPTIONS (Playwright/Adaptive only) =====
      {
        displayName: 'Wait For Selector',
        name: 'waitForSelector',
        type: 'string',
        default: '',
        placeholder: '.loaded-content',
        description: 'CSS selector to wait for before extracting content',
        displayOptions: {
          show: { crawlerType: ['playwright', 'adaptive'] },
        },
      },
      {
        displayName: 'Wait Timeout (ms)',
        name: 'waitTimeout',
        type: 'number',
        default: 30000,
        typeOptions: { minValue: 1000, maxValue: 120000 },
        description: 'Maximum time to wait for page load in milliseconds',
        displayOptions: {
          show: { crawlerType: ['playwright', 'adaptive'] },
        },
      },
      {
        displayName: 'Take Screenshot',
        name: 'screenshot',
        type: 'boolean',
        default: false,
        description: 'Capture a screenshot of each page (returned as base64)',
        displayOptions: {
          show: { crawlerType: ['playwright', 'adaptive'] },
        },
      },
      {
        displayName: 'Browser Type',
        name: 'browserType',
        type: 'options',
        options: [
          { name: 'Chromium', value: 'chromium' },
          { name: 'Firefox', value: 'firefox' },
          { name: 'WebKit', value: 'webkit' },
        ],
        default: 'chromium',
        description: 'Browser engine to use for rendering',
        displayOptions: {
          show: { crawlerType: ['playwright', 'adaptive'] },
        },
      },
      {
        displayName: 'Block Resources',
        name: 'blockResources',
        type: 'boolean',
        default: true,
        description:
          'Block images, fonts, and stylesheets for faster scraping',
        displayOptions: {
          show: { crawlerType: ['playwright', 'adaptive'] },
        },
      },

      // ===== GENERAL OPTIONS =====
      {
        displayName: 'Timeout (seconds)',
        name: 'timeout',
        type: 'number',
        default: 60,
        typeOptions: { minValue: 10, maxValue: 600 },
        description: 'Maximum time for the entire scraping operation',
      },
      {
        displayName: 'Max Concurrency',
        name: 'maxConcurrency',
        type: 'number',
        default: 5,
        typeOptions: { minValue: 1, maxValue: 20 },
        description: 'Maximum concurrent requests',
      },
      {
        displayName: 'Output Format',
        name: 'outputFormat',
        type: 'options',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'HTML', value: 'html' },
          { name: 'Markdown', value: 'markdown' },
        ],
        default: 'text',
        description: 'Format of the extracted content',
      },

      // ===== PROXY PARAMS (shared from proxyNodes) =====
      ...PROXY_PARAMETERS,
    ],
  },
};

export const CRAWLEE_NODE_TYPES = ['crawleeScraper'];
