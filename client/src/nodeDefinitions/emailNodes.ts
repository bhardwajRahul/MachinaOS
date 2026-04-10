// Email Node Definitions - IMAP/SMTP integration via Himalaya CLI
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { solarized } from '../styles/theme';
import { EMAIL_SEND_ICON, EMAIL_READ_ICON, EMAIL_RECEIVE_ICON } from '../assets/icons/email';

// ============================================================================
// SHARED OPTIONS
// ============================================================================

// Provider presets (mirrors server/config/email_providers.json)
const PROVIDER_OPTIONS = [
  { name: 'Gmail', value: 'gmail' },
  { name: 'Outlook / Office 365', value: 'outlook' },
  { name: 'Yahoo Mail', value: 'yahoo' },
  { name: 'iCloud Mail', value: 'icloud' },
  { name: 'ProtonMail (Bridge)', value: 'protonmail' },
  { name: 'Fastmail', value: 'fastmail' },
  { name: 'Custom / Self-hosted', value: 'custom' },
];

const PROVIDER_PROPERTY = {
  displayName: 'Provider', name: 'provider', type: 'options' as const,
  options: PROVIDER_OPTIONS, default: 'gmail', description: 'Email provider',
};

// ============================================================================
// EMAIL NODES
// ============================================================================

export const emailNodes: Record<string, INodeTypeDescription> = {

  emailSend: {
    displayName: 'Email Send',
    name: 'emailSend',
    icon: EMAIL_SEND_ICON,
    group: ['email', 'tool'],
    version: 1,
    subtitle: 'Send Email via SMTP',
    description: 'Send email via Himalaya SMTP. Supports Gmail, Outlook, Yahoo, iCloud, ProtonMail, Fastmail, or custom.',
    defaults: { name: 'Email Send', color: solarized.blue },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' }],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Send result' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    properties: [
      PROVIDER_PROPERTY,
      { displayName: 'To', name: 'to', type: 'string', default: '', required: true, placeholder: 'recipient@example.com', description: 'Recipients (comma-separated)' },
      { displayName: 'Subject', name: 'subject', type: 'string', default: '', required: true, placeholder: 'Email subject' },
      { displayName: 'Body', name: 'body', type: 'string', default: '', required: true, typeOptions: { rows: 6 }, placeholder: 'Email body...' },
      { displayName: 'CC', name: 'cc', type: 'string', default: '', placeholder: 'cc@example.com' },
      { displayName: 'BCC', name: 'bcc', type: 'string', default: '', placeholder: 'bcc@example.com' },
      { displayName: 'Body Type', name: 'body_type', type: 'options', options: [{ name: 'Plain Text', value: 'text' }, { name: 'HTML', value: 'html' }], default: 'text' },
    ],
  },

  emailRead: {
    displayName: 'Email Read',
    name: 'emailRead',
    icon: EMAIL_READ_ICON,
    group: ['email', 'tool'],
    version: 1,
    subtitle: 'Read & Manage via IMAP',
    description: 'List, search, read, move, delete, or flag emails via Himalaya IMAP.',
    defaults: { name: 'Email Read', color: solarized.blue },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Input data' }],
    outputs: [
      { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Send result' },
      { name: 'tool', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Connect to AI Agent tool handle' },
    ],
    properties: [
      PROVIDER_PROPERTY,
      {
        displayName: 'Operation', name: 'operation', type: 'options', required: true, default: 'list',
        options: [
          { name: 'List Envelopes', value: 'list' },
          { name: 'Search Emails', value: 'search' },
          { name: 'Read Message', value: 'read' },
          { name: 'List Folders', value: 'folders' },
          { name: 'Move Message', value: 'move' },
          { name: 'Delete Message', value: 'delete' },
          { name: 'Flag Message', value: 'flag' },
        ],
      },
      { displayName: 'Folder', name: 'folder', type: 'string', default: 'INBOX', displayOptions: { show: { operation: ['list', 'search', 'read', 'move', 'delete', 'flag'] } } },
      { displayName: 'Query', name: 'query', type: 'string', default: '', required: true, placeholder: 'from:john subject:meeting', displayOptions: { show: { operation: ['search'] } } },
      { displayName: 'Message ID', name: 'message_id', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['read', 'move', 'delete', 'flag'] } } },
      { displayName: 'Target Folder', name: 'target_folder', type: 'string', default: '', required: true, placeholder: 'Archive', displayOptions: { show: { operation: ['move'] } } },
      { displayName: 'Flag', name: 'flag', type: 'options', default: 'Seen', options: [{ name: 'Seen', value: 'Seen' }, { name: 'Answered', value: 'Answered' }, { name: 'Flagged', value: 'Flagged' }, { name: 'Draft', value: 'Draft' }, { name: 'Deleted', value: 'Deleted' }], displayOptions: { show: { operation: ['flag'] } } },
      { displayName: 'Flag Action', name: 'flag_action', type: 'options', default: 'add', options: [{ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }], displayOptions: { show: { operation: ['flag'] } } },
      { displayName: 'Page', name: 'page', type: 'number', default: 1, typeOptions: { minValue: 1 }, displayOptions: { show: { operation: ['list'] } } },
      { displayName: 'Page Size', name: 'page_size', type: 'number', default: 20, typeOptions: { minValue: 1, maxValue: 100 }, displayOptions: { show: { operation: ['list'] } } },
    ],
  },

  emailReceive: {
    displayName: 'Email Receive',
    name: 'emailReceive',
    icon: EMAIL_RECEIVE_ICON,
    group: ['email', 'trigger'],
    version: 1,
    subtitle: 'On Email Received',
    description: 'Trigger workflow when new email arrives. Polls IMAP via Himalaya.',
    defaults: { name: 'Email Receive', color: solarized.blue },
    inputs: [],
    outputs: [{ name: 'main', displayName: 'Email', type: 'main' as NodeConnectionType, description: 'message_id, from, to, subject, date, body, folder' }],
    properties: [
      PROVIDER_PROPERTY,
      { displayName: 'Folder', name: 'folder', type: 'string', default: 'INBOX' },
      { displayName: 'Poll Interval (seconds)', name: 'poll_interval', type: 'number', default: 60, typeOptions: { minValue: 30, maxValue: 3600 } },
      { displayName: 'Filter Query', name: 'filter_query', type: 'string', default: '', placeholder: 'from:important@company.com' },
      { displayName: 'Mark as Read', name: 'mark_as_read', type: 'boolean', default: false },
    ],
  },
};

export const EMAIL_NODE_TYPES = ['emailSend', 'emailRead', 'emailReceive'];
