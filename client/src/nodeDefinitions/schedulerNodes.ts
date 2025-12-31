// Scheduler Nodes - Time-based workflow triggers
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const schedulerNodes: Record<string, INodeTypeDescription> = {
  // Timer node - Simple delay/wait before proceeding
  timer: {
    displayName: 'Timer',
    name: 'timer',
    icon: '⏱️',
    group: ['utility', 'workflow'],
    version: 1,
    subtitle: '={{$parameter["duration"]}} {{$parameter["unit"]}}',
    description: 'Wait for a specified duration before continuing',
    defaults: { name: 'Timer', color: '#10b981' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger to start timer'
    }],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'timestamp, elapsed_ms, duration, unit'
    }],
    properties: [
      {
        displayName: 'Duration',
        name: 'duration',
        type: 'number',
        default: 5,
        required: true,
        description: 'How long to wait',
        typeOptions: {
          minValue: 1,
          maxValue: 3600
        }
      },
      {
        displayName: 'Unit',
        name: 'unit',
        type: 'options',
        default: 'seconds',
        options: [
          { name: 'Seconds', value: 'seconds' },
          { name: 'Minutes', value: 'minutes' },
          { name: 'Hours', value: 'hours' }
        ],
        description: 'Time unit for duration'
      }
    ]
  },

  // Cron Scheduler - Recurring scheduled execution
  cronScheduler: {
    displayName: 'Cron Scheduler',
    name: 'cronScheduler',
    icon: '⏰',
    group: ['trigger', 'workflow'],
    version: 1,
    subtitle: '={{$parameter["frequency"]}}',
    description: 'Trigger workflow execution on a schedule',
    defaults: { name: 'Cron Scheduler', color: '#6366f1' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Trigger',
      type: 'main' as NodeConnectionType,
      description: 'timestamp, iteration, scheduled_time, next_run'
    }],
    properties: [
      // Duration Type
      {
        displayName: 'Duration',
        name: 'frequency',
        type: 'options',
        default: 'minutes',
        options: [
          { name: 'Seconds', value: 'seconds' },
          { name: 'Minutes', value: 'minutes' },
          { name: 'Hours', value: 'hours' },
          { name: 'Days', value: 'days' },
          { name: 'Weeks', value: 'weeks' },
          { name: 'Months', value: 'months' },
          { name: 'Once (No Repeat)', value: 'once' },
        ],
        description: 'Wait duration before triggering'
      },
      // Interval for seconds/minutes/hours
      {
        displayName: 'Interval',
        name: 'interval',
        type: 'number',
        default: 30,
        description: 'Run every X seconds (5-59)',
        displayOptions: { show: { frequency: ['seconds'] } }
      },
      {
        displayName: 'Interval',
        name: 'intervalMinutes',
        type: 'number',
        default: 5,
        description: 'Run every X minutes (1-59)',
        displayOptions: { show: { frequency: ['minutes'] } }
      },
      {
        displayName: 'Interval',
        name: 'intervalHours',
        type: 'number',
        default: 1,
        description: 'Run every X hours (1-23)',
        displayOptions: { show: { frequency: ['hours'] } }
      },
      // Time for daily
      {
        displayName: 'At Time',
        name: 'dailyTime',
        type: 'options',
        default: '09:00',
        options: [
          { name: '00:00 (Midnight)', value: '00:00' },
          { name: '06:00', value: '06:00' },
          { name: '08:00', value: '08:00' },
          { name: '09:00', value: '09:00' },
          { name: '10:00', value: '10:00' },
          { name: '12:00 (Noon)', value: '12:00' },
          { name: '14:00', value: '14:00' },
          { name: '16:00', value: '16:00' },
          { name: '18:00', value: '18:00' },
          { name: '20:00', value: '20:00' },
          { name: '22:00', value: '22:00' },
        ],
        description: 'Time to run daily',
        displayOptions: { show: { frequency: ['days'] } }
      },
      // Weekday + Time for weekly
      {
        displayName: 'On Day',
        name: 'weekday',
        type: 'options',
        default: '1',
        options: [
          { name: 'Sunday', value: '0' },
          { name: 'Monday', value: '1' },
          { name: 'Tuesday', value: '2' },
          { name: 'Wednesday', value: '3' },
          { name: 'Thursday', value: '4' },
          { name: 'Friday', value: '5' },
          { name: 'Saturday', value: '6' },
        ],
        description: 'Day of week',
        displayOptions: { show: { frequency: ['weeks'] } }
      },
      {
        displayName: 'At Time',
        name: 'weeklyTime',
        type: 'options',
        default: '09:00',
        options: [
          { name: '00:00 (Midnight)', value: '00:00' },
          { name: '06:00', value: '06:00' },
          { name: '08:00', value: '08:00' },
          { name: '09:00', value: '09:00' },
          { name: '12:00 (Noon)', value: '12:00' },
          { name: '18:00', value: '18:00' },
        ],
        description: 'Time to run',
        displayOptions: { show: { frequency: ['weeks'] } }
      },
      // Day of month + Time for monthly
      {
        displayName: 'On Day',
        name: 'monthDay',
        type: 'options',
        default: '1',
        options: [
          ...Array.from({ length: 28 }, (_, i) => ({ name: `${i + 1}`, value: String(i + 1) })),
          { name: 'Last day', value: 'L' },
        ],
        description: 'Day of month',
        displayOptions: { show: { frequency: ['months'] } }
      },
      {
        displayName: 'At Time',
        name: 'monthlyTime',
        type: 'options',
        default: '09:00',
        options: [
          { name: '00:00 (Midnight)', value: '00:00' },
          { name: '06:00', value: '06:00' },
          { name: '09:00', value: '09:00' },
          { name: '12:00 (Noon)', value: '12:00' },
          { name: '18:00', value: '18:00' },
        ],
        description: 'Time to run',
        displayOptions: { show: { frequency: ['months'] } }
      },
      // Timezone for schedule
      {
        displayName: 'Timezone',
        name: 'timezone',
        type: 'options',
        default: 'UTC',
        options: [
          { name: 'UTC', value: 'UTC' },
          { name: 'US Eastern', value: 'America/New_York' },
          { name: 'US Pacific', value: 'America/Los_Angeles' },
          { name: 'UK', value: 'Europe/London' },
          { name: 'Europe Central', value: 'Europe/Paris' },
          { name: 'Japan', value: 'Asia/Tokyo' },
          { name: 'India', value: 'Asia/Kolkata' },
        ],
        description: 'Timezone for schedule'
      }
    ]
  }
};

export const SCHEDULER_NODE_TYPES = ['timer', 'cronScheduler'];
