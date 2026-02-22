---
name: sheets-skill
description: Read, write, and append data to Google Sheets spreadsheets. Supports cell ranges, formulas, and batch operations.
allowed-tools: sheets_read sheets_write sheets_append
metadata:
  author: machina
  version: "1.0"
  category: productivity
  icon: "📊"
  color: "#0F9D58"
---

# Google Sheets Skill

Read and write data to Google Sheets spreadsheets.

## Available Tools

### sheets_read

Read data from a spreadsheet range.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| spreadsheet_id | string | Yes | Spreadsheet ID from URL |
| range | string | Yes | A1 notation range (e.g., "Sheet1!A1:D10") |

**How to find Spreadsheet ID:**
From URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

**Range Notation (A1):**
- `Sheet1!A1:D10` - Specific range on Sheet1
- `Sheet1!A:D` - Entire columns A through D
- `Sheet1!1:10` - Rows 1 through 10
- `A1:D10` - Default sheet, specific range
- `Sheet1` - Entire sheet

**Example:**
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A1:E10"
}
```

**Response:**
```json
{
  "success": true,
  "range": "Sheet1!A1:E10",
  "values": [
    ["Name", "Email", "Department", "Start Date", "Status"],
    ["Alice", "alice@example.com", "Engineering", "2023-01-15", "Active"],
    ["Bob", "bob@example.com", "Marketing", "2023-03-20", "Active"]
  ],
  "rows": 3,
  "columns": 5
}
```

### sheets_write

Write data to a specific range (overwrites existing data).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| spreadsheet_id | string | Yes | Spreadsheet ID |
| range | string | Yes | A1 notation range |
| values | array | Yes | 2D array of values |
| value_input_option | string | No | How to interpret values (default: USER_ENTERED) |

**Value Input Options:**
- `USER_ENTERED` - Parse values as if typed by user (formulas work)
- `RAW` - Store values as-is (no parsing)

**Example - Write data:**
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A1:C3",
  "values": [
    ["Name", "Score", "Grade"],
    ["Alice", 95, "A"],
    ["Bob", 87, "B"]
  ]
}
```

**Example - Write formula:**
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!D2",
  "values": [["=SUM(B2:C2)"]],
  "value_input_option": "USER_ENTERED"
}
```

**Response:**
```json
{
  "success": true,
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "updated_range": "Sheet1!A1:C3",
  "updated_rows": 3,
  "updated_columns": 3,
  "updated_cells": 9
}
```

### sheets_append

Append rows to the end of a table.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| spreadsheet_id | string | Yes | Spreadsheet ID |
| range | string | Yes | Table range (e.g., "Sheet1!A:E") |
| values | array | Yes | 2D array of rows to append |
| value_input_option | string | No | How to interpret values (default: USER_ENTERED) |
| insert_data_option | string | No | How to insert (default: INSERT_ROWS) |

**Insert Options:**
- `INSERT_ROWS` - Insert new rows for data
- `OVERWRITE` - Overwrite existing data after table

**Example - Append new rows:**
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A:E",
  "values": [
    ["Charlie", "charlie@example.com", "Sales", "2024-02-01", "Active"],
    ["Diana", "diana@example.com", "HR", "2024-02-15", "Active"]
  ]
}
```

**Response:**
```json
{
  "success": true,
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "updated_range": "Sheet1!A4:E5",
  "appended_rows": 2
}
```

## Common Formulas

| Formula | Description |
|---------|-------------|
| `=SUM(A1:A10)` | Sum of range |
| `=AVERAGE(B1:B10)` | Average of range |
| `=COUNT(A:A)` | Count numbers in column |
| `=COUNTA(A:A)` | Count non-empty cells |
| `=VLOOKUP(E1,A:C,2,FALSE)` | Vertical lookup |
| `=IF(A1>90,"A","B")` | Conditional logic |
| `=TODAY()` | Current date |
| `=NOW()` | Current date and time |

## Common Workflows

1. **Import data**: Write headers, then append data rows
2. **Update records**: Read to find row, write to specific cells
3. **Generate reports**: Read data, process, write summary
4. **Log entries**: Append new rows with timestamps

## Tips

- Always check spreadsheet exists before writing
- Use `USER_ENTERED` for formulas to work
- Range must match data dimensions
- Append is safer than write for adding data

## Setup Requirements

1. Connect Sheets nodes to AI Agent's `input-tools` handle
2. Authenticate with Google Workspace in Credentials Modal
3. Ensure Sheets API scopes are authorized
4. Spreadsheet must be accessible to authenticated account
