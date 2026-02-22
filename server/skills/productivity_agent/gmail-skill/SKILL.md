---
name: gmail-skill
description: Send, search, and read Gmail emails. Supports composing emails with attachments, searching by query, and reading email content.
allowed-tools: gmail_send gmail_search gmail_read
metadata:
  author: machina
  version: "1.0"
  category: productivity
  icon: "📧"
  color: "#EA4335"
---

# Gmail Skill

Send, search, and read emails using Gmail API.

## Available Tools

### gmail_send

Send an email message.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| to | string | Yes | Recipient email address |
| subject | string | Yes | Email subject line |
| body | string | Yes | Email body (plain text or HTML) |
| cc | string | No | CC recipients (comma-separated) |
| bcc | string | No | BCC recipients (comma-separated) |
| is_html | boolean | No | Set true for HTML body (default: false) |

**Example - Send plain text email:**
```json
{
  "to": "recipient@example.com",
  "subject": "Meeting Tomorrow",
  "body": "Hi,\n\nJust a reminder about our meeting tomorrow at 2pm.\n\nBest regards"
}
```

**Example - Send HTML email:**
```json
{
  "to": "recipient@example.com",
  "subject": "Weekly Report",
  "body": "<h1>Weekly Report</h1><p>Here are the highlights...</p>",
  "is_html": true
}
```

### gmail_search

Search emails using Gmail query syntax.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Gmail search query |
| max_results | integer | No | Maximum results (default: 10, max: 100) |

**Query Syntax Examples:**
- `from:sender@example.com` - Emails from specific sender
- `to:recipient@example.com` - Emails to specific recipient
- `subject:meeting` - Emails with "meeting" in subject
- `has:attachment` - Emails with attachments
- `is:unread` - Unread emails
- `after:2024/01/01` - Emails after date
- `before:2024/12/31` - Emails before date
- `label:important` - Emails with label
- `"exact phrase"` - Exact phrase match
- `from:boss@company.com is:unread` - Combine multiple filters

**Example:**
```json
{
  "query": "from:client@example.com has:attachment after:2024/01/01",
  "max_results": 20
}
```

**Response:**
```json
{
  "emails": [
    {
      "id": "abc123",
      "thread_id": "thread456",
      "subject": "Project Files",
      "from": "client@example.com",
      "to": "you@example.com",
      "date": "2024-01-15T10:30:00Z",
      "snippet": "Please find attached..."
    }
  ],
  "count": 1
}
```

### gmail_read

Read full email content by ID.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email_id | string | Yes | Email ID from search results |

**Example:**
```json
{
  "email_id": "abc123"
}
```

**Response:**
```json
{
  "id": "abc123",
  "thread_id": "thread456",
  "subject": "Project Files",
  "from": "client@example.com",
  "to": "you@example.com",
  "date": "2024-01-15T10:30:00Z",
  "body": "Full email body content...",
  "attachments": [
    {"filename": "report.pdf", "mime_type": "application/pdf", "size": 102400}
  ]
}
```

## Common Workflows

1. **Check unread emails**: Search with `is:unread`, then read important ones
2. **Find emails from someone**: Search with `from:email@example.com`
3. **Reply to email**: Read the email first, then send with same subject prefixed with "Re:"
4. **Forward email**: Read email, send to new recipient with "Fwd:" prefix

## Setup Requirements

1. Connect Gmail nodes to AI Agent's `input-tools` handle
2. Authenticate with Google Workspace in Credentials Modal
3. Ensure Gmail API scopes are authorized
