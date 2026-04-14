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

// Wave 8: channel + message-type option lists now live in
// SocialReceiveParams / SocialSendParams Pydantic enums.

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
    // Wave 8: schema lives on backend (SocialReceiveParams).
    properties: [
      { displayName: 'Contact Phone', name: 'contactPhone', type: 'string' as any, default: '', placeholder: '1234567890' },
      { displayName: 'Group ID', name: 'groupId', type: 'string' as any, default: '', placeholder: '123456789@g.us' },
      { displayName: 'Keywords', name: 'keywords', type: 'string' as any, default: '', placeholder: 'help, support, info' },
    ],
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
    // Wave 8: schema lives on backend (SocialSendParams).
    properties: [
      { displayName: 'Phone Number', name: 'phone', type: 'string' as any, default: '', placeholder: '1234567890' },
      { displayName: 'Group ID', name: 'groupId', type: 'string' as any, default: '', placeholder: '123456789@g.us' },
      { displayName: 'Channel ID', name: 'channelId', type: 'string' as any, default: '', placeholder: 'C01234567' },
      { displayName: 'User ID', name: 'userId', type: 'string' as any, default: '', placeholder: 'U01234567' },
      { displayName: 'Chat ID', name: 'chatId', type: 'string' as any, default: '', placeholder: 'chat_123456' },
      { displayName: 'Thread ID', name: 'threadId', type: 'string' as any, default: '', placeholder: 'thread_123' },
      { displayName: 'Message', name: 'message', type: 'string' as any, default: '', placeholder: 'Enter your message...' },
      { displayName: 'Media URL', name: 'mediaUrl', type: 'string' as any, default: '', placeholder: 'https://example.com/image.jpg' },
    ],
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const SOCIAL_NODE_TYPES = ['socialReceive', 'socialSend'];
