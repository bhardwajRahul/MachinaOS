// Social Node Definitions - Unified social platform messaging
// Supports: WhatsApp, Telegram, Discord, Slack, Signal, SMS, Webchat, Email, Matrix, Teams
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

// ============================================================================
// SOCIAL ICONS (SVG Data URIs)
// ============================================================================

// Social Receive - Funnel/filter icon (normalizes messages from platform triggers)
const SOCIAL_RECEIVE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366F1'%3E%3Cpath d='M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.73-4.8 5.75-7.39C20.26 4.95 19.79 4 18.95 4H5.04c-.83 0-1.31.95-.79 1.61z'/%3E%3C/svg%3E";

// Social Send - Paper plane with globe (multi-platform send)
const SOCIAL_SEND_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366F1'%3E%3Cpath d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'/%3E%3Ccircle cx='18' cy='18' r='4' fill='%236366F1' stroke='%23fff' stroke-width='1'/%3E%3Cpath d='M18 15.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5zm0 1c.28 0 .5.22.5.5v1h1c.28 0 .5.22.5.5s-.22.5-.5.5h-1v1c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-1h-1c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h1v-1c0-.28.22-.5.5-.5z' fill='%23fff'/%3E%3C/svg%3E";

// ============================================================================
// CHANNEL OPTIONS - All supported platforms
// ============================================================================
const CHANNEL_OPTIONS = [
  { name: 'All Channels', value: 'all' },
  { name: 'WhatsApp', value: 'whatsapp' },
  { name: 'Telegram', value: 'telegram' },
  { name: 'Discord', value: 'discord' },
  { name: 'Slack', value: 'slack' },
  { name: 'Signal', value: 'signal' },
  { name: 'SMS', value: 'sms' },
  { name: 'Webchat', value: 'webchat' },
  { name: 'Email', value: 'email' },
  { name: 'Matrix', value: 'matrix' },
  { name: 'Teams', value: 'teams' }
];

// For send node (no "All Channels" option)
const SEND_CHANNEL_OPTIONS = CHANNEL_OPTIONS.filter(opt => opt.value !== 'all');

// ============================================================================
// MESSAGE TYPE OPTIONS
// ============================================================================
const MESSAGE_TYPE_OPTIONS = [
  { name: 'All Types', value: 'all' },
  { name: 'Text', value: 'text' },
  { name: 'Image', value: 'image' },
  { name: 'Video', value: 'video' },
  { name: 'Audio', value: 'audio' },
  { name: 'Document', value: 'document' },
  { name: 'Sticker', value: 'sticker' },
  { name: 'Location', value: 'location' },
  { name: 'Contact', value: 'contact' },
  { name: 'Poll', value: 'poll' },
  { name: 'Reaction', value: 'reaction' }
];

// For send node (no "All Types" option, plus buttons/list)
const SEND_MESSAGE_TYPE_OPTIONS = [
  { name: 'Text', value: 'text' },
  { name: 'Image', value: 'image' },
  { name: 'Video', value: 'video' },
  { name: 'Audio', value: 'audio' },
  { name: 'Document', value: 'document' },
  { name: 'Sticker', value: 'sticker' },
  { name: 'Location', value: 'location' },
  { name: 'Contact', value: 'contact' },
  { name: 'Poll', value: 'poll' },
  { name: 'Buttons', value: 'buttons' },
  { name: 'List', value: 'list' }
];

// ============================================================================
// SOCIAL NODES
// ============================================================================

