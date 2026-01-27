---
name: whatsapp-skill
description: Send and receive WhatsApp messages. Use when user mentions WhatsApp, messaging, texting someone, or wants to send a message to a phone number.
allowed-tools: whatsapp-send whatsapp-status
metadata:
  author: machina
  version: "1.0"
  category: communication
---

# WhatsApp Messaging

This skill enables you to send WhatsApp messages to contacts and groups.

## Capabilities

- Send text messages to phone numbers
- Send messages to groups
- Check WhatsApp connection status

## Usage

### Sending Messages

When the user wants to send a message:

1. **Extract the recipient**: Phone number (with country code) or contact name
2. **Extract the message**: The content to send
3. **Use the whatsapp-send tool** with the extracted information

### Phone Number Format

- Always use international format with country code
- Example: +1234567890 (US), +447123456789 (UK)
- Remove spaces and dashes from numbers

## Tool Reference

### whatsapp-send
Send a message via WhatsApp.

Parameters:
- `phone_number` (required): Recipient phone number with country code
- `message` (required): Message text to send

### whatsapp-status
Check WhatsApp connection status.

Parameters: None

## Examples

**User**: "Send a WhatsApp to +1234567890 saying I'll be late"
**Action**: Use whatsapp-send with:
- phone_number: "+1234567890"
- message: "I'll be late"

**User**: "Text John that the meeting is at 3pm"
**Response**: I need John's phone number to send the message. Could you provide his number with the country code?

**User**: "Is WhatsApp connected?"
**Action**: Use whatsapp-status to check connection

## Error Handling

- If WhatsApp is not connected, inform the user and suggest checking the connection
- If phone number is invalid, ask for the correct format
- If message fails to send, provide the error and suggest retrying
