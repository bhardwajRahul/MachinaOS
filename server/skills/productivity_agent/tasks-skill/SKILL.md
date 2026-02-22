---
name: tasks-skill
description: Create, list, and complete Google Tasks. Supports task lists, due dates, and notes.
allowed-tools: tasks_create tasks_list tasks_complete
metadata:
  author: machina
  version: "1.0"
  category: productivity
  icon: "✅"
  color: "#4285F4"
---

# Google Tasks Skill

Manage Google Tasks - create, list, and complete tasks.

## Available Tools

### tasks_create

Create a new task.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Task title |
| notes | string | No | Task notes/description |
| due_date | string | No | Due date (ISO 8601 or YYYY-MM-DD) |
| tasklist_id | string | No | Task list ID (default: @default) |

**Example - Simple task:**
```json
{
  "title": "Review quarterly report"
}
```

**Example - Task with details:**
```json
{
  "title": "Submit expense report",
  "notes": "Include receipts for conference travel",
  "due_date": "2024-02-15"
}
```

**Example - Task in specific list:**
```json
{
  "title": "Buy groceries",
  "tasklist_id": "MTIzNDU2Nzg5MA",
  "due_date": "2024-02-01"
}
```

**Response:**
```json
{
  "success": true,
  "task_id": "abc123xyz",
  "title": "Submit expense report",
  "status": "needsAction",
  "due": "2024-02-15T00:00:00Z"
}
```

### tasks_list

List tasks from a task list.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tasklist_id | string | No | Task list ID (default: @default) |
| show_completed | boolean | No | Include completed tasks (default: false) |
| show_hidden | boolean | No | Include hidden tasks (default: false) |
| max_results | integer | No | Maximum results (default: 20, max: 100) |
| due_min | string | No | Filter by minimum due date |
| due_max | string | No | Filter by maximum due date |

**Example - List pending tasks:**
```json
{
  "show_completed": false,
  "max_results": 50
}
```

**Example - Tasks due this week:**
```json
{
  "due_min": "2024-02-01",
  "due_max": "2024-02-07"
}
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "abc123xyz",
      "title": "Submit expense report",
      "notes": "Include receipts for conference travel",
      "status": "needsAction",
      "due": "2024-02-15T00:00:00Z",
      "updated": "2024-02-01T10:30:00Z"
    },
    {
      "id": "def456uvw",
      "title": "Review quarterly report",
      "status": "needsAction",
      "updated": "2024-02-01T09:00:00Z"
    }
  ],
  "count": 2
}
```

### tasks_complete

Mark a task as completed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| task_id | string | Yes | Task ID to complete |
| tasklist_id | string | No | Task list ID (default: @default) |

**Example:**
```json
{
  "task_id": "abc123xyz"
}
```

**Response:**
```json
{
  "success": true,
  "task_id": "abc123xyz",
  "title": "Submit expense report",
  "status": "completed",
  "completed": "2024-02-10T14:30:00Z"
}
```

## Task Statuses

| Status | Description |
|--------|-------------|
| `needsAction` | Task is pending |
| `completed` | Task is done |

## Date Formats

- **ISO 8601**: `2024-02-15T14:00:00Z`
- **Date only**: `2024-02-15` (interpreted as midnight UTC)

## Working with Task Lists

The default task list is `@default`. To work with custom lists:

1. Use Google Tasks app to create lists
2. Get list ID from API (not exposed in this skill yet)
3. Pass `tasklist_id` parameter

## Common Workflows

1. **Daily review**: List pending tasks, prioritize
2. **Add reminders**: Create tasks with due dates
3. **Track completion**: Mark tasks done as you finish
4. **Weekly planning**: Create tasks for the week ahead

## Tips

- Tasks without due dates appear at the top of the list
- Completed tasks are hidden by default
- Notes can contain multiline text
- Due dates are in UTC timezone

## Setup Requirements

1. Connect Tasks nodes to AI Agent's `input-tools` handle
2. Authenticate with Google Workspace in Credentials Modal
3. Ensure Tasks API scopes are authorized
