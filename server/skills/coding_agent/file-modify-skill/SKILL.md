---
name: file-modify-skill
description: Write new files or edit existing files with string replacement.
allowed-tools: file_modify
metadata:
  author: machina
  version: "1.0"
  category: filesystem
  icon: "\u270F\uFE0F"
  color: "#50fa7b"
---

# File Modify Tool

Write new files or edit existing files with exact string replacement. Uses deepagents filesystem backend.

## file_modify Tool

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | `write` (create/overwrite) or `edit` (find and replace) |
| file_path | string | Yes | Path to the file |
| content | string | If write | Full file content to write |
| old_string | string | If edit | Exact text to find and replace |
| new_string | string | If edit | Replacement text |
| replace_all | boolean | No | Replace all occurrences (default: false, old_string must be unique) |

### Examples

**Write a new file:**
```json
{
  "operation": "write",
  "file_path": "/path/to/new_file.py",
  "content": "print('hello world')"
}
```

**Edit an existing file:**
```json
{
  "operation": "edit",
  "file_path": "/path/to/file.py",
  "old_string": "def old_name():",
  "new_string": "def new_name():"
}
```

**Replace all occurrences:**
```json
{
  "operation": "edit",
  "file_path": "/path/to/file.py",
  "old_string": "TODO",
  "new_string": "DONE",
  "replace_all": true
}
```

### Response Format

**Write:**
```json
{"operation": "write", "file_path": "/path/to/file.py"}
```

**Edit:**
```json
{"operation": "edit", "file_path": "/path/to/file.py", "occurrences": 1}
```

### Guidelines

1. Use `write` to create new files or overwrite existing ones
2. Use `edit` for surgical string replacement in existing files
3. For edit: `old_string` must be unique in the file unless `replace_all` is true
4. Prefer `edit` over `write` when modifying existing files
5. Read the file first before editing to ensure correct context
