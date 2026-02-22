// Google Drive Node Definitions - Google Drive API integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { DRIVE_ICON } from '../assets/icons/google';

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
// DRIVE NODES
// ============================================================================

export const driveNodes: Record<string, INodeTypeDescription> = {
  // Drive Upload - Upload files
  driveUpload: {
    displayName: 'Drive Upload',
    name: 'driveUpload',
    icon: DRIVE_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Upload File',
    description: 'Upload a file to Google Drive',
    defaults: { name: 'Drive Upload', color: '#0F9D58' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'File input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Uploaded file (file_id, name, web_link)'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      ACCOUNT_MODE_PROPERTY,
      CUSTOMER_ID_PROPERTY,

      // ===== FILE SOURCE =====
      {
        displayName: 'File URL',
        name: 'file_url',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/document.pdf',
        description: 'URL to download file from (for remote files)'
      },
      {
        displayName: 'File Content (Base64)',
        name: 'file_content',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        placeholder: 'SGVsbG8gV29ybGQh...',
        description: 'Base64-encoded file content (alternative to URL)'
      },
      {
        displayName: 'Filename',
        name: 'filename',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'document.pdf',
        description: 'Name for the uploaded file'
      },
      {
        displayName: 'MIME Type',
        name: 'mime_type',
        type: 'string',
        default: '',
        placeholder: 'application/pdf',
        description: 'File MIME type (auto-detected if empty)'
      },

      // ===== DESTINATION =====
      {
        displayName: 'Folder ID',
        name: 'folder_id',
        type: 'string',
        default: '',
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
        description: 'Parent folder ID (leave empty for root)'
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        placeholder: 'File description...',
        description: 'File description (optional)'
      }
    ]
  },

  // Drive Download - Download files
  driveDownload: {
    displayName: 'Drive Download',
    name: 'driveDownload',
    icon: DRIVE_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Download File',
    description: 'Download a file from Google Drive',
    defaults: { name: 'Drive Download', color: '#0F9D58' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'File ID input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'File content (base64 or download URL)'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      ACCOUNT_MODE_PROPERTY,
      CUSTOMER_ID_PROPERTY,

      // ===== FILE IDENTIFICATION =====
      {
        displayName: 'File ID',
        name: 'file_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
        description: 'ID of the file to download'
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
        description: 'How to return the file content'
      }
    ]
  },

  // Drive List - List files
  driveList: {
    displayName: 'Drive List',
    name: 'driveList',
    icon: DRIVE_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'List Files',
    description: 'List files in Google Drive',
    defaults: { name: 'Drive List', color: '#0F9D58' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Query input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Files array with metadata'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      ACCOUNT_MODE_PROPERTY,
      CUSTOMER_ID_PROPERTY,

      // ===== SEARCH OPTIONS =====
      {
        displayName: 'Folder ID',
        name: 'folder_id',
        type: 'string',
        default: '',
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
        description: 'List files in this folder (leave empty for all files)'
      },
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        placeholder: "name contains 'report'",
        description: 'Drive search query (see Google Drive query syntax)'
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
        description: 'Filter by file type'
      },
      {
        displayName: 'Max Results',
        name: 'max_results',
        type: 'number',
        default: 20,
        typeOptions: { minValue: 1, maxValue: 1000 },
        description: 'Maximum number of files to return'
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
        description: 'Sort order for files'
      }
    ]
  },

  // Drive Share - Share files
  driveShare: {
    displayName: 'Drive Share',
    name: 'driveShare',
    icon: DRIVE_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Share File',
    description: 'Share a file with another user',
    defaults: { name: 'Drive Share', color: '#0F9D58' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Share input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Share result with permission details'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    properties: [
      ACCOUNT_MODE_PROPERTY,
      CUSTOMER_ID_PROPERTY,

      // ===== FILE & RECIPIENT =====
      {
        displayName: 'File ID',
        name: 'file_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
        description: 'ID of the file to share'
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'user@example.com',
        description: 'Email address to share with'
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
        description: 'Permission level for the user'
      },
      {
        displayName: 'Send Notification',
        name: 'send_notification',
        type: 'boolean',
        default: true,
        description: 'Send email notification to the user'
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
          show: { send_notification: [true] }
        }
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const DRIVE_NODE_TYPES = ['driveUpload', 'driveDownload', 'driveList', 'driveShare'];
