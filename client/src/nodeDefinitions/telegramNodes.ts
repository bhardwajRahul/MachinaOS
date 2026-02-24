// Telegram Node Definitions - Messaging integration via python-telegram-bot
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

// ============================================================================
// TELEGRAM ICONS (SVG Data URIs)
// ============================================================================

// Telegram Send - Paper plane (send message)
const TELEGRAM_SEND_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230088CC'%3E%3Cpath d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'/%3E%3C/svg%3E";

// Telegram Logo - Official Telegram logo (exported for use in credentials/skill nodes)
export const TELEGRAM_LOGO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230088CC'%3E%3Cpath d='M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'/%3E%3C/svg%3E";

// Telegram Receive - Notification bell with dot (trigger node)
const TELEGRAM_RECEIVE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230088CC'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z'/%3E%3Ccircle cx='18' cy='6' r='4'/%3E%3C/svg%3E";

// ============================================================================
// TELEGRAM NODES
// ============================================================================

export const telegramNodes: Record<string, INodeTypeDescription> = {
  // Telegram Send Message Node - Send text, media, location, contact
  telegramSend: {
    displayName: 'Telegram Send',
    name: 'telegramSend',
    icon: TELEGRAM_SEND_ICON,
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Send Telegram Message',
    description: 'Send text, photo, document, location, or contact messages via Telegram bot',
    defaults: { name: 'Telegram Send', color: '#0088CC' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Message input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Message output'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      // ===== RECIPIENT =====
      {
        displayName: 'Chat ID',
        name: 'chat_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: '123456789 or @username',
        description: 'Telegram chat ID (numeric) or @username'
      },

      // ===== MESSAGE TYPE =====
      {
        displayName: 'Message Type',
        name: 'message_type',
        type: 'options',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'Photo', value: 'photo' },
          { name: 'Document', value: 'document' },
          { name: 'Location', value: 'location' },
          { name: 'Contact', value: 'contact' }
        ],
        default: 'text',
        description: 'Type of message to send'
      },

      // ===== TEXT MESSAGE =====
      {
        displayName: 'Message Text',
        name: 'text',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 4 },
        description: 'Text message content',
        placeholder: 'Enter your message...',
        displayOptions: {
          show: { message_type: ['text'] }
        }
      },

      // ===== MEDIA MESSAGES (photo, document) =====
      {
        displayName: 'Media URL',
        name: 'media_url',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://example.com/image.jpg',
        description: 'URL of the media file or file_id from previous message',
        displayOptions: {
          show: { message_type: ['photo', 'document'] }
        }
      },
      {
        displayName: 'Caption',
        name: 'caption',
        type: 'string',
        default: '',
        typeOptions: { rows: 2 },
        description: 'Optional caption for media',
        displayOptions: {
          show: { message_type: ['photo', 'document'] }
        }
      },

      // ===== LOCATION MESSAGE =====
      {
        displayName: 'Latitude',
        name: 'latitude',
        type: 'number',
        default: 0,
        required: true,
        description: 'Location latitude (-90 to 90)',
        displayOptions: {
          show: { message_type: ['location'] }
        }
      },
      {
        displayName: 'Longitude',
        name: 'longitude',
        type: 'number',
        default: 0,
        required: true,
        description: 'Location longitude (-180 to 180)',
        displayOptions: {
          show: { message_type: ['location'] }
        }
      },

      // ===== CONTACT MESSAGE =====
      {
        displayName: 'Phone Number',
        name: 'phone_number',
        type: 'string',
        default: '',
        required: true,
        placeholder: '+1234567890',
        description: 'Contact phone number (with country code)',
        displayOptions: {
          show: { message_type: ['contact'] }
        }
      },
      {
        displayName: 'First Name',
        name: 'first_name',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'John',
        description: 'Contact first name',
        displayOptions: {
          show: { message_type: ['contact'] }
        }
      },
      {
        displayName: 'Last Name',
        name: 'last_name',
        type: 'string',
        default: '',
        placeholder: 'Doe',
        description: 'Contact last name (optional)',
        displayOptions: {
          show: { message_type: ['contact'] }
        }
      },

      // ===== OPTIONS =====
      {
        displayName: 'Parse Mode',
        name: 'parse_mode',
        type: 'options',
        options: [
          { name: 'None', value: '' },
          { name: 'HTML', value: 'HTML' },
          { name: 'Markdown', value: 'Markdown' },
          { name: 'MarkdownV2', value: 'MarkdownV2' }
        ],
        default: '',
        description: 'Text formatting mode',
        displayOptions: {
          show: { message_type: ['text', 'photo', 'document'] }
        }
      },
      {
        displayName: 'Silent',
        name: 'silent',
        type: 'boolean',
        default: false,
        description: 'Send message without notification sound'
      },
      {
        displayName: 'Reply To Message ID',
        name: 'reply_to_message_id',
        type: 'number',
        default: 0,
        description: 'If set, sends the message as a reply to this message ID'
      }
    ]
  },

  // Telegram Receive Message - triggers workflow on incoming messages
  telegramReceive: {
    displayName: 'Telegram Receive',
    name: 'telegramReceive',
    icon: TELEGRAM_RECEIVE_ICON,
    group: ['social', 'trigger'],
    version: 1,
    subtitle: 'On Message Received',
    description: 'Trigger workflow when Telegram message is received. Outputs message data including sender, content, and metadata.',
    defaults: { name: 'Telegram Receive', color: '#0077B5' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Message',
      type: 'main' as NodeConnectionType,
      description: 'Received message data (message_id, chat_id, chat_type, from_id, from_username, text, content_type, date)'
    }],
    properties: [
      // ===== CHAT TYPE FILTER =====
      {
        displayName: 'Chat Type',
        name: 'chatTypeFilter',
        type: 'options',
        options: [
          { name: 'All Types', value: 'all' },
          { name: 'Private Only', value: 'private' },
          { name: 'Group Only', value: 'group' },
          { name: 'Supergroup Only', value: 'supergroup' },
          { name: 'Channel Only', value: 'channel' }
        ],
        default: 'all',
        description: 'Filter by chat type'
      },

      // ===== CONTENT TYPE FILTER =====
      {
        displayName: 'Content Type',
        name: 'contentTypeFilter',
        type: 'options',
        options: [
          { name: 'All Types', value: 'all' },
          { name: 'Text Only', value: 'text' },
          { name: 'Photo Only', value: 'photo' },
          { name: 'Video Only', value: 'video' },
          { name: 'Audio Only', value: 'audio' },
          { name: 'Voice Only', value: 'voice' },
          { name: 'Document Only', value: 'document' },
          { name: 'Sticker Only', value: 'sticker' },
          { name: 'Location Only', value: 'location' },
          { name: 'Contact Only', value: 'contact' },
          { name: 'Poll Only', value: 'poll' }
        ],
        default: 'all',
        description: 'Filter by message content type'
      },

      // ===== SPECIFIC FILTERS =====
      {
        displayName: 'Chat ID Filter',
        name: 'chat_id',
        type: 'string',
        default: '',
        placeholder: '123456789',
        description: 'Only trigger for messages from this specific chat (leave empty for all chats)'
      },
      {
        displayName: 'From User ID Filter',
        name: 'from_user',
        type: 'string',
        default: '',
        placeholder: '987654321',
        description: 'Only trigger for messages from this specific user ID (leave empty for all users)'
      },
      {
        displayName: 'Keywords',
        name: 'keywords',
        type: 'string',
        default: '',
        placeholder: 'help, support, info',
        description: 'Comma-separated keywords to trigger on (case-insensitive, leave empty to trigger on all)'
      },

      // ===== OPTIONS =====
      {
        displayName: 'Ignore Bot Messages',
        name: 'ignoreBots',
        type: 'boolean',
        default: true,
        description: 'Do not trigger on messages from other bots'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const TELEGRAM_NODE_TYPES = ['telegramSend', 'telegramReceive'];
