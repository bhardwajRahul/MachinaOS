// Twitter/X Node Definitions - X API v2 integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

// ============================================================================
// TWITTER ICONS (SVG Data URIs) - X Brand black color
// ============================================================================

// Twitter/X Logo - Official X logo (white fill for dark backgrounds)
export const TWITTER_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FFFFFF'%3E%3Cpath d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'/%3E%3C/svg%3E";

// All Twitter nodes use the X logo
const TWITTER_SEND_ICON = TWITTER_ICON;
const TWITTER_RECEIVE_ICON = TWITTER_ICON;
const TWITTER_SEARCH_ICON = TWITTER_ICON;
const TWITTER_USER_ICON = TWITTER_ICON;

// ============================================================================
// TWITTER NODES
// ============================================================================

export const twitterNodes: Record<string, INodeTypeDescription> = {
  // Twitter Send - Post tweets, reply, retweet, like
  twitterSend: {
    displayName: 'Twitter Send',
    name: 'twitterSend',
    icon: TWITTER_SEND_ICON,
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
    properties: [
      // ===== ACTION =====
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        options: [
          { name: 'Post Tweet', value: 'tweet' },
          { name: 'Reply to Tweet', value: 'reply' },
          { name: 'Retweet', value: 'retweet' },
          { name: 'Quote Tweet', value: 'quote' },
          { name: 'Like Tweet', value: 'like' },
          { name: 'Unlike Tweet', value: 'unlike' },
          { name: 'Delete Tweet', value: 'delete' }
        ],
        default: 'tweet',
        description: 'Action to perform on Twitter'
      },

      // ===== TWEET TEXT (for tweet, reply, quote) =====
      {
        displayName: 'Tweet Text',
        name: 'text',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 4 },
        description: 'Tweet content (max 280 characters)',
        placeholder: "What's happening?",
        displayOptions: {
          show: { action: ['tweet', 'reply', 'quote'] }
        }
      },

      // ===== TWEET ID (for reply, retweet, quote, like, unlike, delete) =====
      {
        displayName: 'Tweet ID',
        name: 'tweet_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1234567890123456789',
        description: 'ID of the tweet to interact with',
        displayOptions: {
          show: { action: ['reply', 'retweet', 'quote', 'like', 'unlike', 'delete'] }
        }
      },

      // ===== MEDIA (for tweet, reply, quote) =====
      {
        displayName: 'Include Media',
        name: 'include_media',
        type: 'boolean',
        default: false,
        description: 'Attach images or videos to the tweet',
        displayOptions: {
          show: { action: ['tweet', 'reply', 'quote'] }
        }
      },
      {
        displayName: 'Media URLs',
        name: 'media_urls',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/image1.jpg, https://example.com/image2.jpg',
        description: 'Comma-separated URLs of media to attach (max 4 images or 1 video)',
        displayOptions: {
          show: { action: ['tweet', 'reply', 'quote'], include_media: [true] }
        }
      },

      // ===== POLL (for tweet) =====
      {
        displayName: 'Include Poll',
        name: 'include_poll',
        type: 'boolean',
        default: false,
        description: 'Create a poll with this tweet',
        displayOptions: {
          show: { action: ['tweet'] }
        }
      },
      {
        displayName: 'Poll Options',
        name: 'poll_options',
        type: 'string',
        default: '',
        placeholder: 'Option 1, Option 2, Option 3',
        description: 'Comma-separated poll options (2-4 options, max 25 chars each)',
        displayOptions: {
          show: { action: ['tweet'], include_poll: [true] }
        }
      },
      {
        displayName: 'Poll Duration (minutes)',
        name: 'poll_duration',
        type: 'number',
        default: 1440,
        typeOptions: { minValue: 5, maxValue: 10080 },
        description: 'Poll duration in minutes (5 min - 7 days)',
        displayOptions: {
          show: { action: ['tweet'], include_poll: [true] }
        }
      }
    ]
  },

  // Twitter Receive - Trigger on mentions, searches, timeline updates
  twitterReceive: {
    displayName: 'Twitter Receive',
    name: 'twitterReceive',
    icon: TWITTER_RECEIVE_ICON,
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
    properties: [
      // ===== TRIGGER TYPE =====
      {
        displayName: 'Trigger On',
        name: 'trigger_type',
        type: 'options',
        options: [
          { name: 'Mentions', value: 'mentions' },
          { name: 'Search Results', value: 'search' },
          { name: 'User Timeline', value: 'timeline' }
        ],
        default: 'mentions',
        description: 'What events should trigger this workflow'
      },

      // ===== SEARCH QUERY (for search trigger) =====
      {
        displayName: 'Search Query',
        name: 'search_query',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'from:elonmusk OR #AI',
        description: 'Twitter search query (supports operators like from:, to:, #, -)',
        displayOptions: {
          show: { trigger_type: ['search'] }
        }
      },

      // ===== USER ID (for timeline trigger) =====
      {
        displayName: 'User ID',
        name: 'user_id',
        type: 'string',
        default: '',
        placeholder: '12345678',
        description: 'Twitter user ID to monitor (leave empty for authenticated user)',
        displayOptions: {
          show: { trigger_type: ['timeline'] }
        }
      },

      // ===== OPTIONS =====
      {
        displayName: 'Filter Retweets',
        name: 'filter_retweets',
        type: 'boolean',
        default: true,
        description: 'Exclude retweets from results'
      },
      {
        displayName: 'Filter Replies',
        name: 'filter_replies',
        type: 'boolean',
        default: false,
        description: 'Exclude replies from results'
      },
      {
        displayName: 'Poll Interval (seconds)',
        name: 'poll_interval',
        type: 'number',
        default: 60,
        typeOptions: { minValue: 15, maxValue: 3600 },
        description: 'How often to check for new tweets (15s - 1 hour)'
      }
    ]
  },

  // Twitter Search - Search recent tweets
  twitterSearch: {
    displayName: 'Twitter Search',
    name: 'twitterSearch',
    icon: TWITTER_SEARCH_ICON,
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
    properties: [
      // ===== SEARCH QUERY =====
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        placeholder: '#AI lang:en -is:retweet',
        description: 'Twitter search query with operators'
      },

      // ===== RESULT OPTIONS =====
      {
        displayName: 'Max Results',
        name: 'max_results',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 10, maxValue: 100 },
        description: 'Maximum number of tweets to return (10-100)'
      },
      {
        displayName: 'Sort Order',
        name: 'sort_order',
        type: 'options',
        options: [
          { name: 'Recent', value: 'recency' },
          { name: 'Relevance', value: 'relevancy' }
        ],
        default: 'recency',
        description: 'Sort order for results'
      },

      // ===== TIME FILTERS =====
      {
        displayName: 'Start Time',
        name: 'start_time',
        type: 'string',
        default: '',
        placeholder: '2024-01-01T00:00:00Z',
        description: 'Start time for search (ISO 8601 format, optional)'
      },
      {
        displayName: 'End Time',
        name: 'end_time',
        type: 'string',
        default: '',
        placeholder: '2024-01-31T23:59:59Z',
        description: 'End time for search (ISO 8601 format, optional)'
      },

      // ===== INCLUDE OPTIONS =====
      {
        displayName: 'Include Metrics',
        name: 'include_metrics',
        type: 'boolean',
        default: true,
        description: 'Include tweet engagement metrics (likes, retweets, replies)'
      },
      {
        displayName: 'Include Author Info',
        name: 'include_author',
        type: 'boolean',
        default: true,
        description: 'Include author details (username, name, profile)'
      }
    ]
  },

  // Twitter User - User lookup and profile operations (dual-purpose: workflow + AI tool)
  twitterUser: {
    displayName: 'Twitter User',
    name: 'twitterUser',
    icon: TWITTER_USER_ICON,
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
    properties: [
      // ===== OPERATION =====
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          { name: 'Get My Profile', value: 'me' },
          { name: 'Lookup by Username', value: 'by_username' },
          { name: 'Lookup by ID', value: 'by_id' },
          { name: 'Get Followers', value: 'followers' },
          { name: 'Get Following', value: 'following' }
        ],
        default: 'me',
        description: 'User operation to perform'
      },

      // ===== USERNAME (for by_username) =====
      {
        displayName: 'Username',
        name: 'username',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'elonmusk',
        description: 'Twitter username (without @)',
        displayOptions: {
          show: { operation: ['by_username'] }
        }
      },

      // ===== USER ID (for by_id, followers, following) =====
      {
        displayName: 'User ID',
        name: 'user_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: '44196397',
        description: 'Twitter user ID',
        displayOptions: {
          show: { operation: ['by_id', 'followers', 'following'] }
        }
      },

      // ===== PAGINATION (for followers, following) =====
      {
        displayName: 'Max Results',
        name: 'max_results',
        type: 'number',
        default: 100,
        typeOptions: { minValue: 1, maxValue: 1000 },
        description: 'Maximum number of users to return',
        displayOptions: {
          show: { operation: ['followers', 'following'] }
        }
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const TWITTER_NODE_TYPES = ['twitterSend', 'twitterReceive', 'twitterSearch', 'twitterUser'];
