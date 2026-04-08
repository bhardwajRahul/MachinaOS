---
name: browser-skill
description: Interactive browser automation - navigate, click, type, fill forms, take screenshots, get accessibility snapshots.
allowed-tools: browser
metadata:
  author: machina
  version: "1.0"
  category: web
  icon: "🌐"
  color: "#8be9fd"
---

# Browser Automation Skill

## Core Workflow

Use the **snapshot -> act -> snapshot** loop:

1. `navigate` to a URL
2. `snapshot` to see interactive elements (returns `@eN` refs)
3. `click` / `type` / `fill` / `select` using `@eN` refs as selectors
4. `snapshot` again to see the result
5. Repeat until task is complete

## browser Tool

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | One of: navigate, click, type, fill, screenshot, snapshot, get_text, get_html, eval, wait, scroll, select |
| url | string | navigate | URL to open |
| selector | string | click/type/fill/get_text/get_html/wait/select | CSS selector or `@eN` ref from snapshot |
| text | string | type | Text to type keystroke by keystroke |
| value | string | fill/select | Value to fill or dropdown option to select |
| expression | string | eval | JavaScript to execute in page context |
| direction | string | scroll | up, down, left, right (default: down) |
| amount | int | scroll | Pixels to scroll (default: 500) |
| fullPage | bool | screenshot | Capture full scrollable page (default: false) |

## Operations

### navigate
Open a URL in the browser.
```json
{"operation": "navigate", "url": "https://example.com"}
```

### snapshot
Get the accessibility tree with `@eN` element refs. This is the primary way to see what is on the page.
```json
{"operation": "snapshot"}
```
Returns interactive elements like:
```
- heading "Example Domain" [ref=@e1]
- link "More information..." [ref=@e2]
- textbox "Search" [ref=@e3]
```

### click
Click an element using its `@eN` ref or CSS selector.
```json
{"operation": "click", "selector": "@e2"}
```

### type
Type text into an element keystroke by keystroke.
```json
{"operation": "type", "selector": "@e3", "text": "search query"}
```

### fill
Clear an input field and fill it with a value.
```json
{"operation": "fill", "selector": "@e3", "value": "new value"}
```

### screenshot
Take a screenshot of the current page.
```json
{"operation": "screenshot", "fullPage": true}
```

### get_text
Extract text content from an element.
```json
{"operation": "get_text", "selector": "@e1"}
```

### eval
Execute JavaScript in the page context.
```json
{"operation": "eval", "expression": "document.title"}
```

### wait
Wait for an element to appear on the page.
```json
{"operation": "wait", "selector": "#results"}
```

### scroll
Scroll the page.
```json
{"operation": "scroll", "direction": "down", "amount": 500}
```

### select
Select a dropdown option.
```json
{"operation": "select", "selector": "@e5", "value": "option-value"}
```

## Stealth / Anti-Detection

The browser node supports configurable settings to reduce bot detection:

- **Action Delay**: Set `actionDelay` (ms) in node parameters to add a native wait before each action. Simulates human pacing.
- **User Agent**: Set `userAgent` to a custom string to override the default Chrome user agent.
- **Proxy**: Set `proxy` to route all browser traffic through a proxy (e.g. `http://user:pass@host:port`).

These are configured in the node's Advanced section, not as tool arguments.

## Tips

- Always use `snapshot` first to discover element refs before interacting.
- Prefer `@eN` refs over CSS selectors -- they are stable across the session.
- Use `fill` for form inputs (clears first), `type` for search boxes (keystroke events).
- Use `screenshot` to visually verify the page state when uncertain.
- Use `wait` before interacting with elements that load dynamically.
- Use `eval` sparingly -- prefer snapshot + click/fill for most tasks.
- Set `actionDelay` to 500-2000ms when interacting with bot-protected sites.
