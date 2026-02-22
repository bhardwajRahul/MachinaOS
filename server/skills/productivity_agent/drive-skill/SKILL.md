---
name: drive-skill
description: Upload, download, list, and share Google Drive files. Supports folders, file search, and permission management.
allowed-tools: drive_upload drive_download drive_list drive_share
metadata:
  author: machina
  version: "1.0"
  category: productivity
  icon: "📁"
  color: "#0F9D58"
---

# Google Drive Skill

Manage Google Drive files - upload, download, list, and share.

## Available Tools

### drive_upload

Upload a file to Google Drive.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_url | string | Yes* | URL of file to upload |
| file_content | string | Yes* | Base64 encoded file content |
| filename | string | Yes | Name for the uploaded file |
| folder_id | string | No | Destination folder ID (default: root) |
| mime_type | string | No | File MIME type (auto-detected if not provided) |

*Either `file_url` OR `file_content` is required.

**Example - Upload from URL:**
```json
{
  "file_url": "https://example.com/report.pdf",
  "filename": "Q4_Report.pdf",
  "folder_id": "1abc123def456"
}
```

**Example - Upload with content:**
```json
{
  "file_content": "SGVsbG8gV29ybGQh...",
  "filename": "notes.txt",
  "mime_type": "text/plain"
}
```

**Response:**
```json
{
  "success": true,
  "file_id": "1xyz789abc",
  "name": "Q4_Report.pdf",
  "web_link": "https://drive.google.com/file/d/1xyz789abc/view",
  "size": 102400
}
```

### drive_download

Download a file from Google Drive.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_id | string | Yes | File ID to download |
| output_path | string | No | Local path to save file |

**Example:**
```json
{
  "file_id": "1xyz789abc"
}
```

**Response:**
```json
{
  "success": true,
  "file_id": "1xyz789abc",
  "name": "report.pdf",
  "mime_type": "application/pdf",
  "size": 102400,
  "content": "base64_encoded_content..."
}
```

### drive_list

List files in Google Drive.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| folder_id | string | No | Folder ID (default: root) |
| query | string | No | Search query |
| max_results | integer | No | Maximum results (default: 10, max: 100) |
| file_types | string | No | Filter by MIME types (comma-separated) |

**Query Syntax:**
- `name contains 'report'` - Files with "report" in name
- `mimeType = 'application/pdf'` - PDF files only
- `modifiedTime > '2024-01-01'` - Recently modified
- `'folder_id' in parents` - Files in specific folder
- `trashed = false` - Exclude trashed files

**Example - List folder contents:**
```json
{
  "folder_id": "1abc123def456",
  "max_results": 20
}
```

**Example - Search for PDFs:**
```json
{
  "query": "name contains 'invoice' and mimeType = 'application/pdf'",
  "max_results": 50
}
```

**Response:**
```json
{
  "files": [
    {
      "id": "1xyz789abc",
      "name": "invoice_001.pdf",
      "mime_type": "application/pdf",
      "size": 51200,
      "created_time": "2024-01-15T10:30:00Z",
      "modified_time": "2024-01-15T10:30:00Z",
      "web_link": "https://drive.google.com/file/d/1xyz789abc/view"
    }
  ],
  "count": 1,
  "next_page_token": "..."
}
```

### drive_share

Share a file with specific users.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_id | string | Yes | File ID to share |
| email | string | Yes | Email address to share with |
| role | string | No | Permission role (default: reader) |
| send_notification | boolean | No | Send email notification (default: true) |

**Roles:**
- `reader` - View only
- `commenter` - View and comment
- `writer` - View, comment, and edit

**Example:**
```json
{
  "file_id": "1xyz789abc",
  "email": "colleague@example.com",
  "role": "writer"
}
```

**Response:**
```json
{
  "success": true,
  "file_id": "1xyz789abc",
  "shared_with": "colleague@example.com",
  "role": "writer",
  "share_link": "https://drive.google.com/file/d/1xyz789abc/view?usp=sharing"
}
```

## Common MIME Types

| Type | MIME Type |
|------|-----------|
| PDF | `application/pdf` |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Excel | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| PowerPoint | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| Google Doc | `application/vnd.google-apps.document` |
| Google Sheet | `application/vnd.google-apps.spreadsheet` |
| Folder | `application/vnd.google-apps.folder` |

## Common Workflows

1. **Backup files**: Upload local files to Drive folder
2. **Share report**: Upload file, then share with team
3. **Find files**: List with search query
4. **Download for processing**: Download, process locally, re-upload

## Setup Requirements

1. Connect Drive nodes to AI Agent's `input-tools` handle
2. Authenticate with Google Workspace in Credentials Modal
3. Ensure Drive API scopes are authorized
