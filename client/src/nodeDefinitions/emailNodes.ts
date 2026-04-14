// Email Node Definitions - IMAP/SMTP integration via Himalaya CLI
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { solarized } from '../styles/theme';
import { EMAIL_SEND_ICON, EMAIL_READ_ICON, EMAIL_RECEIVE_ICON } from '../assets/icons/email';

// Wave 8: provider presets + property metadata now live on backend
// (Email{Send,Read,Receive}Params + EMAIL_PROVIDERS in server config).

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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },
};

export const EMAIL_NODE_TYPES = ['emailSend', 'emailRead', 'emailReceive'];
