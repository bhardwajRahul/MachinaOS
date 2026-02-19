---
name: twitter-search-skill
description: Search for recent tweets on Twitter/X using keywords, hashtags, mentions, and advanced query operators.
allowed-tools: twitter_search
metadata:
  author: machina
  version: "1.0"
  category: social
  icon: "🔍"
  color: "#000000"
---

# Twitter Search Tool

Search for recent tweets on Twitter/X.

## How It Works

This skill provides instructions for the **Twitter Search** tool node. Connect the **Twitter Search** node to an AI Agent's `input-tools` handle to enable tweet searching.

## twitter_search Tool

Search for tweets matching a query.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Search query (supports operators) |
| max_results | integer | No | Number of results (10-100, default: 10) |

### Query Operators

The X API supports advanced search operators:

| Operator | Example | Description |
|----------|---------|-------------|
| keyword | `python` | Tweets containing the word |
| phrase | `"machine learning"` | Exact phrase match |
| hashtag | `#AI` | Tweets with hashtag |
| mention | `@username` | Tweets mentioning user |
| from | `from:elonmusk` | Tweets by specific user |
| to | `to:username` | Replies to user |
| -keyword | `-spam` | Exclude keyword |
| OR | `python OR javascript` | Either term |
| lang | `lang:en` | Language filter |
| has:links | `AI has:links` | Tweets with URLs |
| has:media | `sunset has:media` | Tweets with media |
| is:retweet | `bitcoin is:retweet` | Only retweets |
| -is:retweet | `news -is:retweet` | Exclude retweets |

### Examples

**Simple keyword search:**
```json
{
  "query": "artificial intelligence",
  "max_results": 20
}
```

**Search with hashtag:**
```json
{
  "query": "#MachineLearning",
  "max_results": 50
}
```

**Search tweets from a user:**
```json
{
  "query": "from:OpenAI",
  "max_results": 10
}
```

**Complex query:**
```json
{
  "query": "AI (startup OR company) -is:retweet lang:en",
  "max_results": 100
}
```

**Search with media:**
```json
{
  "query": "sunset has:media",
  "max_results": 25
}
```

### Response Format

```json
{
  "success": true,
  "result": {
    "tweets": [
      {
        "id": "1234567890123456789",
        "text": "Exciting developments in AI...",
        "author_id": "987654321",
        "created_at": "2025-02-19T10:30:00Z"
      }
    ],
    "count": 20,
    "query": "#AI"
  },
  "execution_time": 0.82
}
```

### Error Response

```json
{
  "success": false,
  "error": "Search query is required",
  "execution_time": 0.01
}
```

## Guidelines

1. **Query length**: Keep queries concise for better results
2. **Max results**: Limited to 100 per request (API constraint)
3. **Recent tweets only**: X API v2 free tier searches recent tweets (last 7 days)
4. **Rate limits**: Be mindful of API rate limits when searching repeatedly
5. **Combine operators**: Use multiple operators for precise filtering

## Common Use Cases

- Monitor brand mentions
- Track trending topics
- Find tweets about specific subjects
- Research competitor activity
- Gather content for curation
- Find influencers discussing topics

## Setup Requirements

1. Connect the **Twitter Search** node to an AI Agent's `input-tools` handle
2. Ensure Twitter is connected (authenticated via OAuth in Credentials Modal)
3. Your X Developer account must have appropriate API access level
