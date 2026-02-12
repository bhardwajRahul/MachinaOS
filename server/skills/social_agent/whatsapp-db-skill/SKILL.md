---
name: whatsapp-db-skill
description: Query WhatsApp database for contacts, groups, and chat history. Look up contact info, search groups, retrieve messages.
allowed-tools: whatsapp_db
metadata:
  author: machina
  version: "1.0"
  category: messaging
  icon: "🗃️"
  color: "#25D366"
---

# WhatsApp Database Tool

Query WhatsApp database for contacts, groups, and message history.

## How It Works

This skill provides instructions for the **WhatsApp DB** tool node. Connect the **WhatsApp DB** node to Zeenie's `input-tools` handle to enable database queries.

## whatsapp_db Tool

Query contacts, groups, and chat history.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | Operation type (see below) |
| chat_type | string | For chat_history | `"individual"` or `"group"` |
| phone | string | Varies | Phone number (for chat_history individual, get_contact_info) |
| group_id | string | Varies | Group JID (for chat_history group, get_group_info) |
| query | string | No | Search query (for search_groups, list_contacts) |
| limit | int | No | Max results (varies by operation) |
| offset | int | No | Pagination offset (for chat_history) |
| message_filter | string | No | `"all"` or `"text_only"` (for chat_history) |
| group_filter | string | No | `"all"` or `"contact"` (for group chat_history) |
| sender_phone | string | No | Filter by sender (when group_filter="contact") |
| phones | string | For check_contacts | Comma-separated phone numbers |
| participant_limit | int | No | Max participants (for get_group_info, 1-100) |

### Operations

| Operation | Description | Required Fields |
|-----------|-------------|-----------------|
| `list_contacts` | List contacts with saved names | query (optional), limit |
| `get_contact_info` | Get full contact details | phone |
| `search_groups` | Search groups by name | query, limit |
| `get_group_info` | Get group details with participants | group_id |
| `chat_history` | Retrieve message history | chat_type, phone/group_id |
| `check_contacts` | Check WhatsApp registration | phones |

### Limits

| Operation | Default | Max |
|-----------|---------|-----|
| chat_history | 50 | 500 |
| search_groups | 20 | 50 |
| list_contacts | 50 | 100 |
| get_group_info participants | 50 | 100 |

**Important:** Always use small limits and specific queries to avoid context overflow.

## Operation Examples

### list_contacts

Find contacts by name.

```json
{
  "operation": "list_contacts",
  "query": "mom",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "operation": "list_contacts",
  "contacts": [
    {"phone": "919876543210", "name": "Mom", "jid": "919876543210@s.whatsapp.net"}
  ],
  "total": 1
}
```

### get_contact_info

Get full contact details for sending/replying.

```json
{
  "operation": "get_contact_info",
  "phone": "919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_contact_info",
  "phone": "919876543210",
  "name": "Mom",
  "jid": "919876543210@s.whatsapp.net",
  "profile_picture": "https://..."
}
```

### search_groups

Search groups by name.

```json
{
  "operation": "search_groups",
  "query": "family",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "operation": "search_groups",
  "groups": [
    {"group_id": "120363123456789@g.us", "name": "Family Group", "participant_count": 5}
  ],
  "total": 1
}
```

### get_group_info

Get group details with participant list.

```json
{
  "operation": "get_group_info",
  "group_id": "120363123456789@g.us",
  "participant_limit": 20
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_group_info",
  "name": "Family Group",
  "jid": "120363123456789@g.us",
  "participants": [
    {"phone": "919876543210", "name": "Mom", "is_admin": true},
    {"phone": "919876543211", "name": "Dad", "is_admin": false}
  ],
  "total_participants": 5
}
```

### chat_history (Individual)

Get messages from an individual chat.

```json
{
  "operation": "chat_history",
  "chat_type": "individual",
  "phone": "919876543210",
  "limit": 20
}
```

### chat_history (Group)

Get messages from a group chat.

```json
{
  "operation": "chat_history",
  "chat_type": "group",
  "group_id": "120363123456789@g.us",
  "message_filter": "text_only",
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "operation": "chat_history",
  "messages": [
    {
      "index": 1,
      "message_id": "ABC123",
      "sender": "919876543210@s.whatsapp.net",
      "sender_name": "Mom",
      "text": "Hello!",
      "timestamp": "2025-01-30T12:00:00",
      "is_from_me": false
    }
  ],
  "total": 50,
  "has_more": true
}
```

### check_contacts

Check if phone numbers have WhatsApp.

```json
{
  "operation": "check_contacts",
  "phones": "1234567890,0987654321"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "check_contacts",
  "results": [
    {"phone": "1234567890", "registered": true, "jid": "1234567890@s.whatsapp.net"},
    {"phone": "0987654321", "registered": false}
  ]
}
```

## Common Workflows

### Find and message someone by name

1. Use `list_contacts` with query to find the person
2. Get their phone number from the result
3. Use `whatsapp_send` tool with the phone number

### Get recent messages from a contact

1. Use `chat_history` with chat_type="individual"
2. Set appropriate limit for desired history depth

### Find and message a group

1. Use `search_groups` to find the group by name
2. Get the group_id from the result
3. Use `whatsapp_send` tool with recipient_type="group"

### See who's in a group

1. Use `get_group_info` with the group_id
2. Set participant_limit to control output size

## Guidelines

1. **Phone numbers**: Always use without + prefix, just digits
2. **Group IDs**: JID format ending in `@g.us`
3. **Limits**: Use small limits to avoid context overflow
4. **Queries**: Be specific to narrow results
5. **Pagination**: Use offset to page through chat_history

## Error Responses

```json
{
  "error": "Phone number is required for chat_type='individual'"
}
```

```json
{
  "error": "group_id is required for get_group_info"
}
```

## Setup Requirements

1. Connect the **WhatsApp DB** node to Zeenie's `input-tools` handle
2. Ensure WhatsApp is connected (green status indicator in Credentials)
