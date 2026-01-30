---
name: scheduler-skill
description: Schedule tasks and set timers. Use when user wants to schedule something, set a reminder, create a recurring task, or use cron expressions.
metadata:
  author: machina
  version: "2.0"
  category: automation
---

# Task Scheduling

This skill provides context for scheduling tasks, setting timers, and creating recurring jobs.

## How It Works

This skill provides instructions and context. Scheduling is handled through workflow deployment:

- **Cron Scheduler** trigger node - Recurring schedules using cron expressions
- **Timer** trigger node - One-time delayed execution
- **Workflow Trigger** node - Manual workflow execution

## Capabilities

When used with workflow triggers:
- Create one-time timers
- Set up recurring schedules with cron expressions
- Deploy workflows that run on schedule

## Cron Expression Format

```
* * * * *
| | | | |
| | | | +-- Day of week (0-7, Sun=0 or 7)
| | | +---- Month (1-12)
| | +------ Day of month (1-31)
| +-------- Hour (0-23)
+---------- Minute (0-59)
```

### Common Patterns

| Pattern | Description |
|---------|-------------|
| `0 9 * * *` | Every day at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of each month |
| `0 8,12,18 * * *` | At 8am, noon, and 6pm |

## Example Interactions

**User**: "Remind me in 30 minutes"
- This requires setting up a Timer trigger workflow
- Inform user: "I can help you create a scheduled workflow. Set up a Timer trigger node with 30 minute delay."

**User**: "Send a daily report at 9am"
- This requires a Cron Scheduler workflow
- Inform user: "Create a workflow with Cron Scheduler trigger using expression '0 9 * * *'"

**User**: "Check for updates every hour"
- This requires a Cron Scheduler workflow
- Inform user: "Create a workflow with Cron Scheduler trigger using expression '0 * * * *'"

## Workflow-Based Scheduling

In this system, scheduling is achieved through:

1. **Trigger Nodes**: Cron Scheduler or Timer nodes start workflows
2. **Workflow Deployment**: Deploy the workflow to activate the schedule
3. **Cancel**: Undeploy the workflow to cancel the schedule

## Best Practices

1. Explain that schedules require workflow deployment
2. Provide the cron expression for the user's request
3. Confirm timezone considerations for time-sensitive tasks
4. Help users understand workflow-based scheduling model

## Limitations

- This skill provides guidance only
- Actual scheduling requires workflow creation and deployment
- Cannot directly create/cancel schedules via chat commands
