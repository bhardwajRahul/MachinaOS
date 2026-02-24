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

// ============================================================================
// SHARED PROPERTIES
// ============================================================================

const ACCOUNT_MODE_PROPERTY = {
  displayName: 'Account',
  name: 'account_mode',
  type: 'options' as const,
  options: [
    { name: 'Owner Account', value: 'owner' },
    { name: 'Customer Account', value: 'customer' }
  ],
  default: 'owner',
  description: 'Which Google account to use'
};

const CUSTOMER_ID_PROPERTY = {
  displayName: 'Customer ID',
  name: 'customer_id',
  type: 'string' as const,
  default: '',
  placeholder: 'customer_123 or {{input.customer_id}}',
  description: 'Customer identifier to look up their Google connection',
  displayOptions: {
    show: { account_mode: ['customer'] }
  }
};

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
  properties: [
    // ===== OPERATION SELECTOR =====
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Send Email', value: 'send' },
        { name: 'Search Emails', value: 'search' },
        { name: 'Read Email', value: 'read' }
      ],
      default: 'send',
      required: true,
      description: 'Operation to perform'
    },

    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

    // ===== SEND PARAMETERS =====
    {
      displayName: 'To',
      name: 'to',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'recipient@example.com, another@example.com',
      description: 'Recipient email addresses (comma-separated)',
      displayOptions: {
        show: { operation: ['send'] }
      }
    },
    {
      displayName: 'CC',
      name: 'cc',
      type: 'string',
      default: '',
      placeholder: 'cc@example.com',
      description: 'CC recipients (optional)',
      displayOptions: {
        show: { operation: ['send'] }
      }
    },
    {
      displayName: 'BCC',
      name: 'bcc',
      type: 'string',
      default: '',
      placeholder: 'bcc@example.com',
      description: 'BCC recipients (optional)',
      displayOptions: {
        show: { operation: ['send'] }
      }
    },
    {
      displayName: 'Subject',
      name: 'subject',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'Email subject line',
      description: 'Email subject',
      displayOptions: {
        show: { operation: ['send'] }
      }
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
      description: 'Email body format',
      displayOptions: {
        show: { operation: ['send'] }
      }
    },
    {
      displayName: 'Body',
      name: 'body',
      type: 'string',
      default: '',
      required: true,
      typeOptions: { rows: 6 },
      placeholder: 'Email content...',
      description: 'Email body content',
      displayOptions: {
        show: { operation: ['send'] }
      }
    },

    // ===== SEARCH PARAMETERS =====
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'from:someone@example.com subject:meeting',
      description: 'Gmail search query (same syntax as Gmail web)',
      displayOptions: {
        show: { operation: ['search'] }
      }
    },
    {
      displayName: 'Max Results',
      name: 'max_results',
      type: 'number',
      default: 10,
      typeOptions: { minValue: 1, maxValue: 100 },
      description: 'Maximum number of messages to return',
      displayOptions: {
        show: { operation: ['search'] }
      }
    },
    {
      displayName: 'Include Body',
      name: 'include_body',
      type: 'boolean',
      default: false,
      description: 'Fetch full message body (slower but includes content)',
      displayOptions: {
        show: { operation: ['search'] }
      }
    },

    // ===== READ PARAMETERS =====
    {
      displayName: 'Message ID',
      name: 'message_id',
      type: 'string',
      default: '',
      required: true,
      placeholder: '18d5a7e2c3b4f5a6',
      description: 'Gmail message ID to read',
      displayOptions: {
        show: { operation: ['read'] }
      }
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
      description: 'Message format to retrieve',
      displayOptions: {
        show: { operation: ['read'] }
      }
    }
  ]
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
  properties: [
    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

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
    {
      displayName: 'Poll Interval (seconds)',
      name: 'poll_interval',
      type: 'number',
      default: 60,
      typeOptions: { minValue: 30, maxValue: 3600 },
      description: 'How often to check for new emails (30s - 1 hour)'
    }
  ]
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
  properties: [
    // ===== OPERATION SELECTOR =====
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Event', value: 'create' },
        { name: 'List Events', value: 'list' },
        { name: 'Update Event', value: 'update' },
        { name: 'Delete Event', value: 'delete' }
      ],
      default: 'create',
      required: true,
      description: 'Operation to perform'
    },

    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

    // ===== CALENDAR ID (all operations) =====
    {
      displayName: 'Calendar ID',
      name: 'calendar_id',
      type: 'string',
      default: 'primary',
      placeholder: 'primary or calendar@group.calendar.google.com',
      description: 'Calendar ID (use "primary" for main calendar)'
    },

    // ===== CREATE PARAMETERS =====
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'Meeting with Team',
      description: 'Event title/summary',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Start Time',
      name: 'start_time',
      type: 'string',
      default: '',
      required: true,
      placeholder: '2026-02-22T14:00:00',
      description: 'Start time in ISO format (e.g., 2026-02-22T14:00:00)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'End Time',
      name: 'end_time',
      type: 'string',
      default: '',
      required: true,
      placeholder: '2026-02-22T15:00:00',
      description: 'End time in ISO format',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Description',
      name: 'description',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      placeholder: 'Meeting agenda and notes...',
      description: 'Event description (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'string',
      default: '',
      placeholder: 'Conference Room A or https://meet.google.com/...',
      description: 'Event location (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Attendees',
      name: 'attendees',
      type: 'string',
      default: '',
      placeholder: 'alice@example.com, bob@example.com',
      description: 'Attendee email addresses (comma-separated)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Timezone',
      name: 'timezone',
      type: 'string',
      default: 'UTC',
      placeholder: 'America/New_York',
      description: 'Timezone for the event (e.g., America/New_York, Europe/London)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Reminder (minutes)',
      name: 'reminder_minutes',
      type: 'number',
      default: 30,
      typeOptions: { minValue: 0, maxValue: 40320 },
      description: 'Minutes before event for popup reminder',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },

    // ===== LIST PARAMETERS =====
    {
      displayName: 'Start Date',
      name: 'start_date',
      type: 'string',
      default: 'today',
      placeholder: 'today or 2026-02-22T00:00:00Z',
      description: 'Start date for query ("today" or ISO format)',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'End Date',
      name: 'end_date',
      type: 'string',
      default: 'today+7d',
      placeholder: 'today+7d or 2026-02-29T23:59:59Z',
      description: 'End date ("today+Nd" for N days from now, or ISO format)',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Max Results',
      name: 'max_results',
      type: 'number',
      default: 10,
      typeOptions: { minValue: 1, maxValue: 250 },
      description: 'Maximum number of events to return',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Expand Recurring',
      name: 'single_events',
      type: 'boolean',
      default: true,
      description: 'Expand recurring events into individual instances',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Order By',
      name: 'order_by',
      type: 'options',
      options: [
        { name: 'Start Time', value: 'startTime' },
        { name: 'Last Updated', value: 'updated' }
      ],
      default: 'startTime',
      description: 'Sort order for events',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },

    // ===== UPDATE PARAMETERS =====
    {
      displayName: 'Event ID',
      name: 'event_id',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'abc123xyz',
      description: 'ID of the event to update or delete',
      displayOptions: {
        show: { operation: ['update', 'delete'] }
      }
    },
    {
      displayName: 'Title',
      name: 'update_title',
      type: 'string',
      default: '',
      placeholder: 'New meeting title',
      description: 'New event title (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Start Time',
      name: 'update_start_time',
      type: 'string',
      default: '',
      placeholder: '2026-02-22T14:00:00',
      description: 'New start time (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'End Time',
      name: 'update_end_time',
      type: 'string',
      default: '',
      placeholder: '2026-02-22T15:00:00',
      description: 'New end time (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Description',
      name: 'update_description',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      placeholder: 'Updated description...',
      description: 'New description (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Location',
      name: 'update_location',
      type: 'string',
      default: '',
      placeholder: 'New location',
      description: 'New location (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },

    // ===== DELETE PARAMETERS =====
    {
      displayName: 'Send Cancellation',
      name: 'send_updates',
      type: 'options',
      options: [
        { name: 'Send to All Attendees', value: 'all' },
        { name: 'Do Not Send', value: 'none' }
      ],
      default: 'all',
      description: 'Send cancellation emails to attendees',
      displayOptions: {
        show: { operation: ['delete'] }
      }
    }
  ]
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
  properties: [
    // ===== OPERATION SELECTOR =====
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Upload File', value: 'upload' },
        { name: 'Download File', value: 'download' },
        { name: 'List Files', value: 'list' },
        { name: 'Share File', value: 'share' }
      ],
      default: 'list',
      required: true,
      description: 'Operation to perform'
    },

    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

    // ===== UPLOAD PARAMETERS =====
    {
      displayName: 'File URL',
      name: 'file_url',
      type: 'string',
      default: '',
      placeholder: 'https://example.com/document.pdf',
      description: 'URL to download file from (for remote files)',
      displayOptions: {
        show: { operation: ['upload'] }
      }
    },
    {
      displayName: 'File Content (Base64)',
      name: 'file_content',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      placeholder: 'SGVsbG8gV29ybGQh...',
      description: 'Base64-encoded file content (alternative to URL)',
      displayOptions: {
        show: { operation: ['upload'] }
      }
    },
    {
      displayName: 'Filename',
      name: 'filename',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'document.pdf',
      description: 'Name for the uploaded file',
      displayOptions: {
        show: { operation: ['upload'] }
      }
    },
    {
      displayName: 'MIME Type',
      name: 'mime_type',
      type: 'string',
      default: '',
      placeholder: 'application/pdf',
      description: 'File MIME type (auto-detected if empty)',
      displayOptions: {
        show: { operation: ['upload'] }
      }
    },
    {
      displayName: 'Folder ID',
      name: 'folder_id',
      type: 'string',
      default: '',
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
      description: 'Parent folder ID (leave empty for root)',
      displayOptions: {
        show: { operation: ['upload', 'list'] }
      }
    },
    {
      displayName: 'Description',
      name: 'file_description',
      type: 'string',
      default: '',
      placeholder: 'File description...',
      description: 'File description (optional)',
      displayOptions: {
        show: { operation: ['upload'] }
      }
    },

    // ===== DOWNLOAD PARAMETERS =====
    {
      displayName: 'File ID',
      name: 'file_id',
      type: 'string',
      default: '',
      required: true,
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
      description: 'ID of the file to download or share',
      displayOptions: {
        show: { operation: ['download', 'share'] }
      }
    },
    {
      displayName: 'Output Format',
      name: 'output_format',
      type: 'options',
      options: [
        { name: 'Base64 Content', value: 'base64' },
        { name: 'Download URL', value: 'url' }
      ],
      default: 'base64',
      description: 'How to return the file content',
      displayOptions: {
        show: { operation: ['download'] }
      }
    },

    // ===== LIST PARAMETERS =====
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      placeholder: "name contains 'report'",
      description: 'Drive search query (see Google Drive query syntax)',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'File Type',
      name: 'file_types',
      type: 'options',
      options: [
        { name: 'All Files', value: 'all' },
        { name: 'Folders Only', value: 'folder' },
        { name: 'Documents', value: 'document' },
        { name: 'Spreadsheets', value: 'spreadsheet' },
        { name: 'Images', value: 'image' }
      ],
      default: 'all',
      description: 'Filter by file type',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Max Results',
      name: 'max_results',
      type: 'number',
      default: 20,
      typeOptions: { minValue: 1, maxValue: 1000 },
      description: 'Maximum number of files to return',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Order By',
      name: 'order_by',
      type: 'options',
      options: [
        { name: 'Last Modified (Newest)', value: 'modifiedTime desc' },
        { name: 'Last Modified (Oldest)', value: 'modifiedTime' },
        { name: 'Created (Newest)', value: 'createdTime desc' },
        { name: 'Created (Oldest)', value: 'createdTime' },
        { name: 'Name (A-Z)', value: 'name' },
        { name: 'Name (Z-A)', value: 'name desc' }
      ],
      default: 'modifiedTime desc',
      description: 'Sort order for files',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },

    // ===== SHARE PARAMETERS =====
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'user@example.com',
      description: 'Email address to share with',
      displayOptions: {
        show: { operation: ['share'] }
      }
    },
    {
      displayName: 'Role',
      name: 'role',
      type: 'options',
      options: [
        { name: 'Viewer (read-only)', value: 'reader' },
        { name: 'Commenter (view + comment)', value: 'commenter' },
        { name: 'Editor (full access)', value: 'writer' }
      ],
      default: 'reader',
      description: 'Permission level for the user',
      displayOptions: {
        show: { operation: ['share'] }
      }
    },
    {
      displayName: 'Send Notification',
      name: 'send_notification',
      type: 'boolean',
      default: true,
      description: 'Send email notification to the user',
      displayOptions: {
        show: { operation: ['share'] }
      }
    },
    {
      displayName: 'Message',
      name: 'message',
      type: 'string',
      default: '',
      typeOptions: { rows: 2 },
      placeholder: 'Here is the file you requested...',
      description: 'Custom message for the notification email',
      displayOptions: {
        show: { operation: ['share'], send_notification: [true] }
      }
    }
  ]
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
  properties: [
    // ===== OPERATION SELECTOR =====
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Read Data', value: 'read' },
        { name: 'Write Data', value: 'write' },
        { name: 'Append Rows', value: 'append' }
      ],
      default: 'read',
      required: true,
      description: 'Operation to perform'
    },

    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

    // ===== SPREADSHEET ID (all operations) =====
    {
      displayName: 'Spreadsheet ID',
      name: 'spreadsheet_id',
      type: 'string',
      default: '',
      required: true,
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      description: 'ID from the spreadsheet URL (between /d/ and /edit)'
    },

    // ===== RANGE (all operations) =====
    {
      displayName: 'Range',
      name: 'range',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'Sheet1!A1:D10',
      description: 'A1 notation range (e.g., "Sheet1!A1:D10" or "A:D")'
    },

    // ===== READ PARAMETERS =====
    {
      displayName: 'Value Render Option',
      name: 'value_render_option',
      type: 'options',
      options: [
        { name: 'Formatted Value', value: 'FORMATTED_VALUE' },
        { name: 'Unformatted Value', value: 'UNFORMATTED_VALUE' },
        { name: 'Formula', value: 'FORMULA' }
      ],
      default: 'FORMATTED_VALUE',
      description: 'How values should be rendered in the output',
      displayOptions: {
        show: { operation: ['read'] }
      }
    },
    {
      displayName: 'Major Dimension',
      name: 'major_dimension',
      type: 'options',
      options: [
        { name: 'Rows', value: 'ROWS' },
        { name: 'Columns', value: 'COLUMNS' }
      ],
      default: 'ROWS',
      description: 'Whether to return rows or columns first',
      displayOptions: {
        show: { operation: ['read'] }
      }
    },

    // ===== WRITE/APPEND PARAMETERS =====
    {
      displayName: 'Values',
      name: 'values',
      type: 'string',
      default: '',
      required: true,
      typeOptions: { rows: 4 },
      placeholder: '[["Name", "Age"], ["Alice", 25], ["Bob", 30]]',
      description: '2D array of values in JSON format or {{input.data}}',
      displayOptions: {
        show: { operation: ['write', 'append'] }
      }
    },
    {
      displayName: 'Value Input Option',
      name: 'value_input_option',
      type: 'options',
      options: [
        { name: 'User Entered', value: 'USER_ENTERED' },
        { name: 'Raw', value: 'RAW' }
      ],
      default: 'USER_ENTERED',
      description: 'How input values should be interpreted (USER_ENTERED parses formulas)',
      displayOptions: {
        show: { operation: ['write', 'append'] }
      }
    },
    {
      displayName: 'Insert Data Option',
      name: 'insert_data_option',
      type: 'options',
      options: [
        { name: 'Insert Rows', value: 'INSERT_ROWS' },
        { name: 'Overwrite', value: 'OVERWRITE' }
      ],
      default: 'INSERT_ROWS',
      description: 'How the input data should be inserted',
      displayOptions: {
        show: { operation: ['append'] }
      }
    }
  ]
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
  properties: [
    // ===== OPERATION SELECTOR =====
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Task', value: 'create' },
        { name: 'List Tasks', value: 'list' },
        { name: 'Complete Task', value: 'complete' },
        { name: 'Update Task', value: 'update' },
        { name: 'Delete Task', value: 'delete' }
      ],
      default: 'create',
      required: true,
      description: 'Operation to perform'
    },

    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

    // ===== TASK LIST ID (all operations) =====
    {
      displayName: 'Task List ID',
      name: 'tasklist_id',
      type: 'string',
      default: '@default',
      placeholder: '@default or specific list ID',
      description: 'Task list ID (use "@default" for primary list)'
    },

    // ===== CREATE PARAMETERS =====
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'Buy groceries',
      description: 'Task title',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Notes',
      name: 'notes',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      placeholder: 'Remember to check the shopping list...',
      description: 'Task notes/description (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Due Date',
      name: 'due_date',
      type: 'string',
      default: '',
      placeholder: '2026-02-25 or 2026-02-25T10:00:00Z',
      description: 'Due date (YYYY-MM-DD or RFC 3339 format)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },

    // ===== LIST PARAMETERS =====
    {
      displayName: 'Show Completed',
      name: 'show_completed',
      type: 'boolean',
      default: false,
      description: 'Include completed tasks in the list',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Show Hidden',
      name: 'show_hidden',
      type: 'boolean',
      default: false,
      description: 'Include hidden tasks in the list',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Max Results',
      name: 'max_results',
      type: 'number',
      default: 100,
      typeOptions: { minValue: 1, maxValue: 100 },
      description: 'Maximum number of tasks to return',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },

    // ===== TASK ID (complete, update, delete) =====
    {
      displayName: 'Task ID',
      name: 'task_id',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'abc123xyz',
      description: 'ID of the task',
      displayOptions: {
        show: { operation: ['complete', 'update', 'delete'] }
      }
    },

    // ===== UPDATE PARAMETERS =====
    {
      displayName: 'Title',
      name: 'update_title',
      type: 'string',
      default: '',
      placeholder: 'New task title',
      description: 'New title (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Notes',
      name: 'update_notes',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      placeholder: 'Updated notes...',
      description: 'New notes (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Due Date',
      name: 'update_due_date',
      type: 'string',
      default: '',
      placeholder: '2026-02-25',
      description: 'New due date (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Status',
      name: 'status',
      type: 'options',
      options: [
        { name: 'Keep Current', value: '' },
        { name: 'Needs Action', value: 'needsAction' },
        { name: 'Completed', value: 'completed' }
      ],
      default: '',
      description: 'New status',
      displayOptions: {
        show: { operation: ['update'] }
      }
    }
  ]
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
  properties: [
    // ===== OPERATION SELECTOR =====
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Contact', value: 'create' },
        { name: 'List Contacts', value: 'list' },
        { name: 'Search Contacts', value: 'search' },
        { name: 'Get Contact', value: 'get' },
        { name: 'Update Contact', value: 'update' },
        { name: 'Delete Contact', value: 'delete' }
      ],
      default: 'list',
      required: true,
      description: 'Operation to perform'
    },

    ACCOUNT_MODE_PROPERTY,
    CUSTOMER_ID_PROPERTY,

    // ===== CREATE PARAMETERS =====
    {
      displayName: 'First Name',
      name: 'first_name',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'John',
      description: 'First name (required)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Last Name',
      name: 'last_name',
      type: 'string',
      default: '',
      placeholder: 'Doe',
      description: 'Last name (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      placeholder: 'john.doe@example.com',
      description: 'Email address (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Phone',
      name: 'phone',
      type: 'string',
      default: '',
      placeholder: '+1 555-123-4567',
      description: 'Phone number (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Company',
      name: 'company',
      type: 'string',
      default: '',
      placeholder: 'Acme Inc.',
      description: 'Company/organization name (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Job Title',
      name: 'job_title',
      type: 'string',
      default: '',
      placeholder: 'Software Engineer',
      description: 'Job title (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },
    {
      displayName: 'Notes',
      name: 'contact_notes',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      placeholder: 'Additional notes about this contact...',
      description: 'Notes/biography (optional)',
      displayOptions: {
        show: { operation: ['create'] }
      }
    },

    // ===== LIST PARAMETERS =====
    {
      displayName: 'Page Size',
      name: 'page_size',
      type: 'number',
      default: 100,
      typeOptions: { minValue: 1, maxValue: 1000 },
      description: 'Number of contacts to return',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Sort Order',
      name: 'sort_order',
      type: 'options',
      options: [
        { name: 'Last Modified (Newest)', value: 'LAST_MODIFIED_DESCENDING' },
        { name: 'Last Modified (Oldest)', value: 'LAST_MODIFIED_ASCENDING' },
        { name: 'First Name (A-Z)', value: 'FIRST_NAME_ASCENDING' },
        { name: 'Last Name (A-Z)', value: 'LAST_NAME_ASCENDING' }
      ],
      default: 'LAST_MODIFIED_DESCENDING',
      description: 'Sort order for contacts',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },
    {
      displayName: 'Page Token',
      name: 'page_token',
      type: 'string',
      default: '',
      placeholder: 'Next page token from previous request',
      description: 'Token for pagination (from previous request)',
      displayOptions: {
        show: { operation: ['list'] }
      }
    },

    // ===== SEARCH PARAMETERS =====
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'John or john@example.com',
      description: 'Search query (name, email, phone)',
      displayOptions: {
        show: { operation: ['search'] }
      }
    },
    {
      displayName: 'Max Results',
      name: 'search_page_size',
      type: 'number',
      default: 30,
      typeOptions: { minValue: 1, maxValue: 100 },
      description: 'Maximum number of results',
      displayOptions: {
        show: { operation: ['search'] }
      }
    },

    // ===== GET/UPDATE/DELETE PARAMETERS =====
    {
      displayName: 'Resource Name',
      name: 'resource_name',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'people/c12345678',
      description: 'Contact resource name (from list or search results)',
      displayOptions: {
        show: { operation: ['get', 'update', 'delete'] }
      }
    },

    // ===== UPDATE PARAMETERS =====
    {
      displayName: 'First Name',
      name: 'update_first_name',
      type: 'string',
      default: '',
      placeholder: 'John',
      description: 'New first name (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Last Name',
      name: 'update_last_name',
      type: 'string',
      default: '',
      placeholder: 'Doe',
      description: 'New last name (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Email',
      name: 'update_email',
      type: 'string',
      default: '',
      placeholder: 'john.doe@example.com',
      description: 'New email (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Phone',
      name: 'update_phone',
      type: 'string',
      default: '',
      placeholder: '+1 555-123-4567',
      description: 'New phone (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Company',
      name: 'update_company',
      type: 'string',
      default: '',
      placeholder: 'Acme Inc.',
      description: 'New company (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    },
    {
      displayName: 'Job Title',
      name: 'update_job_title',
      type: 'string',
      default: '',
      placeholder: 'Software Engineer',
      description: 'New job title (leave empty to keep current)',
      displayOptions: {
        show: { operation: ['update'] }
      }
    }
  ]
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
