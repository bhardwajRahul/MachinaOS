---
name: twitter-user-skill
description: Look up Twitter/X user profiles, get authenticated user info, and retrieve followers/following lists.
allowed-tools: twitter_user
metadata:
  author: machina
  version: "1.0"
  category: social
  icon: "👤"
  color: "#000000"
---

# Twitter User Tool

Look up user profiles and social connections on Twitter/X.

## How It Works

This skill provides instructions for the **Twitter User** tool node. Connect the **Twitter User** node to an AI Agent's `input-tools` handle to enable user lookups.

## twitter_user Tool

Retrieve user information and social connections.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | Operation type: `me`, `by_username`, `by_id`, `followers`, `following` |
| username | string | If by_username | Twitter username (without @) |
| user_id | string | If by_id/followers/following | Twitter user ID |
| max_results | integer | No | For followers/following (default: 100, max: 1000) |

### Operations

| Operation | Required Fields | Description |
|-----------|-----------------|-------------|
| `me` | none | Get authenticated user's profile |
| `by_username` | username | Look up user by username |
| `by_id` | user_id | Look up user by ID |
| `followers` | user_id (optional) | Get user's followers (defaults to authenticated user) |
| `following` | user_id (optional) | Get accounts user follows (defaults to authenticated user) |

### Examples

**Get my profile:**
```json
{
  "operation": "me"
}
```

**Look up user by username:**
```json
{
  "operation": "by_username",
  "username": "elonmusk"
}
```

**Look up user by ID:**
```json
{
  "operation": "by_id",
  "user_id": "44196397"
}
```

**Get my followers:**
```json
{
  "operation": "followers",
  "max_results": 100
}
```

**Get accounts I follow:**
```json
{
  "operation": "following",
  "max_results": 50
}
```

**Get another user's followers:**
```json
{
  "operation": "followers",
  "user_id": "44196397",
  "max_results": 200
}
```

### Response Format - Single User

```json
{
  "success": true,
  "result": {
    "user": {
      "id": "44196397",
      "username": "elonmusk",
      "name": "Elon Musk",
      "profile_image_url": "https://pbs.twimg.com/...",
      "verified": true
    }
  },
  "execution_time": 0.35
}
```

### Response Format - User List

```json
{
  "success": true,
  "result": {
    "followers": {
      "users": [
        {
          "id": "123456789",
          "username": "user1",
          "name": "User One",
          "profile_image_url": "https://...",
          "verified": false
        }
      ],
      "count": 100
    }
  },
  "execution_time": 1.2
}
```

### Error Response

```json
{
  "success": false,
  "error": "Username is required",
  "execution_time": 0.01
}
```

## Guidelines

1. **Usernames**: Provide without the @ symbol (e.g., `elonmusk` not `@elonmusk`)
2. **User IDs**: Use the numeric ID string
3. **Rate limits**: Follower/following endpoints have lower rate limits
4. **Max results**: Limited to 1000 per request for followers/following
5. **Pagination**: For large accounts, results are paginated (first page returned)

## Common Use Cases

- Get your own profile information
- Look up profiles of users you interact with
- Check if users are verified
- Analyze follower/following relationships
- Build lists of relevant accounts

## Setup Requirements

1. Connect the **Twitter User** node to an AI Agent's `input-tools` handle
2. Ensure Twitter is connected (authenticated via OAuth in Credentials Modal)
3. Your X Developer account must have appropriate API access level
