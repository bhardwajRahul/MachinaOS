// Twitter/X Node Definitions - X API v2 integration via OAuth 2.0
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// ============================================================================
// TWITTER ICONS (SVG Data URIs) - X Brand black color
// ============================================================================

// Wave 10.B: node icons resolved from asset:x via assets/icons/twitter/x.svg.
// TWITTER_ICON export retained because credentials modal still imports the
// raw data URI directly (providers.tsx).
export const TWITTER_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FFFFFF'%3E%3Cpath d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'/%3E%3C/svg%3E";

// ============================================================================
// TWITTER NODES
// ============================================================================

export const twitterNodes: Record<string, INodeTypeDescription> = {
  // Twitter Send - Post tweets, reply, retweet, like
  twitterSend: {
    displayName: 'Twitter Send',
    name: 'twitterSend',
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Post to Twitter/X',
    description: 'Post tweets, reply, retweet, like, or delete tweets on Twitter/X',
    defaults: { name: 'Twitter Send', color: '#000000' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Tweet input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Tweet result'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (TwitterSendParams).
    properties: [
      { displayName: 'Tweet Text', name: 'text', type: 'string' as any, default: '', placeholder: "What's happening?" },
      { displayName: 'Tweet ID', name: 'tweetId', type: 'string' as any, default: '', placeholder: '1234567890123456789' },
      { displayName: 'Media URLs', name: 'mediaUrls', type: 'string' as any, default: '', placeholder: 'https://example.com/image1.jpg, https://example.com/image2.jpg' },
      { displayName: 'Poll Options', name: 'pollOptions', type: 'string' as any, default: '', placeholder: 'Option 1, Option 2, Option 3' },
    ],
  },

  // Twitter Receive - Trigger on mentions, searches, timeline updates
  twitterReceive: {
    displayName: 'Twitter Receive',
    name: 'twitterReceive',
    group: ['social', 'trigger'],
    version: 1,
    subtitle: 'On Twitter Event',
    description: 'Trigger workflow on Twitter mentions, search results, or timeline updates (polling-based)',
    defaults: { name: 'Twitter Receive', color: '#1DA1F2' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Tweet',
      type: 'main' as NodeConnectionType,
      description: 'Received tweet data (tweet_id, text, author_id, author_username, created_at, metrics)'
    }],
    // Wave 8: schema lives on backend (TwitterReceiveParams).
    properties: [
      { displayName: 'Search Query', name: 'searchQuery', type: 'string' as any, default: '', placeholder: 'from:elonmusk OR #AI' },
      { displayName: 'User ID', name: 'userId', type: 'string' as any, default: '', placeholder: '12345678' },
    ],
  },

  // Twitter Search - Search recent tweets
  twitterSearch: {
    displayName: 'Twitter Search',
    name: 'twitterSearch',
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Search Tweets',
    description: 'Search recent tweets on Twitter/X using the Search API',
    defaults: { name: 'Twitter Search', color: '#1DA1F2' },
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
    // Wave 8: schema lives on backend (TwitterSearchParams).
    properties: [
      { displayName: 'Search Query', name: 'query', type: 'string' as any, default: '', placeholder: '#AI lang:en -is:retweet' },
      { displayName: 'Start Time', name: 'startTime', type: 'string' as any, default: '', placeholder: '2024-01-01T00:00:00Z' },
      { displayName: 'End Time', name: 'endTime', type: 'string' as any, default: '', placeholder: '2024-01-31T23:59:59Z' },
    ],
  },

  // Twitter User - User lookup and profile operations (dual-purpose: workflow + AI tool)
  twitterUser: {
    displayName: 'Twitter User',
    name: 'twitterUser',
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'User Operations',
    description: 'Look up Twitter users, get profile info, followers, following',
    defaults: { name: 'Twitter User', color: '#1DA1F2' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'User lookup input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'User data'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent input-tools handle'
      }
    ],
    // Wave 8: schema lives on backend (TwitterUserParams).
    properties: [
      { displayName: 'Username', name: 'username', type: 'string' as any, default: '', placeholder: 'elonmusk' },
      { displayName: 'User ID', name: 'userId', type: 'string' as any, default: '', placeholder: '44196397' },
    ],
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export const TWITTER_NODE_TYPES = ['twitterSend', 'twitterReceive', 'twitterSearch', 'twitterUser'];
