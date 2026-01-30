---
name: whatsapp-skill
description: Send WhatsApp messages, query contacts/groups, retrieve chat history. Look up contact info by name or phone for sending/replying.
allowed-tools: whatsapp_send whatsapp_db
metadata:
  author: machina
  version: "3.0"
  category: messaging
---

# WhatsApp Messaging Skill

Send and receive WhatsApp messages, query contacts and groups using connected WhatsApp nodes.

## Capabilities

- Send text messages to phone numbers or groups
- Send media messages (images, videos, audio, documents, stickers)
- Send location information
- Send contact cards (vCard)
- **Query contacts** - List contacts with saved names (e.g., "Mummy", "Dad")
- **Get contact info** - Get full info including phone, name, profile picture URL
- **Search groups** - Find groups by name
- **Get group info** - Get group details with participant names and phone numbers
- **Retrieve chat history** - Messages from individual chats or groups
- **Check WhatsApp registration** - Verify if phone numbers are on WhatsApp

## whatsapp_send

Send messages to contacts or groups.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| recipient_type | string | Yes | "phone" for individual or "group" for group chat |
| phone | string | If phone | Phone number without + prefix (e.g., 1234567890) |
| group_id | string | If group | Group JID (e.g., 123456789@g.us) |
| message_type | string | Yes | "text", "image", "video", "audio", "document", "sticker", "location", "contact" |
| message | string | If text | Text message content |
| media_url | string | If media | URL for image/video/audio/document/sticker |
| caption | string | No | Caption for media messages (image, video, document) |
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

## whatsapp_db

Query WhatsApp database - contacts, groups, messages.

### Operations

| Operation | Description |
|-----------|-------------|
| `list_contacts` | List all contacts with saved names |
| `get_contact_info` | Get full info for a contact (for sending/replying) |
| `search_groups` | Search groups by name |
| `get_group_info` | Get group details with participant names |
| `chat_history` | Retrieve message history |
| `check_contacts` | Check WhatsApp registration status |

### list_contacts

List contacts with their saved names. Useful for finding someone by name.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "list_contacts" |
| query | string | No | Filter by name or phone (empty = all) |

**Example - Find contact by name:**
```json
{
  "operation": "list_contacts",
  "query": "mom"
}
```

**Response:**
```json
{
  "contacts": [
    {"jid": "919876543210@s.whatsapp.net", "phone": "919876543210", "name": "Mummy", "push_name": "Mom"},
    {"jid": "918765432109@s.whatsapp.net", "phone": "918765432109", "name": "Mom Home", "push_name": ""}
  ],
  "total": 2
}
```

### get_contact_info

Get full contact info including profile picture URL. Use this to get phone number from a name for sending messages.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "get_contact_info" |
| phone | string | Yes | Phone number (without + prefix) |

**Example:**
```json
{
  "operation": "get_contact_info",
  "phone": "919876543210"
}
```

**Response:**
```json
{
  "jid": "919876543210@s.whatsapp.net",
  "phone": "919876543210",
  "name": "Ajay Flatmate",
  "push_name": "Ajay K",
  "business_name": "",
  "is_business": false,
  "is_contact": true,
  "profile_pic": "https://pps.whatsapp.net/v/..."
}
```

### search_groups

Search for groups by name.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "search_groups" |
| query | string | No | Group name search (empty = all groups) |

**Example:**
```json
{
  "operation": "search_groups",
  "query": "family"
}
```

**Response:**
```json
{
  "groups": [
    {"jid": "120363123456789@g.us", "name": "Family Group", "participant_count": 12}
  ],
  "total": 1
}
```

### get_group_info

Get group details including participant names and phone numbers. Use this to find who is in a group and reply to specific members.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "get_group_info" |
| group_id | string | Yes | Group JID (e.g., 123456789@g.us) |

**Example:**
```json
{
  "operation": "get_group_info",
  "group_id": "120363123456789@g.us"
}
```

**Response:**
```json
{
  "jid": "120363123456789@g.us",
  "name": "Family Group",
  "participants": [
    {"jid": "919876543210@s.whatsapp.net", "phone": "919876543210", "name": "Dad", "is_admin": true},
    {"jid": "919987654321@s.whatsapp.net", "phone": "919987654321", "name": "Mom", "is_admin": false},
    {"jid": "919123456789@s.whatsapp.net", "phone": "919123456789", "name": "", "is_admin": false}
  ]
}
```

