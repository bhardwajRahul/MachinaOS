---
name: http-skill
description: Make HTTP requests to external APIs and web services. Use when user needs to fetch data from URLs, call APIs, or interact with web services.
allowed-tools: http-request
metadata:
  author: machina
  version: "1.0"
  category: integration
---

# HTTP Requests

This skill enables you to make HTTP requests to external APIs and web services.

## Capabilities

- Make GET, POST, PUT, DELETE, PATCH requests
- Send JSON payloads
- Set custom headers
- Handle API responses

## Tool Reference

### http-request
Make an HTTP request to a URL.

Parameters:
- `url` (required): Full URL to request
- `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH). Default: GET
- `body` (optional): Request body as JSON object
- `headers` (optional): Custom headers as key-value pairs
- `timeout` (optional): Timeout in milliseconds (default: 30000)

Returns:
- status: HTTP status code
- body: Response body
- headers: Response headers

## Common Use Cases

### Fetching Data
```
GET https://api.example.com/data
```

### Creating Resources
```
POST https://api.example.com/items
Body: {"name": "New Item", "value": 100}
```

### Updating Resources
```
PUT https://api.example.com/items/123
Body: {"name": "Updated Item"}
```

## Examples

**User**: "Get the current Bitcoin price"
**Action**: Use http-request with:
- url: "https://api.coindesk.com/v1/bpi/currentprice.json"
- method: "GET"

**User**: "Post this data to my webhook"
**Action**: Use http-request with:
- url: "[user's webhook URL]"
- method: "POST"
- body: {"data": "..."}

**User**: "Check if example.com is up"
**Action**: Use http-request with:
- url: "https://example.com"
- method: "GET"

## Security Guidelines

1. **Never expose API keys** in responses
2. **Validate URLs** before making requests
3. **Don't make requests** to internal/private networks
4. **Respect rate limits** of external services
5. **Handle errors gracefully** and inform the user

## Error Handling

Common HTTP status codes:
- 200: Success
- 400: Bad request (check parameters)
- 401: Unauthorized (check API key)
- 403: Forbidden (access denied)
- 404: Not found
- 429: Too many requests (rate limited)
- 500: Server error (try again later)
