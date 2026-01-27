---
name: code-skill
description: Execute Python or JavaScript code for calculations, data processing, and automation. Use when user needs to run code, do calculations, or process data.
allowed-tools: code-python code-javascript
metadata:
  author: machina
  version: "1.0"
  category: code
---

# Code Execution

This skill enables you to execute Python and JavaScript code for various tasks.

## Capabilities

- Run Python code with full standard library
- Execute JavaScript code
- Perform complex calculations
- Process and transform data
- Generate outputs and visualizations

## Tool Reference

### code-python
Execute Python code.

Parameters:
- `code` (required): Python code to execute
- `input_data` (optional): Data to pass to the script (available as `input_data` variable)

Returns:
- output: Script output (print statements)
- result: Return value if any
- error: Error message if execution failed

### code-javascript
Execute JavaScript code.

Parameters:
- `code` (required): JavaScript code to execute
- `input_data` (optional): Data to pass to the script

Returns:
- output: Console output
- result: Return value
- error: Error message if execution failed

## Python Guidelines

### Available Libraries
- Standard library (math, json, datetime, re, etc.)
- Data processing (collections, itertools)
- String manipulation

### Input Data Access
```python
# Access input data from previous nodes
data = input_data  # Available as global variable
print(f"Received: {data}")
```

### Output
```python
# Print for output display
print("Hello, World!")

# Return value for downstream nodes
result = {"status": "success", "value": 42}
```

## JavaScript Guidelines

### Input Data Access
```javascript
// Access input data from previous nodes
const data = input_data;
console.log(`Received: ${JSON.stringify(data)}`);
```

### Output
```javascript
// Console for output display
console.log("Hello, World!");

// Return value for downstream nodes
return { status: "success", value: 42 };
```

## Examples

**User**: "Calculate 15% tip on $85.50"
**Action**: Use code-python with:
```python
bill = 85.50
tip_percent = 15
tip = bill * (tip_percent / 100)
total = bill + tip
print(f"Tip: ${tip:.2f}")
print(f"Total: ${total:.2f}")
```

**User**: "Convert this JSON to CSV"
**Action**: Use code-python with:
```python
import json
import csv
import io

data = input_data  # JSON from previous node
output = io.StringIO()
writer = csv.DictWriter(output, fieldnames=data[0].keys())
writer.writeheader()
writer.writerows(data)
print(output.getvalue())
```

**User**: "Generate 5 random numbers between 1 and 100"
**Action**: Use code-python with:
```python
import random
numbers = [random.randint(1, 100) for _ in range(5)]
print(f"Random numbers: {numbers}")
```

## Security Guidelines

1. **No file system access** outside designated directories
2. **No network requests** from code (use http-skill instead)
3. **No system commands** or shell access
4. **Limited execution time** (timeout after 30 seconds)
5. **No sensitive data** in code outputs

## Best Practices

1. Keep code simple and focused on one task
2. Use descriptive variable names
3. Add comments for complex logic
4. Validate input data before processing
5. Handle potential errors gracefully
