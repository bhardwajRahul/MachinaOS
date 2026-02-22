# Python Backend - Environment Setup

## Quick Start

1. Copy the template to create your .env file:
```bash
cp .env.template .env
```

2. Edit `.env` and add your API keys:
```bash
# Required for remote Android devices
WEBSOCKET_API_KEY=your-actual-key-here

# Optional: Default API keys (users can also add these through the UI)
GOOGLE_MAPS_API_KEY=your-google-maps-key
OPENAI_API_KEY=your-openai-key
```

3. Start the server:
```bash
python main.py
```

## Environment Variables

### Required

- `SECRET_KEY` - Server encryption key (32+ characters)
- `API_KEY_ENCRYPTION_KEY` - API key encryption (32+ characters)

### Optional but Recommended

- `WEBSOCKET_API_KEY` - Required for remote Android device connections
- `GOOGLE_MAPS_API_KEY` - Default Google Maps API key
- `OPENAI_API_KEY` - Default OpenAI API key
- `ANTHROPIC_API_KEY` - Default Anthropic API key
- `GOOGLE_AI_API_KEY` - Default Google AI API key

### Service URLs

- `WEBSOCKET_URL` - WebSocket server URL (default: ws://www.disutopia.xyz/ws)
- `WHATSAPP_SERVICE_URL` - WhatsApp service URL (default: http://localhost:3012)

### Development vs Production

The `.env.template` file contains development-safe defaults.

For production:
1. Change `DEBUG=false`
2. Generate new secure `SECRET_KEY` and `API_KEY_ENCRYPTION_KEY`
3. Set `RATE_LIMIT_ENABLED=true`
4. Configure proper CORS origins
5. Consider enabling Redis caching

## Security Notes

**NEVER commit `.env` files to git!**

The `.env.template` file is safe to commit because it contains no real credentials.

All API keys should be:
- Stored in `.env` files (ignored by git)
- Or set as environment variables
- Or managed through the UI (stored encrypted in database)

## Files

- `.env` - Your local configuration (git-ignored, created from template)
- `.env.template` - Template with safe defaults (committed to git)
- `.env.example` - Full example with all options (committed to git)
- `.env.development` - Development environment (git-ignored)
- `.env.production` - Production environment (git-ignored)

## Google Workspace Integration

Google Workspace services (Gmail, Calendar, Drive, Sheets, Tasks, Contacts) share a single OAuth connection.

### Setup

1. Create a Google Cloud project and enable the required APIs
2. Create OAuth 2.0 credentials (Web Application type)
3. Add credentials via the Credentials Modal in the UI
4. Click "Login with Google" to authenticate

### Environment Variables (Optional)

```bash
# Custom OAuth redirect URI (defaults to localhost:3010)
GOOGLE_REDIRECT_URI=http://localhost:3010/api/google/callback
```

### Token Storage

All Google tokens use the `google_*` prefix:
- `google_client_id` - OAuth Client ID
- `google_client_secret` - OAuth Client Secret
- `google_access_token` - Access token for API calls
- `google_refresh_token` - Refresh token for renewal
- `google_user_info` - Connected user email and name

### API Handlers

| Service | Handler File | Node Types |
|---------|-------------|------------|
| Gmail | `handlers/gmail.py` | gmailSend, gmailSearch, gmailRead, gmailReceive |
| Calendar | `handlers/calendar.py` | calendarCreate, calendarList, calendarUpdate, calendarDelete |
| Drive | `handlers/drive.py` | driveUpload, driveDownload, driveList, driveShare |
| Sheets | `handlers/sheets.py` | sheetsRead, sheetsWrite, sheetsAppend |
| Tasks | `handlers/tasks.py` | tasksCreate, tasksList, tasksComplete |
| Contacts | `handlers/contacts.py` | contactsCreate, contactsList, contactsSearch |

### AI Agent Skills

Skills for AI agents are in `server/skills/productivity_agent/`:
- gmail-skill, calendar-skill, drive-skill, sheets-skill, tasks-skill, contacts-skill