export const socialNodes: Record<string, INodeTypeDescription> = {
  // Social Receive - Normalizes and filters messages from platform-specific triggers
  socialReceive: {
    displayName: 'Social Receive',
    name: 'socialReceive',
    icon: SOCIAL_RECEIVE_ICON,
    group: ['social'],
    version: 1,
    subtitle: 'Normalize Message',
    description: 'Connects to platform-specific triggers (WhatsApp Receive, etc.) and normalizes messages into unified format. Filters by channel, message type, and sender.',
    defaults: { name: 'Social Receive', color: '#6366F1' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Connect to platform trigger (WhatsApp Receive, Telegram, etc.)'
    }],
    outputs: [
      {
        name: 'message',
        displayName: 'Message',
        type: 'main' as NodeConnectionType,
        description: 'Text message content for LLM input'
      },
      {
        name: 'media',
        displayName: 'Media',
        type: 'main' as NodeConnectionType,
        description: 'Media data: url, type, mimetype, caption, size, thumbnail, filename'
      },
      {
        name: 'contact',
        displayName: 'Contact',
        type: 'main' as NodeConnectionType,
        description: 'Sender info: sender, sender_phone, sender_name, channel, is_group, group_info'
      },
      {
        name: 'metadata',
        displayName: 'Metadata',
        type: 'main' as NodeConnectionType,
        description: 'Message metadata: message_id, chat_id, timestamp, is_forwarded, is_from_me, reply_to'
      }
    ],
    properties: [
      // ===== CHANNEL FILTER =====
      {
        displayName: 'Channel Filter',
        name: 'channelFilter',
        type: 'options',
        options: CHANNEL_OPTIONS,
        default: 'all',
        description: 'Filter messages by source platform'
      },

      // ===== MESSAGE TYPE FILTER =====
      {
        displayName: 'Message Type',
        name: 'messageTypeFilter',
        type: 'options',
        options: MESSAGE_TYPE_OPTIONS,
        default: 'all',
        description: 'Filter by message content type'
      },

      // ===== SENDER FILTER =====
      {
        displayName: 'Sender Filter',
        name: 'senderFilter',
        type: 'options',
        options: [
          { name: 'All Messages', value: 'all' },
          { name: 'From Any Contact (Non-Group)', value: 'any_contact' },
          { name: 'From Specific Contact', value: 'contact' },
          { name: 'From Specific Group', value: 'group' },
          { name: 'Contains Keywords', value: 'keywords' }
        ],
        default: 'all',
        description: 'Filter which messages trigger the workflow'
      },
      {
        displayName: 'Contact Phone',
        name: 'contactPhone',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { senderFilter: ['contact'] }
        },
        placeholder: '1234567890',
        description: 'Phone number to filter messages from (without + prefix)'
      },
      {
        displayName: 'Group ID',
        name: 'groupId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { senderFilter: ['group'] }
        },
        placeholder: '123456789@g.us',
        description: 'Group identifier to filter messages from'
      },
      {
        displayName: 'Keywords',
        name: 'keywords',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { senderFilter: ['keywords'] }
        },
        placeholder: 'help, support, info',
        description: 'Comma-separated keywords to trigger on (case-insensitive)'
      },

      // ===== OPTIONS =====
      {
        displayName: 'Ignore Own Messages',
        name: 'ignoreOwnMessages',
        type: 'boolean',
        default: true,
        description: 'Do not trigger on messages sent by this device'
      },
      {
        displayName: 'Ignore Bots',
        name: 'ignoreBots',
        type: 'boolean',
        default: false,
        description: 'Do not trigger on messages from bots'
      },
      {
        displayName: 'Include Media Data',
        name: 'includeMediaData',
        type: 'boolean',
        default: false,
        description: 'Include base64 media data in output (increases memory usage)'
      }
    ]
  },

  // Social Send - Unified outbound message (dual-purpose: workflow + AI tool)
  socialSend: {
    displayName: 'Social Send',
    name: 'socialSend',
    icon: SOCIAL_SEND_ICON,
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Send Message',
    description: 'Send messages to any supported chat platform (WhatsApp, Telegram, Discord, Slack, Signal, SMS, Webchat, Email, Matrix, Teams). Works as workflow node or AI Agent tool.',
    defaults: { name: 'Social Send', color: '#6366F1' },
    inputs: [
      {
        name: 'main',
        displayName: 'Input',
        type: 'main' as NodeConnectionType,
        description: 'Main message input'
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'main' as NodeConnectionType,
        description: 'Text message content from Social Receive'
      },
      {
        name: 'media',
        displayName: 'Media',
        type: 'main' as NodeConnectionType,
        description: 'Media data: url, type, mimetype, caption, size, thumbnail, filename'
      },
      {
        name: 'contact',
        displayName: 'Contact',
        type: 'main' as NodeConnectionType,
        description: 'Sender info: sender, sender_phone, sender_name, channel, is_group, group_info'
      },
      {
        name: 'metadata',
        displayName: 'Metadata',
        type: 'main' as NodeConnectionType,
        description: 'Message metadata: message_id, chat_id, timestamp, for reply functionality'
      }
    ],
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
      // ===== CHANNEL SELECTION =====
      {
        displayName: 'Channel',
        name: 'channel',
        type: 'options',
        options: SEND_CHANNEL_OPTIONS,
        default: 'whatsapp',
        description: 'Target chat platform'
      },

      // ===== RECIPIENT =====
      {
        displayName: 'Send To',
        name: 'recipientType',
        type: 'options',
        options: [
          { name: 'Phone Number', value: 'phone' },
          { name: 'Group', value: 'group' },
          { name: 'Channel', value: 'channel' },
          { name: 'User ID', value: 'user' },
          { name: 'Chat ID', value: 'chat' }
        ],
        default: 'phone',
        description: 'Type of recipient'
      },
      {
        displayName: 'Phone Number',
        name: 'phone',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1234567890',
        description: 'Recipient phone number (without + prefix)',
        displayOptions: {
          show: { recipientType: ['phone'] }
        }
      },
      {
        displayName: 'Group ID',
        name: 'groupId',
        type: 'string',
        default: '',
        required: true,
        placeholder: '123456789@g.us',
        description: 'Group identifier',
        displayOptions: {
          show: { recipientType: ['group'] }
        }
      },
      {
        displayName: 'Channel ID',
        name: 'channelId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'C01234567',
        description: 'Channel identifier',
        displayOptions: {
          show: { recipientType: ['channel'] }
        }
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'U01234567',
        description: 'User identifier',
        displayOptions: {
          show: { recipientType: ['user'] }
        }
      },
      {
        displayName: 'Chat ID',
        name: 'chatId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'chat_123456',
        description: 'Generic chat identifier',
        displayOptions: {
          show: { recipientType: ['chat'] }
        }
      },
      {
        displayName: 'Thread ID',
        name: 'threadId',
        type: 'string',
        default: '',
        placeholder: 'thread_123',
        description: 'Thread to reply in (optional)'
      },

      // ===== MESSAGE TYPE =====
      {
        displayName: 'Message Type',
        name: 'messageType',
        type: 'options',
        options: SEND_MESSAGE_TYPE_OPTIONS,
        default: 'text',
        description: 'Type of message to send'
      },

      // ===== TEXT MESSAGE =====
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 4 },
        description: 'Text message content',
        placeholder: 'Enter your message...',
        displayOptions: {
          show: { messageType: ['text'] }
        }
      },
      {
        displayName: 'Format',
        name: 'format',
        type: 'options',
        options: [
          { name: 'Plain Text', value: 'plain' },
          { name: 'Markdown', value: 'markdown' },
          { name: 'HTML', value: 'html' }
        ],
        default: 'plain',
        description: 'Text formatting',
        displayOptions: {
          show: { messageType: ['text'] }
        }
      },

      // ===== MEDIA MESSAGES (image, video, audio, document, sticker) =====
      {
        displayName: 'Media Source',
        name: 'mediaSource',
        type: 'options',
        options: [
          { name: 'URL', value: 'url' },
          { name: 'Base64 Data', value: 'base64' },
          { name: 'File Path', value: 'file' }
        ],
        default: 'url',
        description: 'Source of media data',
        displayOptions: {
          show: { messageType: ['image', 'video', 'audio', 'document', 'sticker'] }
        }
      },
      {
        displayName: 'Media URL',
        name: 'mediaUrl',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://example.com/image.jpg',
        description: 'URL to download media from',
        displayOptions: {
          show: { messageType: ['image', 'video', 'audio', 'document', 'sticker'], mediaSource: ['url'] }
        }
      },
      {
        displayName: 'Media Data (Base64)',
        name: 'mediaData',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 3 },
        description: 'Base64-encoded media data',
        displayOptions: {
          show: { messageType: ['image', 'video', 'audio', 'document', 'sticker'], mediaSource: ['base64'] }
        }
      },
      {
        displayName: 'File Path',
        name: 'filePath',
        type: 'string',
        default: '',
        required: true,
        placeholder: '/path/to/file.jpg',
        description: 'Server file path',
        displayOptions: {
          show: { messageType: ['image', 'video', 'audio', 'document', 'sticker'], mediaSource: ['file'] }
        }
      },
      {
        displayName: 'MIME Type',
        name: 'mimeType',
        type: 'string',
        default: '',
        placeholder: 'image/jpeg, video/mp4, audio/ogg',
        description: 'MIME type of the media (auto-detected if empty)',
        displayOptions: {
          show: { messageType: ['image', 'video', 'audio', 'document', 'sticker'] }
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
          show: { messageType: ['image', 'video', 'document'] }
        }
      },
      {
        displayName: 'Filename',
        name: 'filename',
        type: 'string',
        default: '',
        placeholder: 'document.pdf',
        description: 'Filename for document',
        displayOptions: {
          show: { messageType: ['document'] }
        }
      },

      // ===== LOCATION MESSAGE =====
      {
        displayName: 'Latitude',
        name: 'latitude',
        type: 'number',
        default: 0,
        required: true,
        description: 'Location latitude',
        displayOptions: {
          show: { messageType: ['location'] }
        }
      },
      {
        displayName: 'Longitude',
        name: 'longitude',
        type: 'number',
        default: 0,
        required: true,
        description: 'Location longitude',
        displayOptions: {
          show: { messageType: ['location'] }
        }
      },
      {
        displayName: 'Location Name',
        name: 'locationName',
        type: 'string',
        default: '',
        placeholder: 'San Francisco',
        description: 'Display name for location',
        displayOptions: {
          show: { messageType: ['location'] }
        }
      },
      {
        displayName: 'Address',
        name: 'address',
        type: 'string',
        default: '',
        placeholder: 'California, USA',
        description: 'Address text',
        displayOptions: {
          show: { messageType: ['location'] }
        }
      },

      // ===== CONTACT MESSAGE =====
      {
        displayName: 'Contact Name',
        name: 'contactName',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'John Doe',
        description: 'Display name for contact',
        displayOptions: {
          show: { messageType: ['contact'] }
        }
      },
      {
        displayName: 'Contact Phone',
        name: 'contactPhone',
        type: 'string',
        default: '',
        placeholder: '+1234567890',
        description: 'Contact phone number',
        displayOptions: {
          show: { messageType: ['contact'] }
        }
      },
      {
        displayName: 'Contact vCard',
        name: 'vcard',
        type: 'string',
        default: '',
        typeOptions: { rows: 4 },
        placeholder: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL:+1234567890\nEND:VCARD',
        description: 'vCard 3.0 format string (optional if phone provided)',
        displayOptions: {
          show: { messageType: ['contact'] }
        }
      },

      // ===== POLL MESSAGE =====
      {
        displayName: 'Poll Question',
        name: 'pollQuestion',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'What is your favorite color?',
        description: 'Poll question',
        displayOptions: {
          show: { messageType: ['poll'] }
        }
      },
      {
        displayName: 'Poll Options',
        name: 'pollOptions',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Red, Blue, Green, Yellow',
        description: 'Comma-separated poll options',
        displayOptions: {
          show: { messageType: ['poll'] }
        }
      },
      {
        displayName: 'Allow Multiple',
        name: 'pollAllowMultiple',
        type: 'boolean',
        default: false,
        description: 'Allow multiple selections',
        displayOptions: {
          show: { messageType: ['poll'] }
        }
      },

      // ===== BUTTONS MESSAGE =====
      {
        displayName: 'Button Text',
        name: 'buttonText',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Choose an option',
        description: 'Text displayed above buttons',
        displayOptions: {
          show: { messageType: ['buttons'] }
        }
      },
      {
        displayName: 'Buttons (JSON)',
        name: 'buttons',
        type: 'string',
        default: '[]',
        required: true,
        typeOptions: { rows: 4 },
        placeholder: '[{"id": "btn1", "text": "Option 1"}, {"id": "btn2", "text": "Option 2"}]',
        description: 'JSON array of button objects with id and text',
        displayOptions: {
          show: { messageType: ['buttons'] }
        }
      },

      // ===== LIST MESSAGE =====
      {
        displayName: 'List Title',
        name: 'listTitle',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Select an option',
        description: 'Title for the list',
        displayOptions: {
          show: { messageType: ['list'] }
        }
      },
      {
        displayName: 'Button Text',
        name: 'listButtonText',
        type: 'string',
        default: 'View Options',
        required: true,
        description: 'Text for the list button',
        displayOptions: {
          show: { messageType: ['list'] }
        }
      },
      {
        displayName: 'List Sections (JSON)',
        name: 'listSections',
        type: 'string',
        default: '[]',
        required: true,
        typeOptions: { rows: 6 },
        placeholder: '[{"title": "Section 1", "rows": [{"id": "row1", "title": "Row 1", "description": "Description"}]}]',
        description: 'JSON array of sections with rows',
        displayOptions: {
          show: { messageType: ['list'] }
        }
      },

      // ===== REPLY (QUOTE) =====
      {
        displayName: 'Reply To Message',
        name: 'replyToMessage',
        type: 'boolean',
        default: false,
        description: 'Quote an existing message'
      },
      {
        displayName: 'Reply Message ID',
        name: 'replyMessageId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'ABC123DEF456',
        description: 'ID of message to reply to',
        displayOptions: {
          show: { replyToMessage: [true] }
        }
      },
      {
        displayName: 'Reply To Current',
        name: 'replyToCurrent',
        type: 'boolean',
        default: false,
        description: 'Reply to the message that triggered this workflow',
        displayOptions: {
          show: { replyToMessage: [true] }
        }
      },

      // ===== SEND OPTIONS =====
      {
        displayName: 'Send as Voice Note',
        name: 'audioAsVoice',
        type: 'boolean',
        default: false,
        description: 'Send audio as voice message',
        displayOptions: {
          show: { messageType: ['audio'] }
        }
      },
      {
        displayName: 'Disable Link Preview',
        name: 'disablePreview',
        type: 'boolean',
        default: false,
        description: 'Disable link preview in text messages',
        displayOptions: {
          show: { messageType: ['text'] }
        }
      },
      {
        displayName: 'Silent',
        name: 'silent',
        type: 'boolean',
        default: false,
        description: 'Send without notification sound'
      },
      {
        displayName: 'Protect Content',
        name: 'protectContent',
        type: 'boolean',
        default: false,
        description: 'Prevent forwarding/saving (if supported)'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const SOCIAL_NODE_TYPES = ['socialReceive', 'socialSend'];
