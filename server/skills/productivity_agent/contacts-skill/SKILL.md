---
name: contacts-skill
description: Create, list, and search Google Contacts. Supports names, emails, phone numbers, and organizations.
allowed-tools: contacts_create contacts_list contacts_search
metadata:
  author: machina
  version: "1.0"
  category: productivity
  icon: "👥"
  color: "#4285F4"
---

# Google Contacts Skill

Manage Google Contacts - create, list, and search contacts.

## Available Tools

### contacts_create

Create a new contact.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| first_name | string | Yes | Contact's first name |
| last_name | string | No | Contact's last name |
| email | string | No | Email address |
| phone | string | No | Phone number |
| company | string | No | Company/organization name |
| job_title | string | No | Job title |
| notes | string | No | Notes about contact |

**Example - Basic contact:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john.smith@example.com",
  "phone": "+1-555-123-4567"
}
```

**Example - Full contact:**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@company.com",
  "phone": "+1-555-987-6543",
  "company": "Acme Corporation",
  "job_title": "Senior Engineer",
  "notes": "Met at tech conference 2024"
}
```

**Response:**
```json
{
  "success": true,
  "resource_name": "people/c1234567890",
  "display_name": "John Smith",
  "email": "john.smith@example.com",
  "phone": "+1-555-123-4567"
}
```

### contacts_list

List contacts from your address book.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| page_size | integer | No | Results per page (default: 20, max: 100) |
| page_token | string | No | Token for next page |
| sort_order | string | No | Sort by: LAST_MODIFIED_ASCENDING, LAST_MODIFIED_DESCENDING, FIRST_NAME_ASCENDING, LAST_NAME_ASCENDING |

**Example - List contacts:**
```json
{
  "page_size": 50,
  "sort_order": "FIRST_NAME_ASCENDING"
}
```

**Response:**
```json
{
  "contacts": [
    {
      "resource_name": "people/c1234567890",
      "display_name": "Alice Johnson",
      "email": "alice@example.com",
      "phone": "+1-555-111-2222",
      "company": "Tech Corp",
      "job_title": "Product Manager"
    },
    {
      "resource_name": "people/c0987654321",
      "display_name": "Bob Williams",
      "email": "bob@example.com",
      "phone": "+1-555-333-4444"
    }
  ],
  "count": 2,
  "next_page_token": "..."
}
```

### contacts_search

Search contacts by name or email.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Search query (name or email) |
| page_size | integer | No | Results per page (default: 10, max: 30) |

**Example - Search by name:**
```json
{
  "query": "John"
}
```

**Example - Search by email domain:**
```json
{
  "query": "@company.com"
}
```

**Response:**
```json
{
  "contacts": [
    {
      "resource_name": "people/c1234567890",
      "display_name": "John Smith",
      "email": "john.smith@example.com",
      "phone": "+1-555-123-4567",
      "company": "Example Inc"
    }
  ],
  "count": 1
}
```

## Contact Fields

| Field | Description |
|-------|-------------|
| `resource_name` | Unique identifier (people/cXXX) |
| `display_name` | Full formatted name |
| `first_name` | Given name |
| `last_name` | Family name |
| `email` | Primary email address |
| `phone` | Primary phone number |
| `company` | Organization name |
| `job_title` | Position/title |
| `notes` | Free-form notes |

## Phone Number Formats

Accepted formats:
- `+1-555-123-4567` (international)
- `(555) 123-4567` (US format)
- `555-123-4567` (simple)
- `5551234567` (digits only)

## Common Workflows

1. **Add new contact**: Create with basic info after meeting someone
2. **Find contact**: Search by name to get their details
3. **Build mailing list**: List contacts, filter by company
4. **Update CRM**: Export contacts for business use

## Tips

- Search is case-insensitive
- Partial matches work for names
- Email search matches any part of address
- Use page_token for pagination through large lists

## Setup Requirements

1. Connect Contacts nodes to AI Agent's `input-tools` handle
2. Authenticate with Google Workspace in Credentials Modal
3. Ensure People API (Contacts) scopes are authorized
