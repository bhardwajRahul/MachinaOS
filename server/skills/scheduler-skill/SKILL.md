---
name: scheduler-skill
description: Schedule tasks and set timers. Use when user wants to schedule something, set a reminder, create a recurring task, or use cron expressions.
allowed-tools: scheduler-cron scheduler-timer scheduler-list scheduler-cancel
metadata:
  author: machina
  version: "1.0"
  category: automation
---

# Task Scheduling

This skill enables you to schedule tasks, set timers, and create recurring jobs.

## Capabilities

- Create one-time timers
- Set up recurring schedules with cron expressions
- List active schedules
- Cancel scheduled tasks

## Tool Reference

### scheduler-timer
Set a one-time timer.

Parameters:
- `duration` (required): Time until execution (e.g., "5m", "1h", "30s")
- `action` (required): What to do when timer fires
- `name` (optional): Timer identifier

### scheduler-cron
Create a recurring schedule using cron expression.

Parameters:
- `expression` (required): Cron expression (e.g., "0 9 * * *")
- `action` (required): What to do on each trigger
- `name` (optional): Schedule identifier
- `timezone` (optional): Timezone for schedule (default: UTC)

### scheduler-list
List all active schedules and timers.

Parameters: None

### scheduler-cancel
Cancel a scheduled task.

Parameters:
- `name` (required): Name of schedule to cancel

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

## Examples

**User**: "Remind me in 30 minutes"
**Action**: Use scheduler-timer with:
- duration: "30m"
- action: "Send reminder notification"
- name: "user_reminder"

**User**: "Send a daily report at 9am"
**Action**: Use scheduler-cron with:
- expression: "0 9 * * *"
- action: "Generate and send daily report"
- name: "daily_report"

**User**: "Check for updates every hour"
**Action**: Use scheduler-cron with:
- expression: "0 * * * *"
- action: "Check for system updates"
- name: "hourly_update_check"

**User**: "What schedules are active?"
**Action**: Use scheduler-list

**User**: "Cancel the daily report"
**Action**: Use scheduler-cancel with:
- name: "daily_report"

## Best Practices

1. Always give schedules descriptive names
2. Confirm timezone with user for time-sensitive tasks
3. List active schedules before creating duplicates
4. Provide feedback when schedules are created/cancelled
