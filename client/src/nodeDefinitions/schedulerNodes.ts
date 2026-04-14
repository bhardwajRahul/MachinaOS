// Scheduler Nodes - Time-based workflow triggers
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const schedulerNodes: Record<string, INodeTypeDescription> = {
  // Timer node - Simple delay/wait before proceeding
  timer: {
    displayName: 'Timer',
    name: 'timer',
    group: ['utility', 'workflow', 'tool'],
    version: 1,
    subtitle: '={{$parameter["duration"]}} {{$parameter["unit"]}}',
    description: 'Wait for a specified duration before continuing. Can also be used as an AI Agent tool.',
    defaults: { name: 'Timer', color: '#10b981' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger to start timer'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'timestamp, elapsed_ms, duration, unit'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (WorkflowTriggerParams).
    properties: [],
  },

  // Cron Scheduler - Recurring scheduled execution
  cronScheduler: {
    displayName: 'Cron Scheduler',
    name: 'cronScheduler',
    group: ['trigger', 'workflow', 'tool'],
    version: 1,
    subtitle: '={{$parameter["frequency"]}}',
    description: 'Trigger workflow execution on a schedule. Can also be used as an AI Agent tool.',
    defaults: { name: 'Cron Scheduler', color: '#6366f1' },
    inputs: [],
    outputs: [
      {
        name: 'main',
        displayName: 'Trigger',
        type: 'main' as NodeConnectionType,
        description: 'timestamp, iteration, scheduled_time, next_run'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (CronSchedulerParams).
    // Note: backend now carries the full options arrays for frequency,
    // weekday, daily_time, timezone via Field(json_schema_extra=).
    properties: [],
  },
};

export const SCHEDULER_NODE_TYPES = ['timer', 'cronScheduler'];
