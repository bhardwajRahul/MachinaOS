---
name: code-skill
description: Execute Python or JavaScript code for calculations, data processing, and automation. Use when user needs to run code, do calculations, or process data.
allowed-tools: python_code javascript_code
metadata:
  author: machina
  version: "3.0"
  category: code
  icon: "💻"
  color: "#F59E0B"
---

# Code Execution

This skill enables you to execute Python and JavaScript code for various tasks using the `python_code` and `javascript_code` tools.

## Tool: python_code

Execute Python code for calculations, data processing, and automation.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Python code to execute. Set `output` variable with result. Use `print()` for console output. |

### Available Libraries
- Standard library: `math`, `json`, `datetime`, `timedelta`, `re`, `random`
- Collections: `Counter`, `defaultdict`
- All built-in functions

### Variables Available
- `input_data` - Data from connected workflow nodes (dict)
- `output` - Set this variable to return a result

### Returns

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether execution succeeded |
| `result` | any | Value of `output` variable if set |
| `output` | string | Captured print() statements |
| `error` | string | Error message if execution failed |

### Example Usage
```python
# Calculate with data
data = input_data.get("numbers", [1, 2, 3])
total = sum(data)
average = total / len(data)
print(f"Total: {total}, Average: {average}")
output = {"total": total, "average": average}
```

---

## Tool: javascript_code

Execute JavaScript code for calculations, data processing, and JSON manipulation.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | JavaScript code to execute. Set `output` variable with result. Use `console.log()` for output. |

### Variables Available
- `input_data` - Data from connected workflow nodes (object)
- `output` - Set this variable to return a result

### Returns

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether execution succeeded |
| `result` | any | Value of `output` variable if set |
| `output` | string | Captured console.log() statements |
| `error` | string | Error message if execution failed |

### Example Usage
```javascript
// Process JSON data
const data = input_data.numbers || [1, 2, 3];
const total = data.reduce((a, b) => a + b, 0);
const average = total / data.length;
console.log(`Total: ${total}, Average: ${average}`);
output = { total, average };
```

---

## Examples

### Calculate a tip (Python)
**User**: "Calculate 15% tip on $85.50"

**Tool Call** (python_code):
```json
{
  "code": "bill = 85.50\ntip_percent = 15\ntip = bill * (tip_percent / 100)\ntotal = bill + tip\nprint(f\"Tip: ${tip:.2f}\")\nprint(f\"Total: ${total:.2f}\")\noutput = {\"tip\": tip, \"total\": total}"
}
```

### Generate random numbers (Python)
**User**: "Generate 5 random numbers between 1 and 100"

**Tool Call** (python_code):
```json
{
  "code": "import random\nnumbers = [random.randint(1, 100) for _ in range(5)]\nprint(f\"Random numbers: {numbers}\")\noutput = numbers"
}
```

### Process JSON data (JavaScript)
**User**: "Sum all the values in this object"

**Tool Call** (javascript_code):
```json
{
  "code": "const values = Object.values(input_data);\nconst sum = values.reduce((a, b) => a + b, 0);\nconsole.log(`Sum: ${sum}`);\noutput = sum;"
}
```

### Date calculations (Python)
**User**: "What date is 30 days from now?"

**Tool Call** (python_code):
```json
{
  "code": "from datetime import datetime, timedelta\ntoday = datetime.now()\nfuture = today + timedelta(days=30)\nresult = future.strftime('%Y-%m-%d')\nprint(f\"30 days from now: {result}\")\noutput = result"
}
```

### Array manipulation (JavaScript)
**User**: "Filter this array to only even numbers"

**Tool Call** (javascript_code):
```json
{
  "code": "const numbers = input_data.numbers || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\nconst evens = numbers.filter(n => n % 2 === 0);\nconsole.log(`Even numbers: ${evens}`);\noutput = evens;"
}
```

---

## When to Use Each Tool

| Use Case | Recommended Tool |
|----------|------------------|
| Math calculations | `python_code` |
| Date/time operations | `python_code` |
| Data analysis | `python_code` |
| Random number generation | `python_code` |
| JSON manipulation | `javascript_code` |
| Array operations | Either |
| String processing | Either |

---

## Security Guidelines

1. **No file system access** outside designated directories
2. **No network requests** from code (use http-skill instead)
3. **No system commands** or shell access
4. **Limited execution time** (timeout configurable, default 30 seconds)
5. **No sensitive data** in code outputs

## Best Practices

1. Keep code simple and focused on one task
2. Use descriptive variable names
3. Always set the `output` variable with your result
4. Use `print()` / `console.log()` for debugging
5. Handle potential errors gracefully
6. Prefer Python for math, dates, and data processing
7. Prefer JavaScript for JSON manipulation
