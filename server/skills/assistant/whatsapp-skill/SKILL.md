---
name: whatsapp-skill
description: Send WhatsApp messages, query contacts/groups, retrieve chat history. Look up contact info by name or phone for sending/replying.
metadata:
  author: machina
  version: "3.0"
  category: messaging
  icon: "💬"
  color: "#25D366"
---

# WhatsApp Messaging Skill

This skill provides context for WhatsApp messaging capabilities.

## How It Works

This skill provides instructions and context. To execute WhatsApp actions, connect the appropriate **tool nodes** to the Zeenie's `input-tools` handle:

- **WhatsApp Send** node - Send messages to contacts or groups
- **WhatsApp DB** node - Query contacts, groups, and chat history

## whatsapp_send Tool

Send messages to contacts or groups.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| recipient_type | string | Yes | "phone" for individual or "group" for group chat |
| phone | string | If phone | Phone number without + prefix (e.g., 1234567890) |
| group_id | string | If group | Group JID (e.g., 123456789@g.us) |
| message_type | string | Yes | "text", "image", "video", "audio", "document", "sticker", "location", "contact" |
| message | string | If text | Text message content |
| media_url | string | If media | URL for image/video/audio/document/sticker |
| caption | string | No | Caption for media messages |
| latitude | float | If location | Latitude coordinate |
| longitude | float | If location | Longitude coordinate |
| location_name | string | No | Display name for location |
| address | string | No | Address text for location |
| contact_name | string | If contact | Contact display name |
| vcard | string | If contact | vCard 3.0 format string |

### Examples

**Send text message:**
```json
{
  "recipient_type": "phone",
  "phone": "1234567890",
  "message_type": "text",
  "message": "Hello! How are you?"
}
```

**Send image with caption:**
```json
{
  "recipient_type": "phone",
  "phone": "1234567890",
  "message_type": "image",
  "media_url": "https://example.com/photo.jpg",
  "caption": "Check out this photo!"
}
```

**Send to group:**
```json
{
  "recipient_type": "group",
  "group_id": "123456789012345678@g.us",
  "message_type": "text",
  "message": "Hello everyone!"
}
```

**Send location:**
```json
{
  "recipient_type": "phone",
  "phone": "1234567890",
  "message_type": "location",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "location_name": "San Francisco",
  "address": "San Francisco, CA, USA"
}
```

### Response Format

```json
{
  "success": true,
  "recipient": "1234567890",
  "recipient_type": "phone",
  "message_type": "text",
  "details": {
    "status": "sent",
    "preview": "Hello! How are you?",
    "timestamp": "2025-01-30T12:00:00"
  }
}
```

## whatsapp_db Tool

Query WhatsApp database - contacts, groups, messages.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | "chat_history", "search_groups", "get_group_info", "get_contact_info", "list_contacts", "check_contacts" |
| chat_type | string | For chat_history | "individual" or "group" |
| phone | string | Varies | Phone number for chat_history (individual), get_contact_info |
| group_id | string | Varies | Group JID for chat_history (group), get_group_info |
| message_filter | string | No | For chat_history: "all" or "text_only" |
| group_filter | string | No | For chat_history (group): "all" or "contact" |
| sender_phone | string | No | For chat_history with group_filter="contact" |
| limit | int | No | Max results. chat_history: 1-500 (default 50), search_groups: 1-50 (default 20), list_contacts: 1-100 (default 50) |
| offset | int | No | For chat_history: pagination offset |
| query | string | No | Search query for search_groups, list_contacts. Use specific queries to narrow results |
| phones | string | For check_contacts | Comma-separated phone numbers |
| participant_limit | int | No | For get_group_info: max participants (1-100, default 50) |

**Important:** Always use small limits and specific queries to avoid context overflow errors.

### Operations

#### list_contacts
List contacts with saved names. Useful for finding someone by name.

```json
{
  "operation": "list_contacts",
  "query": "mom",
  "limit": 10
}
```

#### get_contact_info
Get full contact info for sending/replying.

```json
{
  "operation": "get_contact_info",
  "phone": "919876543210"
}
```

#### search_groups
Search groups by name. Use specific query to narrow results.

```json
{
  "operation": "search_groups",
  "query": "family",
  "limit": 10
}
```

#### get_group_info
Get group details with participant names. Large groups may have many participants.

```json
{
  "operation": "get_group_info",
  "group_id": "120363123456789@g.us",
  "participant_limit": 20
}
```

#### chat_history
Retrieve message history.

```json
{
  "operation": "chat_history",
  "chat_type": "individual",
  "phone": "1234567890",
  "limit": 20
}
```

```json
{
  "operation": "chat_history",
  "chat_type": "group",
  "group_id": "123456789012345678@g.us",
  "message_filter": "text_only",
  "limit": 50
}
```

#### check_contacts
Check WhatsApp registration status.

```json
{
  "operation": "check_contacts",
  "phones": "1234567890,0987654321"
}
```

### Response Formats

**list_contacts response:**
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

**chat_history response:**
```json
{
  "success": true,
  "operation": "chat_history",
  "messages": [
    {
      "index": 1,
      "message_id": "ABC123",
      "sender": "919876543210@s.whatsapp.net",
      "text": "Hello!",
      "timestamp": "2025-01-30T12:00:00",
      "is_from_me": false
    }
  ],
  "total": 50,
  "has_more": true
}
```

**get_group_info response:**
```json
{
  "success": true,
  "operation": "get_group_info",
  "name": "Family Group",
  "jid": "123456789@g.us",
  "participants": [
    {"phone": "919876543210", "name": "Mom", "is_admin": true},
    {"phone": "919876543211", "name": "Dad", "is_admin": false}
  ]
}
```

## Common Workflows

### Send message to someone by name

1. Use `list_contacts` with query to find the person
2. Get their phone number from the result
3. Use `whatsapp_send` with the phone number

### Reply to someone in a group

1. Use `get_group_info` to get participant names and phones
2. Use `whatsapp_send` with recipient_type="phone" and the person's phone

### Find and message a group

1. Use `search_groups` to find the group by name
2. Use `whatsapp_send` with recipient_type="group" and the group_id

## Guidelines

1. **Phone numbers**: Always use without + prefix, just digits (e.g., 919876543210)
2. **Groups**: Use JID format ending in @g.us
3. **Contact lookup**: Use list_contacts first if you only have a name
4. **Media URLs**: Must be publicly accessible URLs
5. **Pagination**: Use offset with limit to page through chat history

## Setup Requirements

1. Connect this skill to Zeenie's `input-skill` handle
2. Connect WhatsApp tool nodes to Zeenie's `input-tools` handle
3. Ensure WhatsApp is connected (green status indicator)
