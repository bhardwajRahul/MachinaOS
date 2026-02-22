---
name: calendar-skill
description: Create, list, update, and delete Google Calendar events. Supports attendees, reminders, and recurring events.
allowed-tools: calendar_create calendar_list calendar_update calendar_delete
metadata:
  author: machina
  version: "1.0"
  category: productivity
  icon: "📅"
  color: "#4285F4"
---

# Google Calendar Skill

Manage Google Calendar events - create, list, update, and delete.

## Available Tools

### calendar_create

Create a new calendar event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Event title/summary |
| start_time | string | Yes | Start time in ISO 8601 format |
| end_time | string | Yes | End time in ISO 8601 format |
| description | string | No | Event description |
| location | string | No | Event location |
| attendees | string | No | Comma-separated email addresses |
| reminder_minutes | integer | No | Minutes before event for reminder |
| timezone | string | No | Timezone (default: user's timezone) |

**Example - Simple event:**
```json
{
  "title": "Team Meeting",
  "start_time": "2024-02-01T14:00:00",
  "end_time": "2024-02-01T15:00:00",
  "description": "Weekly team sync"
}
```

**Example - Event with attendees:**
```json
{
  "title": "Project Review",
  "start_time": "2024-02-01T10:00:00",
  "end_time": "2024-02-01T11:30:00",
  "location": "Conference Room A",
  "attendees": "alice@example.com,bob@example.com",
  "reminder_minutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "abc123xyz",
  "title": "Team Meeting",
  "html_link": "https://calendar.google.com/event?eid=..."
}
```

### calendar_list

List calendar events within a date range.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| start_date | string | No | Start date (ISO 8601, default: today) |
| end_date | string | No | End date (ISO 8601, default: 7 days ahead) |
| max_results | integer | No | Maximum results (default: 10, max: 100) |
| calendar_id | string | No | Calendar ID (default: primary) |

**Example - List this week's events:**
```json
{
  "start_date": "2024-02-01",
  "end_date": "2024-02-07",
  "max_results": 20
}
```

**Response:**
```json
{
  "events": [
    {
      "id": "abc123",
      "title": "Team Meeting",
      "start": "2024-02-01T14:00:00Z",
      "end": "2024-02-01T15:00:00Z",
      "location": "Conference Room A",
      "attendees": ["alice@example.com"]
    }
  ],
  "count": 1
}
```

### calendar_update

Update an existing calendar event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| event_id | string | Yes | Event ID to update |
| title | string | No | New title |
| start_time | string | No | New start time |
| end_time | string | No | New end time |
| description | string | No | New description |
| location | string | No | New location |
| attendees | string | No | New attendees (replaces existing) |

**Example:**
```json
{
  "event_id": "abc123xyz",
  "title": "Updated Team Meeting",
  "start_time": "2024-02-01T15:00:00",
  "end_time": "2024-02-01T16:00:00"
}
```

### calendar_delete

Delete a calendar event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| event_id | string | Yes | Event ID to delete |
| calendar_id | string | No | Calendar ID (default: primary) |

**Example:**
```json
{
  "event_id": "abc123xyz"
}
```

## Date/Time Formats

- **ISO 8601**: `2024-02-01T14:00:00` (local time)
- **With timezone**: `2024-02-01T14:00:00-05:00` (EST)
- **UTC**: `2024-02-01T19:00:00Z`
- **Date only**: `2024-02-01` (all-day event)

## Common Workflows

1. **Schedule a meeting**: Create event with attendees, they receive invites
2. **Check availability**: List events for a date range
3. **Reschedule**: Update event with new times
4. **Cancel meeting**: Delete the event

## Setup Requirements

1. Connect Calendar nodes to AI Agent's `input-tools` handle
2. Authenticate with Google Workspace in Credentials Modal
3. Ensure Calendar API scopes are authorized
