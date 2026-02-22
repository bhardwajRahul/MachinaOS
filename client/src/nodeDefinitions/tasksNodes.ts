// Google Tasks Node Definitions - Google Tasks API integration via OAuth 2.0
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { TASKS_ICON } from '../assets/icons/google';

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

const TASKLIST_ID_PROPERTY = {
  displayName: 'Task List ID',
  name: 'tasklist_id',
  type: 'string' as const,
  default: '@default',
  placeholder: '@default or specific list ID',
  description: 'Task list ID (use "@default" for primary list)'
};

// ============================================================================
// TASKS NODES
// ============================================================================

export const tasksNodes: Record<string, INodeTypeDescription> = {
  // Tasks Create - Create a new task
  tasksCreate: {
    displayName: 'Tasks Create',
    name: 'tasksCreate',
    icon: TASKS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Create Task',
    description: 'Create a new task in Google Tasks',
    defaults: { name: 'Tasks Create', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Task input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Created task (task_id, title, status)'
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

      // ===== TASK DETAILS =====
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Buy groceries',
        description: 'Task title'
      },
      {
        displayName: 'Notes',
        name: 'notes',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        placeholder: 'Remember to check the shopping list...',
        description: 'Task notes/description (optional)'
      },
      {
        displayName: 'Due Date',
        name: 'due_date',
        type: 'string',
        default: '',
        placeholder: '2026-02-25 or 2026-02-25T10:00:00Z',
        description: 'Due date (YYYY-MM-DD or RFC 3339 format)'
      },
      TASKLIST_ID_PROPERTY
    ]
  },

  // Tasks List - List tasks
  tasksList: {
    displayName: 'Tasks List',
    name: 'tasksList',
    icon: TASKS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'List Tasks',
    description: 'List tasks from a Google Tasks list',
    defaults: { name: 'Tasks List', color: '#4285F4' },
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
        description: 'Tasks array with count'
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
      TASKLIST_ID_PROPERTY,

      // ===== LIST OPTIONS =====
      {
        displayName: 'Show Completed',
        name: 'show_completed',
        type: 'boolean',
        default: false,
        description: 'Include completed tasks in the list'
      },
      {
        displayName: 'Show Hidden',
        name: 'show_hidden',
        type: 'boolean',
        default: false,
        description: 'Include hidden tasks in the list'
      },
      {
        displayName: 'Max Results',
        name: 'max_results',
        type: 'number',
        default: 100,
        typeOptions: { minValue: 1, maxValue: 100 },
        description: 'Maximum number of tasks to return'
      }
    ]
  },

  // Tasks Complete - Mark task as completed
  tasksComplete: {
    displayName: 'Tasks Complete',
    name: 'tasksComplete',
    icon: TASKS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Complete Task',
    description: 'Mark a task as completed',
    defaults: { name: 'Tasks Complete', color: '#4285F4' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Task input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Completed task confirmation'
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

      // ===== TASK IDENTIFICATION =====
      {
        displayName: 'Task ID',
        name: 'task_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'abc123xyz',
        description: 'ID of the task to mark as completed'
      },
      TASKLIST_ID_PROPERTY
    ]
  },

  // Tasks Update - Update an existing task
  tasksUpdate: {
    displayName: 'Tasks Update',
    name: 'tasksUpdate',
    icon: TASKS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Update Task',
    description: 'Update an existing task',
    defaults: { name: 'Tasks Update', color: '#4285F4' },
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
        description: 'Updated task details'
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

      // ===== TASK IDENTIFICATION =====
      {
        displayName: 'Task ID',
        name: 'task_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'abc123xyz',
        description: 'ID of the task to update'
      },

      // ===== FIELDS TO UPDATE =====
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        placeholder: 'New task title',
        description: 'New title (leave empty to keep current)'
      },
      {
        displayName: 'Notes',
        name: 'notes',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        placeholder: 'Updated notes...',
        description: 'New notes (leave empty to keep current)'
      },
      {
        displayName: 'Due Date',
        name: 'due_date',
        type: 'string',
        default: '',
        placeholder: '2026-02-25',
        description: 'New due date (leave empty to keep current)'
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
        description: 'New status'
      },
      TASKLIST_ID_PROPERTY
    ]
  },

  // Tasks Delete - Delete a task
  tasksDelete: {
    displayName: 'Tasks Delete',
    name: 'tasksDelete',
    icon: TASKS_ICON,
    group: ['google', 'tool'],
    version: 1,
    subtitle: 'Delete Task',
    description: 'Delete a task from Google Tasks',
    defaults: { name: 'Tasks Delete', color: '#4285F4' },
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

      // ===== TASK IDENTIFICATION =====
      {
        displayName: 'Task ID',
        name: 'task_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'abc123xyz',
        description: 'ID of the task to delete'
      },
      TASKLIST_ID_PROPERTY
    ]
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const TASKS_NODE_TYPES = ['tasksCreate', 'tasksList', 'tasksComplete', 'tasksUpdate', 'tasksDelete'];
