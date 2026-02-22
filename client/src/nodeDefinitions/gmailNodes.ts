// Gmail Node Definitions - Google Gmail API integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { GMAIL_ICON } from '../assets/icons/google';

// ============================================================================
// GMAIL NODES
// ============================================================================

export const gmailNodes: Record<string, INodeTypeDescription> = {
  // Gmail Send - Send emails
  gmailSend: {
    displayName: 'Gmail Send',
    name: 'gmailSend',
    icon: GMAIL_ICON,
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Send Email',
    description: 'Send emails via Gmail API',
    defaults: { name: 'Gmail Send', color: '#EA4335' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Email input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Send result (message_id, thread_id)'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      // ===== ACCOUNT MODE =====
      {
        displayName: 'Account',
        name: 'account_mode',
        type: 'options',
        options: [
          { name: 'Owner Account', value: 'owner' },
          { name: 'Customer Account', value: 'customer' }
        ],
        default: 'owner',
        description: 'Which Gmail account to use'
      },
      {
        displayName: 'Customer ID',
        name: 'customer_id',
        type: 'string',
        default: '',
        placeholder: 'customer_123 or {{input.customer_id}}',
        description: 'Customer identifier to look up their Gmail connection',
        displayOptions: {
          show: { account_mode: ['customer'] }
        }
      },

      // ===== RECIPIENTS =====
      {
        displayName: 'To',
        name: 'to',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'recipient@example.com, another@example.com',
        description: 'Recipient email addresses (comma-separated)'
      },
      {
        displayName: 'CC',
        name: 'cc',
        type: 'string',
        default: '',
        placeholder: 'cc@example.com',
        description: 'CC recipients (optional)'
      },
      {
        displayName: 'BCC',
        name: 'bcc',
        type: 'string',
        default: '',
        placeholder: 'bcc@example.com',
        description: 'BCC recipients (optional)'
      },

      // ===== CONTENT =====
      {
        displayName: 'Subject',
        name: 'subject',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Email subject line',
        description: 'Email subject'
      },
      {
        displayName: 'Body Type',
        name: 'body_type',
        type: 'options',
        options: [
          { name: 'Plain Text', value: 'text' },
          { name: 'HTML', value: 'html' }
        ],
        default: 'text',
        description: 'Email body format'
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 6 },
        placeholder: 'Email content...',
        description: 'Email body content'
      }
    ]
  },

  // Gmail Search - Search emails
  gmailSearch: {
    displayName: 'Gmail Search',
    name: 'gmailSearch',
    icon: GMAIL_ICON,
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Search Emails',
    description: 'Search emails using Gmail query syntax',
    defaults: { name: 'Gmail Search', color: '#EA4335' },
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
        description: 'Search results (messages array)'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      // ===== ACCOUNT MODE =====
      {
        displayName: 'Account',
        name: 'account_mode',
        type: 'options',
        options: [
          { name: 'Owner Account', value: 'owner' },
          { name: 'Customer Account', value: 'customer' }
        ],
        default: 'owner',
        description: 'Which Gmail account to use'
      },
      {
        displayName: 'Customer ID',
        name: 'customer_id',
        type: 'string',
        default: '',
        placeholder: 'customer_123 or {{input.customer_id}}',
        description: 'Customer identifier to look up their Gmail connection',
        displayOptions: {
          show: { account_mode: ['customer'] }
        }
      },

      // ===== SEARCH =====
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'from:someone@example.com subject:meeting',
        description: 'Gmail search query (same syntax as Gmail web)'
      },
      {
        displayName: 'Max Results',
        name: 'max_results',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Maximum number of messages to return'
      },
      {
        displayName: 'Include Body',
        name: 'include_body',
        type: 'boolean',
        default: false,
        description: 'Fetch full message body (slower but includes content)'
      }
    ]
  },

  // Gmail Read - Read a specific email
  gmailRead: {
    displayName: 'Gmail Read',
    name: 'gmailRead',
    icon: GMAIL_ICON,
    group: ['social', 'tool'],
    version: 1,
    subtitle: 'Read Email',
    description: 'Read a specific email by message ID',
    defaults: { name: 'Gmail Read', color: '#EA4335' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Message ID input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Email content (from, to, subject, body, attachments)'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      // ===== ACCOUNT MODE =====
      {
        displayName: 'Account',
        name: 'account_mode',
        type: 'options',
        options: [
          { name: 'Owner Account', value: 'owner' },
          { name: 'Customer Account', value: 'customer' }
        ],
        default: 'owner',
        description: 'Which Gmail account to use'
      },
      {
        displayName: 'Customer ID',
        name: 'customer_id',
        type: 'string',
        default: '',
        placeholder: 'customer_123 or {{input.customer_id}}',
        description: 'Customer identifier to look up their Gmail connection',
        displayOptions: {
          show: { account_mode: ['customer'] }
        }
      },

      // ===== MESSAGE =====
      {
        displayName: 'Message ID',
        name: 'message_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: '18d5a7e2c3b4f5a6',
        description: 'Gmail message ID to read'
      },
      {
        displayName: 'Format',
        name: 'format',
        type: 'options',
        options: [
          { name: 'Full (with body)', value: 'full' },
          { name: 'Metadata (headers only)', value: 'metadata' },
          { name: 'Minimal', value: 'minimal' },
          { name: 'Raw', value: 'raw' }
        ],
        default: 'full',
        description: 'Message format to retrieve'
      }
    ]
  },

  // Gmail Receive - Trigger on incoming emails (polling-based)
  gmailReceive: {
    displayName: 'Gmail Receive',
    name: 'gmailReceive',
    icon: GMAIL_ICON,
    group: ['social', 'trigger'],
    version: 1,
    subtitle: 'On New Email',
    description: 'Trigger workflow on new emails (polling-based)',
    defaults: { name: 'Gmail Receive', color: '#EA4335' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Email',
      type: 'main' as NodeConnectionType,
      description: 'Received email (message_id, from, to, subject, body, date, labels, attachments)'
    }],
    properties: [
      // ===== ACCOUNT MODE =====
      {
        displayName: 'Account',
        name: 'account_mode',
        type: 'options',
        options: [
          { name: 'Owner Account', value: 'owner' },
          { name: 'Customer Account', value: 'customer' }
        ],
        default: 'owner',
        description: 'Which Gmail account to monitor'
      },
      {
        displayName: 'Customer ID',
        name: 'customer_id',
        type: 'string',
        default: '',
        placeholder: 'customer_123',
        description: 'Customer identifier for their Gmail connection',
        displayOptions: {
          show: { account_mode: ['customer'] }
        }
      },

      // ===== FILTER =====
      {
        displayName: 'Filter Query',
        name: 'filter_query',
        type: 'string',
        default: 'is:unread',
        placeholder: 'from:important@company.com OR label:work',
        description: 'Gmail filter query (same as Gmail search)'
      },
      {
        displayName: 'Label Filter',
        name: 'label_filter',
        type: 'options',
        options: [
          { name: 'All Labels', value: 'all' },
          { name: 'Inbox Only', value: 'INBOX' },
          { name: 'Important', value: 'IMPORTANT' },
          { name: 'Starred', value: 'STARRED' },
          { name: 'Sent', value: 'SENT' },
          { name: 'Drafts', value: 'DRAFT' }
        ],
        default: 'INBOX',
        description: 'Filter by Gmail label'
      },
      {
        displayName: 'Mark as Read',
        name: 'mark_as_read',
        type: 'boolean',
        default: false,
        description: 'Automatically mark emails as read after processing'
      },

      // ===== POLLING =====
      {
        displayName: 'Poll Interval (seconds)',
        name: 'poll_interval',
        type: 'number',
        default: 60,
        typeOptions: { minValue: 30, maxValue: 3600 },
        description: 'How often to check for new emails (30s - 1 hour)'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const GMAIL_NODE_TYPES = ['gmailSend', 'gmailSearch', 'gmailRead', 'gmailReceive'];
