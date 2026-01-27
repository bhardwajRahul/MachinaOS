---
name: http-skill
description: Make HTTP requests to external APIs and web services. Use when user needs to fetch data from URLs, call APIs, or interact with web services.
allowed-tools: http-request
metadata:
  author: machina
  version: "2.0"
  category: integration
---

# HTTP Requests

This skill enables you to make HTTP requests to external APIs and web services.

## Capabilities

- Make GET, POST, PUT, DELETE, PATCH requests
- Send JSON payloads in request body
- Set custom headers (authentication, content-type, etc.)
- Handle API responses (JSON and text)

## Tool Reference

### http-request

Make an HTTP request to a URL.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | Full URL to request (e.g., `https://api.example.com/data`) |
| `method` | string | No | `GET` | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH` |
| `body` | object | No | null | Request body as JSON object (for POST/PUT/PATCH) |
| `headers` | object | No | null | Custom headers as key-value pairs |

**Returns:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | number | HTTP status code (200, 404, 500, etc.) |
| `data` | any | Response body (parsed JSON or text) |
| `headers` | object | Response headers |
| `url` | string | Final URL (may differ if redirected) |
| `method` | string | HTTP method used |

## Common Use Cases

### Fetching Data (GET)
```json
{
  "url": "https://api.example.com/users/123",
  "method": "GET"
}
```

### Creating Resources (POST)
```json
{
  "url": "https://api.example.com/users",
  "method": "POST",
  "body": {"name": "John", "email": "john@example.com"},
  "headers": {"Content-Type": "application/json"}
}
```

### Updating Resources (PUT/PATCH)
```json
{
  "url": "https://api.example.com/users/123",
  "method": "PUT",
  "body": {"name": "John Updated"}
}
```

### Deleting Resources (DELETE)
```json
{
  "url": "https://api.example.com/users/123",
  "method": "DELETE"
}
```

### With Authentication
```json
{
  "url": "https://api.example.com/protected",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer your-api-token",
    "X-API-Key": "your-api-key"
  }
}
```

## Examples

**User**: "Get the current Bitcoin price"
**Action**: Use http-request with:
```json
{
  "url": "https://api.coindesk.com/v1/bpi/currentprice.json",
  "method": "GET"
}
```

**User**: "Post this data to my webhook"
**Action**: Use http-request with:
```json
{
  "url": "https://webhook.example.com/endpoint",
  "method": "POST",
  "body": {"event": "user_action", "data": "..."},
  "headers": {"Content-Type": "application/json"}
}
```

**User**: "Check if example.com is up"
**Action**: Use http-request with:
```json
{
  "url": "https://example.com",
  "method": "GET"
}
```
Then check if status is 200.

**User**: "Get weather for New York"
**Action**: Use http-request with:
```json
{
  "url": "https://api.openweathermap.org/data/2.5/weather?q=New York&appid=YOUR_KEY",
  "method": "GET"
}
```

## Security Guidelines

1. **Never expose API keys** in responses to the user
2. **Validate URLs** - only request from trusted domains
3. **Don't make requests** to internal/private networks (localhost, 192.168.x.x, 10.x.x.x)
4. **Respect rate limits** of external services
5. **Handle errors gracefully** and inform the user clearly
6. **Don't store sensitive data** from API responses

## Error Handling

Common HTTP status codes and what they mean:

| Status | Meaning | Action |
|--------|---------|--------|
| 200-299 | Success | Process the response data |
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Check API key/authentication |
| 403 | Forbidden | Access denied, may need different permissions |
| 404 | Not Found | Check URL path |
| 429 | Too Many Requests | Rate limited, wait before retrying |
| 500-599 | Server Error | External service issue, try again later |

When an error occurs, inform the user about:
- What was attempted
- What went wrong (status code and message)
- Suggested next steps
