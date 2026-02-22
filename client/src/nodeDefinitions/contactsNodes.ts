// Google Contacts Node Definitions - Google People API integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { CONTACTS_ICON } from '../assets/icons/google';

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
// CONTACTS NODES
// ============================================================================

export const contactsNodes: Record<string, INodeTypeDescription> = {
  // Contacts Create - Create a new contact
  contactsCreate: {
    displayName: 'Contacts Create',
    name: 'contactsCreate',
    icon: CONTACTS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Create Contact',
    description: 'Create a new contact in Google Contacts',
    defaults: { name: 'Contacts Create', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Contact input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Created contact (resource_name, display_name, email, phone)'
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

      // ===== CONTACT DETAILS =====
      {
        displayName: 'First Name',
        name: 'first_name',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'John',
        description: 'First name (required)'
      },
      {
        displayName: 'Last Name',
        name: 'last_name',
        type: 'string',
        default: '',
        placeholder: 'Doe',
        description: 'Last name (optional)'
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        default: '',
        placeholder: 'john.doe@example.com',
        description: 'Email address (optional)'
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        default: '',
        placeholder: '+1 555-123-4567',
        description: 'Phone number (optional)'
      },
      {
        displayName: 'Company',
        name: 'company',
        type: 'string',
        default: '',
        placeholder: 'Acme Inc.',
        description: 'Company/organization name (optional)'
      },
      {
        displayName: 'Job Title',
        name: 'job_title',
        type: 'string',
        default: '',
        placeholder: 'Software Engineer',
        description: 'Job title (optional)'
      },
      {
        displayName: 'Notes',
        name: 'notes',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        placeholder: 'Additional notes about this contact...',
        description: 'Notes/biography (optional)'
      }
    ]
  },

  // Contacts List - List contacts
  contactsList: {
    displayName: 'Contacts List',
    name: 'contactsList',
    icon: CONTACTS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'List Contacts',
    description: 'List contacts from Google Contacts',
    defaults: { name: 'Contacts List', color: '#4285F4' },
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
        description: 'Contacts array with count'
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

      // ===== LIST OPTIONS =====
      {
        displayName: 'Page Size',
        name: 'page_size',
        type: 'number',
        default: 100,
        typeOptions: { minValue: 1, maxValue: 1000 },
        description: 'Number of contacts to return'
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
        description: 'Sort order for contacts'
      },
      {
        displayName: 'Page Token',
        name: 'page_token',
        type: 'string',
        default: '',
        placeholder: 'Next page token from previous request',
        description: 'Token for pagination (from previous request)'
      }
    ]
  },

  // Contacts Search - Search contacts
  contactsSearch: {
    displayName: 'Contacts Search',
    name: 'contactsSearch',
    icon: CONTACTS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Search Contacts',
    description: 'Search contacts by name, email, or phone',
    defaults: { name: 'Contacts Search', color: '#4285F4' },
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
        description: 'Matching contacts array'
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

      // ===== SEARCH PARAMETERS =====
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'John or john@example.com',
        description: 'Search query (name, email, phone)'
      },
      {
        displayName: 'Max Results',
        name: 'page_size',
        type: 'number',
        default: 30,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Maximum number of results'
      }
    ]
  },

  // Contacts Get - Get a specific contact
  contactsGet: {
    displayName: 'Contacts Get',
    name: 'contactsGet',
    icon: CONTACTS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Get Contact',
    description: 'Get a specific contact by resource name',
    defaults: { name: 'Contacts Get', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Contact input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Contact details'
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

      // ===== CONTACT IDENTIFICATION =====
      {
        displayName: 'Resource Name',
        name: 'resource_name',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'people/c12345678',
        description: 'Contact resource name (from list or search results)'
      }
    ]
  },

  // Contacts Update - Update an existing contact
  contactsUpdate: {
    displayName: 'Contacts Update',
    name: 'contactsUpdate',
    icon: CONTACTS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Update Contact',
    description: 'Update an existing contact',
    defaults: { name: 'Contacts Update', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Update input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Updated contact details'
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

      // ===== CONTACT IDENTIFICATION =====
      {
        displayName: 'Resource Name',
        name: 'resource_name',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'people/c12345678',
        description: 'Contact resource name to update'
      },

      // ===== FIELDS TO UPDATE =====
      {
        displayName: 'First Name',
        name: 'first_name',
        type: 'string',
        default: '',
        placeholder: 'John',
        description: 'New first name (leave empty to keep current)'
      },
      {
        displayName: 'Last Name',
        name: 'last_name',
        type: 'string',
        default: '',
        placeholder: 'Doe',
        description: 'New last name (leave empty to keep current)'
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        default: '',
        placeholder: 'john.doe@example.com',
        description: 'New email (leave empty to keep current)'
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        default: '',
        placeholder: '+1 555-123-4567',
        description: 'New phone (leave empty to keep current)'
      },
      {
        displayName: 'Company',
        name: 'company',
        type: 'string',
        default: '',
        placeholder: 'Acme Inc.',
        description: 'New company (leave empty to keep current)'
      },
      {
        displayName: 'Job Title',
        name: 'job_title',
        type: 'string',
        default: '',
        placeholder: 'Software Engineer',
        description: 'New job title (leave empty to keep current)'
      }
    ]
  },

  // Contacts Delete - Delete a contact
  contactsDelete: {
    displayName: 'Contacts Delete',
    name: 'contactsDelete',
    icon: CONTACTS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Delete Contact',
    description: 'Delete a contact from Google Contacts',
    defaults: { name: 'Contacts Delete', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Delete input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Deletion confirmation'
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

      // ===== CONTACT IDENTIFICATION =====
      {
        displayName: 'Resource Name',
        name: 'resource_name',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'people/c12345678',
        description: 'Contact resource name to delete'
      }
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const CONTACTS_NODE_TYPES = ['contactsCreate', 'contactsList', 'contactsSearch', 'contactsGet', 'contactsUpdate', 'contactsDelete'];
