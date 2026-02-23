// Apify Node Definitions - Web scraping and social media data extraction
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { APIFY_ICON } from '../assets/icons/apify';

// Re-export icon for external use
export { APIFY_ICON };

// ============================================================================
// APIFY NODES
// ============================================================================

export const apifyNodes: Record<string, INodeTypeDescription> = {
  // Apify Actor - Run any Apify actor (scraper)
  apifyActor: {
    displayName: 'Apify Actor',
    name: 'apifyActor',
    icon: APIFY_ICON,
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
    properties: [
      // ===== ACTOR SELECTION =====
      {
        displayName: 'Actor',
        name: 'actorId',
        type: 'options',
        options: [
          { name: 'Instagram Scraper', value: 'apify/instagram-scraper' },
          { name: 'TikTok Scraper', value: 'clockworks/tiktok-scraper' },
          { name: 'Twitter/X Scraper', value: 'apidojo/tweet-scraper' },
          { name: 'LinkedIn Profile Scraper', value: 'curious_coder/linkedin-profile-scraper' },
          { name: 'Facebook Posts Scraper', value: 'apify/facebook-posts-scraper' },
          { name: 'YouTube Scraper', value: 'apify/youtube-scraper' },
          { name: 'Google Search Scraper', value: 'apify/google-search-scraper' },
          { name: 'Google Maps Scraper', value: 'apify/google-maps-scraper' },
          { name: 'Website Content Crawler', value: 'apify/website-content-crawler' },
          { name: 'Web Scraper', value: 'apify/web-scraper' },
          { name: 'Custom Actor ID', value: 'custom' }
        ],
        default: 'apify/instagram-scraper',
        required: true,
        description: 'Select a pre-built Apify actor or enter custom actor ID'
      },

      // ===== CUSTOM ACTOR ID (shown when 'custom' selected) =====
      {
        displayName: 'Custom Actor ID',
        name: 'customActorId',
        type: 'string',
        default: '',
        placeholder: 'username/actor-name or actor-id',
        description: 'Enter the actor ID from Apify Store (e.g., apify/cheerio-scraper)',
        displayOptions: {
          show: { actorId: ['custom'] }
        }
      },

      // ===== ACTOR INPUT (JSON) =====
      {
        displayName: 'Actor Input (JSON)',
        name: 'actorInput',
        type: 'json',
        default: '{}',
        typeOptions: { rows: 6 },
        description: 'Input parameters for the actor in JSON format. Each actor has different input schema.'
      },

      // ===== QUICK INPUT HELPERS (Instagram) =====
      {
        displayName: 'Instagram URLs',
        name: 'instagramUrls',
        type: 'string',
        default: '',
        placeholder: 'https://instagram.com/username, https://instagram.com/p/...',
        description: 'Comma-separated Instagram profile or post URLs',
        displayOptions: {
          show: { actorId: ['apify/instagram-scraper'] }
        }
      },

      // ===== QUICK INPUT HELPERS (TikTok) =====
      {
        displayName: 'TikTok Profiles',
        name: 'tiktokProfiles',
        type: 'string',
        default: '',
        placeholder: 'username1, username2',
        description: 'Comma-separated TikTok usernames to scrape',
        displayOptions: {
          show: { actorId: ['clockworks/tiktok-scraper'] }
        }
      },
      {
        displayName: 'TikTok Hashtags',
        name: 'tiktokHashtags',
        type: 'string',
        default: '',
        placeholder: 'trending, fyp',
        description: 'Comma-separated TikTok hashtags to scrape (without #)',
        displayOptions: {
          show: { actorId: ['clockworks/tiktok-scraper'] }
        }
      },

      // ===== QUICK INPUT HELPERS (Twitter) =====
      {
        displayName: 'Twitter Search Terms',
        name: 'twitterSearchTerms',
        type: 'string',
        default: '',
        placeholder: 'AI automation, #tech',
        description: 'Comma-separated search terms or hashtags',
        displayOptions: {
          show: { actorId: ['apidojo/tweet-scraper'] }
        }
      },
      {
        displayName: 'Twitter Handles',
        name: 'twitterHandles',
        type: 'string',
        default: '',
        placeholder: 'elonmusk, openai',
        description: 'Comma-separated Twitter usernames (without @)',
        displayOptions: {
          show: { actorId: ['apidojo/tweet-scraper'] }
        }
      },

      // ===== QUICK INPUT HELPERS (Google Search) =====
      {
        displayName: 'Search Query',
        name: 'googleSearchQuery',
        type: 'string',
        default: '',
        placeholder: 'best AI tools 2026',
        description: 'Google search query',
        displayOptions: {
          show: { actorId: ['apify/google-search-scraper'] }
        }
      },
      {
        displayName: 'Pages to Scrape',
        name: 'googleSearchPages',
        type: 'number',
        default: 1,
        typeOptions: { minValue: 1, maxValue: 10 },
        description: 'Number of search result pages (10 results per page)',
        displayOptions: {
          show: { actorId: ['apify/google-search-scraper'] }
        }
      },

      // ===== QUICK INPUT HELPERS (Web Crawler) =====
      {
        displayName: 'Start URLs',
        name: 'crawlerStartUrls',
        type: 'string',
        default: '',
        placeholder: 'https://example.com, https://docs.example.com',
        description: 'Comma-separated URLs to start crawling from',
        displayOptions: {
          show: { actorId: ['apify/website-content-crawler'] }
        }
      },
      {
        displayName: 'Max Crawl Depth',
        name: 'crawlerMaxDepth',
        type: 'number',
        default: 2,
        typeOptions: { minValue: 0, maxValue: 10 },
        description: 'Maximum link depth to crawl (0 = start URLs only)',
        displayOptions: {
          show: { actorId: ['apify/website-content-crawler'] }
        }
      },
      {
        displayName: 'Max Pages',
        name: 'crawlerMaxPages',
        type: 'number',
        default: 50,
        typeOptions: { minValue: 1, maxValue: 1000 },
        description: 'Maximum number of pages to crawl',
        displayOptions: {
          show: { actorId: ['apify/website-content-crawler'] }
        }
      },

      // ===== EXECUTION OPTIONS =====
      {
        displayName: 'Max Results',
        name: 'maxResults',
        type: 'number',
        default: 100,
        typeOptions: { minValue: 1, maxValue: 10000 },
        description: 'Maximum number of items to return from the dataset'
      },
      {
        displayName: 'Timeout (seconds)',
        name: 'timeout',
        type: 'number',
        default: 300,
        typeOptions: { minValue: 30, maxValue: 3600 },
        description: 'Maximum time to wait for actor completion (30s - 1 hour)'
      },
      {
        displayName: 'Memory (MB)',
        name: 'memory',
        type: 'options',
        options: [
          { name: '128 MB', value: 128 },
          { name: '256 MB', value: 256 },
          { name: '512 MB', value: 512 },
          { name: '1 GB', value: 1024 },
          { name: '2 GB', value: 2048 },
          { name: '4 GB', value: 4096 }
        ],
        default: 1024,
        description: 'Memory allocation for the actor run (affects speed and cost)'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const APIFY_NODE_TYPES = ['apifyActor'];
