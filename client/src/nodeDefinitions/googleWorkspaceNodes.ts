// Google Workspace Node Definitions - Consolidated nodes for Gmail, Calendar, Drive, Sheets, Tasks, Contacts
// Each node uses an operation selector pattern with displayOptions.show for conditional parameters
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import {
  GMAIL_ICON,
  CALENDAR_ICON,
  DRIVE_ICON,
  SHEETS_ICON,
  TASKS_ICON,
  CONTACTS_ICON
} from '../assets/icons/google';

// Wave 8: ACCOUNT_MODE_PROPERTY + CUSTOMER_ID_PROPERTY moved to backend
// (each Google* Pydantic model carries account_mode + customer_id with
// the customer-mode displayOptions gate).

// ============================================================================
// GMAIL NODE (Consolidated: send, search, read)
// ============================================================================

export const gmailNode: INodeTypeDescription = {
  displayName: 'Gmail',
  name: 'gmail',
  icon: GMAIL_ICON,
  group: ['google', 'tool'],
  version: 1,
  subtitle: 'Email Operations',
  description: 'Send, search, and read emails via Gmail API',
  defaults: { name: 'Gmail', color: '#EA4335' },
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Input data'
  }],
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// GMAIL RECEIVE NODE (Trigger - kept separate)
// ============================================================================

export const gmailReceiveNode: INodeTypeDescription = {
  displayName: 'Gmail Receive',
  name: 'gmailReceive',
  icon: GMAIL_ICON,
  group: ['google', 'trigger'],
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
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// CALENDAR NODE (Consolidated: create, list, update, delete)
// ============================================================================

export const calendarNode: INodeTypeDescription = {
  displayName: 'Calendar',
  name: 'calendar',
  icon: CALENDAR_ICON,
  group: ['google', 'tool'],
  version: 1,
  subtitle: 'Calendar Events',
  description: 'Create, list, update, and delete calendar events via Google Calendar API',
  defaults: { name: 'Calendar', color: '#4285F4' },
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Input data'
  }],
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// DRIVE NODE (Consolidated: upload, download, list, share)
// ============================================================================

export const driveNode: INodeTypeDescription = {
  displayName: 'Drive',
  name: 'drive',
  icon: DRIVE_ICON,
  group: ['google', 'tool'],
  version: 1,
  subtitle: 'File Operations',
  description: 'Upload, download, list, and share files via Google Drive API',
  defaults: { name: 'Drive', color: '#0F9D58' },
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Input data'
  }],
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// SHEETS NODE (Consolidated: read, write, append)
// ============================================================================

export const sheetsNode: INodeTypeDescription = {
  displayName: 'Sheets',
  name: 'sheets',
  icon: SHEETS_ICON,
  group: ['google', 'tool'],
  version: 1,
  subtitle: 'Spreadsheet Operations',
  description: 'Read, write, and append data to Google Sheets',
  defaults: { name: 'Sheets', color: '#0F9D58' },
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Input data'
  }],
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// TASKS NODE (Consolidated: create, list, complete, update, delete)
// ============================================================================

export const tasksNode: INodeTypeDescription = {
  displayName: 'Tasks',
  name: 'tasks',
  icon: TASKS_ICON,
  group: ['google', 'tool'],
  version: 1,
  subtitle: 'Task Management',
  description: 'Create, list, update, and delete tasks via Google Tasks API',
  defaults: { name: 'Tasks', color: '#4285F4' },
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Input data'
  }],
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// CONTACTS NODE (Consolidated: create, list, search, get, update, delete)
// ============================================================================

export const contactsNode: INodeTypeDescription = {
  displayName: 'Contacts',
  name: 'contacts',
  icon: CONTACTS_ICON,
  group: ['google', 'tool'],
  version: 1,
  subtitle: 'Contact Management',
  description: 'Create, list, search, and manage contacts via Google People API',
  defaults: { name: 'Contacts', color: '#4285F4' },
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Input data'
  }],
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Operation result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],
  // Wave 8: schema lives on backend (see server/models/nodes.py).
  properties: [],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const googleWorkspaceNodes: Record<string, INodeTypeDescription> = {
  gmail: gmailNode,
  gmailReceive: gmailReceiveNode,
  calendar: calendarNode,
  drive: driveNode,
  sheets: sheetsNode,
  tasks: tasksNode,
  contacts: contactsNode
};

export const GOOGLE_WORKSPACE_NODE_TYPES = [
  'gmail',
  'gmailReceive',
  'calendar',
  'drive',
  'sheets',
  'tasks',
  'contacts'
];
