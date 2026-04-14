// Telegram Node Definitions - Messaging integration via python-telegram-bot
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// Wave 10.B: node icons resolved from asset:telegram via assets/icons/telegram/.
// TELEGRAM_LOGO_ICON retained as a data URI export because external consumers
// (credentials modal, skill editor) still read it directly.
export const TELEGRAM_LOGO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230088CC'%3E%3Cpath d='M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'/%3E%3C/svg%3E";

// ============================================================================
// TELEGRAM NODES
// ============================================================================

export const telegramNodes: Record<string, INodeTypeDescription> = {
  // Telegram Send Message Node - Send text, media, location, contact
  telegramSend: {
    displayName: 'Telegram Send',
    name: 'telegramSend',
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
    // Wave 8: schema lives on backend (TelegramSendParams).
    properties: [
      { displayName: 'Chat ID', name: 'chatId', type: 'string' as any, default: '', placeholder: '123456789 or @username' },
      { displayName: 'Message Text', name: 'text', type: 'string' as any, default: '', placeholder: 'Enter your message...' },
      { displayName: 'Media URL', name: 'mediaUrl', type: 'string' as any, default: '', placeholder: 'https://example.com/image.jpg' },
      { displayName: 'Phone Number', name: 'phone', type: 'string' as any, default: '', placeholder: '+1234567890' },
      { displayName: 'First Name', name: 'firstName', type: 'string' as any, default: '', placeholder: 'John' },
      { displayName: 'Last Name', name: 'lastName', type: 'string' as any, default: '', placeholder: 'Doe' },
    ],
  },

  // Telegram Receive Message - triggers workflow on incoming messages
  telegramReceive: {
    displayName: 'Telegram Receive',
    name: 'telegramReceive',
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
    // Wave 8: schema lives on backend (TelegramReceiveParams).
    properties: [
      { displayName: 'Chat ID', name: 'chatId', type: 'string' as any, default: '', placeholder: '123456789' },
      { displayName: 'User ID', name: 'fromUser', type: 'string' as any, default: '', placeholder: '987654321' },
      { displayName: 'Keywords', name: 'keywords', type: 'string' as any, default: '', placeholder: 'help, support, info' },
    ],
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export const TELEGRAM_NODE_TYPES = ['telegramSend', 'telegramReceive'];
