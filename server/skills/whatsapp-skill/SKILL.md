---
name: whatsapp-skill
description: Send and receive WhatsApp messages, retrieve chat history. Supports text, images, videos, audio, documents, stickers, location, and contact cards.
allowed-tools: whatsapp_send whatsapp_chat_history
metadata:
  author: machina
  version: "2.0"
  category: messaging
---

# WhatsApp Messaging Skill

Send and receive WhatsApp messages using connected WhatsApp nodes.

## Capabilities

- Send text messages to phone numbers or groups
- Send media messages (images, videos, audio, documents, stickers)
- Send location information
- Send contact cards (vCard)
- Retrieve chat history from individual chats or groups
- Filter messages by type (all or text only)
- Paginate through message history

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

**Send contact card:**
```json
{
  "recipient_type": "phone",
  "phone": "1234567890",
  "message_type": "contact",
  "contact_name": "John Doe",
  "vcard": "BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL:+1234567890\nEND:VCARD"
}
```

## whatsapp_chat_history

Retrieve message history from chats.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chat_type | string | Yes | "individual" for 1:1 chat or "group" for group chat |
| phone | string | If individual | Phone number without + prefix |
| group_id | string | If group | Group JID (e.g., 123456789@g.us) |
| message_filter | string | No | "all" (default) or "text_only" |
| limit | int | No | Max messages to retrieve (1-500, default 50) |
| offset | int | No | Messages to skip for pagination (default 0) |

### Examples

**Get recent messages from contact:**
```json
{
  "chat_type": "individual",
  "phone": "1234567890",
  "limit": 20
}
```

**Get text-only messages from group:**
```json
{
  "chat_type": "group",
  "group_id": "123456789012345678@g.us",
  "message_filter": "text_only",
  "limit": 50
}
```

**Paginate through history:**
```json
{
  "chat_type": "individual",
  "phone": "1234567890",
  "limit": 50,
  "offset": 50
}
```

### Response Format

```json
{
  "success": true,
  "chat_type": "individual",
  "identifier": "1234567890",
  "messages": [
    {
      "sender": "1234567890",
      "text": "Hello!",
      "timestamp": "2025-01-27T10:30:00Z",
      "type": "text",
      "is_from_me": false
    }
  ],
  "total": 150,
  "has_more": true,
  "count": 50
}
```

## Guidelines

1. **Phone numbers**: Always use without + prefix, just digits (e.g., 1234567890)
2. **Groups**: Use JID format ending in @g.us
3. **Media URLs**: Must be publicly accessible URLs
4. **Location**: Both latitude and longitude are required
5. **Contact cards**: Use vCard 3.0 format
6. **Pagination**: Use offset with limit to page through results
7. **Message filter**: Use "text_only" to exclude media messages

## Error Handling

- If recipient info is missing, ask for the phone number or group ID
- If message type requires media URL but none provided, request the URL
- If location is requested but coordinates missing, ask for latitude and longitude
- If WhatsApp is not connected, inform the user to check connection status
