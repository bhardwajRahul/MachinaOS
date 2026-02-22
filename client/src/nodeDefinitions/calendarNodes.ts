// Google Calendar Node Definitions - Google Calendar API integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { CALENDAR_ICON } from '../assets/icons/google';

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

const CALENDAR_ID_PROPERTY = {
  displayName: 'Calendar ID',
  name: 'calendar_id',
  type: 'string' as const,
  default: 'primary',
  placeholder: 'primary or calendar@group.calendar.google.com',
  description: 'Calendar ID (use "primary" for main calendar)'
};

// ============================================================================
// CALENDAR NODES
// ============================================================================

export const calendarNodes: Record<string, INodeTypeDescription> = {
  // Calendar Create - Create events
  calendarCreate: {
    displayName: 'Calendar Create',
    name: 'calendarCreate',
    icon: CALENDAR_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Create Event',
    description: 'Create a calendar event via Google Calendar API',
    defaults: { name: 'Calendar Create', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Event input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Created event (event_id, title, start, end, html_link)'
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

      // ===== EVENT DETAILS =====
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Meeting with Team',
        description: 'Event title/summary'
      },
      {
        displayName: 'Start Time',
        name: 'start_time',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-02-22T14:00:00',
        description: 'Start time in ISO format (e.g., 2026-02-22T14:00:00)'
      },
      {
        displayName: 'End Time',
        name: 'end_time',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-02-22T15:00:00',
        description: 'End time in ISO format'
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        placeholder: 'Meeting agenda and notes...',
        description: 'Event description (optional)'
      },
      {
        displayName: 'Location',
        name: 'location',
        type: 'string',
        default: '',
        placeholder: 'Conference Room A or https://meet.google.com/...',
        description: 'Event location (optional)'
      },
      {
        displayName: 'Attendees',
        name: 'attendees',
        type: 'string',
        default: '',
        placeholder: 'alice@example.com, bob@example.com',
        description: 'Attendee email addresses (comma-separated)'
      },
      {
        displayName: 'Timezone',
        name: 'timezone',
        type: 'string',
        default: 'UTC',
        placeholder: 'America/New_York',
        description: 'Timezone for the event (e.g., America/New_York, Europe/London)'
      },
      {
        displayName: 'Reminder (minutes)',
        name: 'reminder_minutes',
        type: 'number',
        default: 30,
        typeOptions: { minValue: 0, maxValue: 40320 },
        description: 'Minutes before event for popup reminder'
      },
      CALENDAR_ID_PROPERTY
    ]
  },

  // Calendar List - List events
  calendarList: {
    displayName: 'Calendar List',
    name: 'calendarList',
    icon: CALENDAR_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'List Events',
    description: 'List calendar events within a date range',
    defaults: { name: 'Calendar List', color: '#4285F4' },
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
        description: 'Events array with count'
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

      // ===== DATE RANGE =====
      {
        displayName: 'Start Date',
        name: 'start_date',
        type: 'string',
        default: 'today',
        placeholder: 'today or 2026-02-22T00:00:00Z',
        description: 'Start date for query ("today" or ISO format)'
      },
      {
        displayName: 'End Date',
        name: 'end_date',
        type: 'string',
        default: 'today+7d',
        placeholder: 'today+7d or 2026-02-29T23:59:59Z',
        description: 'End date ("today+Nd" for N days from now, or ISO format)'
      },
      {
        displayName: 'Max Results',
        name: 'max_results',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1, maxValue: 250 },
        description: 'Maximum number of events to return'
      },
      {
        displayName: 'Expand Recurring',
        name: 'single_events',
        type: 'boolean',
        default: true,
        description: 'Expand recurring events into individual instances'
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
        description: 'Sort order for events'
      },
      CALENDAR_ID_PROPERTY
    ]
  },

  // Calendar Update - Update events
  calendarUpdate: {
    displayName: 'Calendar Update',
    name: 'calendarUpdate',
    icon: CALENDAR_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Update Event',
    description: 'Update an existing calendar event',
    defaults: { name: 'Calendar Update', color: '#4285F4' },
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
        description: 'Updated event details'
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

      // ===== EVENT IDENTIFICATION =====
      {
        displayName: 'Event ID',
        name: 'event_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'abc123xyz',
        description: 'ID of the event to update'
      },

      // ===== FIELDS TO UPDATE =====
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        placeholder: 'New meeting title',
        description: 'New event title (leave empty to keep current)'
      },
      {
        displayName: 'Start Time',
        name: 'start_time',
        type: 'string',
        default: '',
        placeholder: '2026-02-22T14:00:00',
        description: 'New start time (leave empty to keep current)'
      },
      {
        displayName: 'End Time',
        name: 'end_time',
        type: 'string',
        default: '',
        placeholder: '2026-02-22T15:00:00',
        description: 'New end time (leave empty to keep current)'
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        placeholder: 'Updated description...',
        description: 'New description (leave empty to keep current)'
      },
      {
        displayName: 'Location',
        name: 'location',
        type: 'string',
        default: '',
        placeholder: 'New location',
        description: 'New location (leave empty to keep current)'
      },
      CALENDAR_ID_PROPERTY
    ]
  },

  // Calendar Delete - Delete events
  calendarDelete: {
    displayName: 'Calendar Delete',
    name: 'calendarDelete',
    icon: CALENDAR_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Delete Event',
    description: 'Delete a calendar event',
    defaults: { name: 'Calendar Delete', color: '#4285F4' },
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

      // ===== EVENT IDENTIFICATION =====
      {
        displayName: 'Event ID',
        name: 'event_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'abc123xyz',
        description: 'ID of the event to delete'
      },
      {
        displayName: 'Send Cancellation',
        name: 'send_updates',
        type: 'options',
        options: [
          { name: 'Send to All Attendees', value: 'all' },
          { name: 'Do Not Send', value: 'none' }
        ],
        default: 'all',
        description: 'Send cancellation emails to attendees'
      },
      CALENDAR_ID_PROPERTY
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const CALENDAR_NODE_TYPES = ['calendarCreate', 'calendarList', 'calendarUpdate', 'calendarDelete'];
