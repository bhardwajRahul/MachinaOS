// Google Sheets Node Definitions - Google Sheets API integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { SHEETS_ICON } from '../assets/icons/google';

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

const SPREADSHEET_ID_PROPERTY = {
  displayName: 'Spreadsheet ID',
  name: 'spreadsheet_id',
  type: 'string' as const,
  default: '',
  required: true,
  placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  description: 'ID from the spreadsheet URL (between /d/ and /edit)'
};

// ============================================================================
// SHEETS NODES
// ============================================================================

export const sheetsNodes: Record<string, INodeTypeDescription> = {
  // Sheets Read - Read data from spreadsheet
  sheetsRead: {
    displayName: 'Sheets Read',
    name: 'sheetsRead',
    icon: SHEETS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Read Data',
    description: 'Read data from a Google Sheets spreadsheet',
    defaults: { name: 'Sheets Read', color: '#0F9D58' },
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
        description: 'Values array with row/column count'
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
      SPREADSHEET_ID_PROPERTY,

      // ===== RANGE SELECTION =====
      {
        displayName: 'Range',
        name: 'range',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Sheet1!A1:D10',
        description: 'A1 notation range (e.g., "Sheet1!A1:D10" or "A:D")'
      },
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
        description: 'How values should be rendered in the output'
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
        description: 'Whether to return rows or columns first'
      }
    ]
  },

  // Sheets Write - Write data to spreadsheet
  sheetsWrite: {
    displayName: 'Sheets Write',
    name: 'sheetsWrite',
    icon: SHEETS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Write Data',
    description: 'Write data to a Google Sheets spreadsheet',
    defaults: { name: 'Sheets Write', color: '#0F9D58' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Data input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Update confirmation with cell count'
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
      SPREADSHEET_ID_PROPERTY,

      // ===== WRITE PARAMETERS =====
      {
        displayName: 'Range',
        name: 'range',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Sheet1!A1',
        description: 'Starting cell in A1 notation (e.g., "Sheet1!A1")'
      },
      {
        displayName: 'Values',
        name: 'values',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 4 },
        placeholder: '[["Name", "Age"], ["Alice", 25], ["Bob", 30]]',
        description: '2D array of values in JSON format or {{input.data}}'
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
        description: 'How input values should be interpreted (USER_ENTERED parses formulas)'
      }
    ]
  },

  // Sheets Append - Append rows to spreadsheet
  sheetsAppend: {
    displayName: 'Sheets Append',
    name: 'sheetsAppend',
    icon: SHEETS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Append Rows',
    description: 'Append rows to the end of a Google Sheets spreadsheet',
    defaults: { name: 'Sheets Append', color: '#0F9D58' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Data input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Append confirmation with updated range'
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
      SPREADSHEET_ID_PROPERTY,

      // ===== APPEND PARAMETERS =====
      {
        displayName: 'Range',
        name: 'range',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Sheet1!A:D',
        description: 'Table range in A1 notation (e.g., "Sheet1!A:D")'
      },
      {
        displayName: 'Values',
        name: 'values',
        type: 'string',
        default: '',
        required: true,
        typeOptions: { rows: 4 },
        placeholder: '[["Alice", 25, "alice@example.com"]]',
        description: '2D array of rows to append in JSON format'
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
        description: 'How input values should be interpreted'
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
        description: 'How the input data should be inserted'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const SHEETS_NODE_TYPES = ['sheetsRead', 'sheetsWrite', 'sheetsAppend'];
