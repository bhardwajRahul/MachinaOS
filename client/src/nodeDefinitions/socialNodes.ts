// Social Node Definitions - Unified social platform messaging
// Supports: WhatsApp, Telegram, Discord, Slack, Signal, SMS, Webchat, Email, Matrix, Teams
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// Wave 8: channel + message-type option lists now live in
// SocialReceiveParams / SocialSendParams Pydantic enums.
// Wave 10.B: node icons resolved from asset:<key> via assets/icons/social/.

// ============================================================================
// SOCIAL NODES
// ============================================================================

export const socialNodes: Record<string, INodeTypeDescription> = {
  // Social Receive - Normalizes and filters messages from platform-specific triggers
  socialReceive: {
    displayName: 'Social Receive',
    name: 'socialReceive',
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
