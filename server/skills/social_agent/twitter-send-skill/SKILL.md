---
name: twitter-send-skill
description: Post tweets, reply to tweets, retweet, like/unlike, and delete tweets on Twitter/X.
allowed-tools: twitter_send
metadata:
  author: machina
  version: "1.0"
  category: social
  icon: "📤"
  color: "#000000"
---

# Twitter Send Tool

Post and interact with tweets on Twitter/X.

## How It Works

This skill provides instructions for the **Twitter Send** tool node. Connect the **Twitter Send** node to an AI Agent's `input-tools` handle to enable posting and interactions.

## twitter_send Tool

Send tweets, replies, retweets, likes, and deletions.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | Action type: `tweet`, `reply`, `retweet`, `like`, `unlike`, `delete` |
| text | string | If tweet/reply | Tweet text content (max 280 characters) |
| tweet_id | string | If retweet/like/unlike/delete | Target tweet ID |
| reply_to_id | string | If reply | Tweet ID to reply to |

### Actions

| Action | Required Fields | Description |
|--------|-----------------|-------------|
| `tweet` | text | Post a new tweet |
| `reply` | text, reply_to_id | Reply to an existing tweet |
| `retweet` | tweet_id | Retweet an existing tweet |
| `like` | tweet_id | Like a tweet |
| `unlike` | tweet_id | Remove like from a tweet |
| `delete` | tweet_id | Delete your own tweet |

### Examples

**Post a tweet:**
```json
{
  "action": "tweet",
  "text": "Hello Twitter! This is my first automated tweet."
}
```

**Reply to a tweet:**
```json
{
  "action": "reply",
  "text": "Thanks for sharing this!",
  "reply_to_id": "1234567890123456789"
}
```

**Retweet:**
```json
{
  "action": "retweet",
  "tweet_id": "1234567890123456789"
}
```

**Like a tweet:**
```json
{
  "action": "like",
  "tweet_id": "1234567890123456789"
}
```

**Unlike a tweet:**
```json
{
  "action": "unlike",
  "tweet_id": "1234567890123456789"
}
```

**Delete a tweet:**
```json
{
  "action": "delete",
  "tweet_id": "1234567890123456789"
}
```

### Response Format

```json
{
  "success": true,
  "result": {
    "data": {
      "id": "1234567890123456789",
      "text": "Hello Twitter!"
    },
    "action": "tweet_sent"
  },
  "execution_time": 0.45
}
```

### Error Response

```json
{
  "success": false,
  "error": "Tweet text is required",
  "execution_time": 0.01
}
```

## Guidelines

1. **Character limit**: Tweets are limited to 280 characters
2. **Tweet IDs**: Use the numeric ID string (e.g., `1234567890123456789`)
3. **Rate limits**: X API has rate limits - avoid rapid posting
4. **Content policy**: Follow X's content policies and terms of service
5. **Threading**: Use reply action with reply_to_id to create threads

## Common Use Cases

- Post automated updates and announcements
- Reply to mentions or specific tweets
- Like tweets matching certain criteria
- Create tweet threads by chaining replies
- Engage with followers programmatically

## Setup Requirements

1. Connect the **Twitter Send** node to an AI Agent's `input-tools` handle
2. Ensure Twitter is connected (authenticated via OAuth in Credentials Modal)
3. Your X Developer account must have appropriate API access level