### chat_history

Retrieve message history from chats.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "chat_history" |
| chat_type | string | Yes | "individual" or "group" |
| phone | string | If individual | Phone number without + prefix |
| group_id | string | If group | Group JID |
| message_filter | string | No | "all" (default) or "text_only" |
| group_filter | string | No | For groups: "all" (default) or "contact" to filter by sender |
| sender_phone | string | No | For groups with group_filter="contact": filter messages from this phone |
| limit | int | No | Max messages (1-500, default 50) |
| offset | int | No | Skip for pagination (default 0) |

**Example - Individual chat:**
```json
{
  "operation": "chat_history",
  "chat_type": "individual",
  "phone": "1234567890",
  "limit": 20
}
```

**Example - Group chat:**
```json
{
  "operation": "chat_history",
  "chat_type": "group",
  "group_id": "123456789012345678@g.us",
  "message_filter": "text_only",
  "limit": 50
}
```

**Example - Group chat filtered by sender:**
```json
{
  "operation": "chat_history",
  "chat_type": "group",
  "group_id": "123456789012345678@g.us",
  "group_filter": "contact",
  "sender_phone": "919876543210",
  "limit": 20
}
```

### check_contacts

Check if phone numbers are registered on WhatsApp.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "check_contacts" |
| phones | string | Yes | Comma-separated phone numbers |

**Example:**
```json
{
  "operation": "check_contacts",
  "phones": "1234567890, 0987654321"
}
```

## Common Workflows

### Send message to someone by name

1. Use `list_contacts` with query to find the person
2. Get their phone number from the result
3. Use `whatsapp_send` with the phone number

```
User: "Send 'Happy Birthday!' to Mom"
1. list_contacts with query="mom" -> finds phone 919876543210
2. whatsapp_send with phone=919876543210, message="Happy Birthday!"
```

### Reply to someone in a group

1. Use `get_group_info` to get participant names and phones
2. Use `whatsapp_send` with recipient_type="phone" and the person's phone

```
User: "Reply to Dad in Family Group saying 'I'll be there'"
1. search_groups with query="family" -> gets group JID
2. get_group_info -> finds Dad's phone 919876543210
3. whatsapp_send with phone=919876543210, message="I'll be there"
```

### Find and message a group

1. Use `search_groups` to find the group by name
2. Use `whatsapp_send` with recipient_type="group" and the group_id

## Using as Workflow Node

The WhatsApp DB node can be used directly in workflows (not just as an AI Agent tool):

1. **Add the node**: Drag "WhatsApp DB" from the Component Palette (WhatsApp category)
2. **Select operation**: Choose from the dropdown (Chat History, Search Groups, etc.)
3. **Configure parameters**: The UI shows only relevant parameters based on operation
4. **Connect**: Wire the node's output to downstream nodes
5. **Run**: Click Run to execute and see results in the Output Panel

### Output Variables

Each operation produces different output variables that can be dragged to downstream nodes:

| Operation | Output Fields |
|-----------|--------------|
| chat_history | `messages[]`, `total`, `has_more`, `count` |
| search_groups | `groups[]`, `total`, `query` |
| get_group_info | `jid`, `name`, `participants[]` |
| get_contact_info | `jid`, `phone`, `name`, `push_name`, `profile_pic` |
| list_contacts | `contacts[]`, `total`, `query` |
| check_contacts | `results[]`, `total` |

### Dual-Purpose Node

This node works both as:
- **Workflow Node**: Configure via UI parameters, outputs connect to other nodes
- **AI Agent Tool**: Connect to AI Agent's "Tool" handle for LLM-driven queries

## Guidelines

1. **Phone numbers**: Always use without + prefix, just digits (e.g., 919876543210)
2. **Groups**: Use JID format ending in @g.us
3. **Contact lookup**: Use list_contacts first if you only have a name
4. **Group participants**: Use get_group_info to see who's in a group with their names
5. **Profile pictures**: get_contact_info returns a URL that may expire
6. **Media URLs**: Must be publicly accessible URLs
7. **Pagination**: Use offset with limit to page through chat history

## Error Handling

- If recipient info is missing, use list_contacts or search_groups to find them
- If message type requires media URL but none provided, request the URL
- If location is requested but coordinates missing, ask for latitude and longitude
- If WhatsApp is not connected, inform the user to check connection status
