# Encrypted Credentials System

API keys, OAuth tokens, and other secrets in MachinaOS are stored in a separate encrypted SQLite database (`credentials.db`) using Fernet (AES-128-CBC + HMAC-SHA256). The encryption key is derived from a server-scoped config key using PBKDF2HMAC with 600,000 iterations, following the n8n pattern.

This document covers the encryption pipeline, the two separate credential systems (OAuth vs API keys), the single-point-of-access rule, and the multi-backend abstraction.

## Why a Separate Database

Credentials are isolated from the main `machina.db` for three reasons:

1. **Blast radius**: a dump of `machina.db` for debugging never contains secrets.
2. **Independent backups**: `credentials.db` can be excluded from snapshots and SQLite dumps.
3. **Backend pluggability**: the file-backed SQLite can be swapped for OS keyring or AWS Secrets Manager without touching workflow storage.

## Files

```
server/core/
|-- encryption.py              EncryptionService (Fernet + PBKDF2)
|-- credentials_database.py    CredentialsDatabase (async SQLite, salt storage)
|-- credential_backends.py     Multi-backend abstraction (Fernet / Keyring / AWS)
`-- config.py                  credential_backend, aws_secret_arn settings

server/services/
`-- auth.py                    AuthService (single access point, caching)
```

## Cryptographic Pipeline

```
API_KEY_ENCRYPTION_KEY (from .env)
          +
     salt (random 32 bytes, stored in credentials.db)
          |
          v
   PBKDF2HMAC-SHA256
   (600,000 iterations, OWASP 2024)
          |
          v
   urlsafe_b64encode -> 32-byte Fernet key
          |
          v
   Fernet cipher (held in memory for process lifetime)
          |
          v
   encrypt(plaintext) / decrypt(ciphertext)
```

- **AES-128-CBC** for confidentiality (Fernet's block cipher).
- **HMAC-SHA256** for authenticity (Fernet appends a MAC).
- **PKCS7 padding** (handled by Fernet).
- **600,000 iterations** is the OWASP 2024 recommendation for PBKDF2-SHA256.
- **Salt is 256 bits**, generated once on first startup, stored in `credentials.db`.

The derived Fernet key lives only in `EncryptionService._fernet` in process memory. It is never written to disk or to Redis.

## Lifecycle

```
Server startup (main.py lifespan)
    |
    v
CredentialsDatabase.initialize()  -> creates tables, returns existing or new salt
    |
    v
EncryptionService.initialize(password=API_KEY_ENCRYPTION_KEY, salt=<bytes>)
    |
    v
AuthService caches decrypted credentials in memory-only dicts
    |
    v
Routers call AuthService.get_api_key() / get_oauth_tokens() ...
    |
    v
(on shutdown) EncryptionService.clear() wipes the in-memory key
```

`EncryptionService.is_initialized()` is checked before any encrypt/decrypt call. If the server key is misconfigured, the service raises at startup rather than returning unusable ciphertext later.

## Two Separate Credential Systems

There are **two distinct storage paths** inside `credentials.db`, and they are not interchangeable. This is the most common source of bugs in this area.

### 1. API Key System

For secrets the user enters manually in the Credentials modal (OpenAI API key, Anthropic key, Google client ID, Google client secret, Twitter client secret, Brave Search key, etc.).

- Table: `EncryptedAPIKey`
- Access: `AuthService.store_api_key(provider, key, models=[...], session_id=...)` and `AuthService.get_api_key(provider)`
- Cache: `AuthService._api_key_cache: Dict[str, str]`

### 2. OAuth Token System

For tokens obtained via OAuth 2.0 flows (Google Workspace, Twitter/X, Claude.ai).

- Table: `EncryptedOAuthToken`
- Access: `AuthService.store_oauth_tokens(provider, access_token, refresh_token, ...)` and `AuthService.get_oauth_tokens(provider, customer_id="owner")`
- Cache: `AuthService._oauth_cache: Dict[str, Dict[str, Any]]`

### The Mistake to Avoid

Google access tokens live in the OAuth system, not the API key system. Reading them via `get_api_key("google_access_token")` returns None even if the user is fully logged in. All Google Workspace handlers must use `get_google_credentials()` from `server/services/handlers/google_auth.py`, which calls `get_oauth_tokens("google")` internally.

Twitter has the same split: `twitter_client_id` and `twitter_client_secret` are in the API key system, but `twitter_access_token` is in the OAuth system.

## Single Point of Access

**All credential operations must go through `AuthService`. Routers must never touch `CredentialsDatabase` directly.**

```python
# Correct:
from core.container import container
auth = container.auth_service()
tokens = await auth.get_oauth_tokens("google")

# Wrong (will not go through cache, will not respect backend abstraction):
credentials_db = get_credentials_db()
row = await credentials_db.query(...)
```

Enforcement:

- `AuthService` owns the Fernet cipher initialization.
- `AuthService` maintains the memory-only decryption cache.
- `CredentialsDatabase` is injected into `AuthService` and not exposed via DI to other services.

The in-memory cache is important: decrypting on every request would be slow, and writing decrypted values to Redis would defeat the encryption. Each `AuthService` instance caches decrypted credentials in process memory only, and `AuthService.clear_cache()` flushes them on demand (used by the logout handler).

## Multi-Backend Abstraction

For deployment flexibility, `credential_backends.py` defines an abstract interface that can be swapped via the `CREDENTIAL_BACKEND` env var.

```python
class CredentialBackend(ABC):
    async def store(self, key: str, value: str, metadata: Dict = None) -> bool
    async def retrieve(self, key: str) -> Optional[str]
    async def delete(self, key: str) -> bool
    def is_available(self) -> bool
```

| Backend | Use Case | Env var value |
|---|---|---|
| `FernetBackend` | Default; Fernet-encrypted SQLite | `fernet` |
| `KeyringBackend` | Desktop apps; Windows Credential Locker, macOS Keychain, Linux Secret Service | `keyring` |
| `AWSSecretsBackend` | Cloud deployments; AWS Secrets Manager | `aws` |

The factory `create_backend(settings, credentials_db)` returns the selected backend with automatic fallback to Fernet if the requested backend is unavailable (e.g. `boto3` not installed for AWS).

Optional dependencies for alternate backends:

```toml
[project.optional-dependencies]
keyring = ["keyring>=25.0.0"]
aws = ["boto3>=1.34.0"]
```

## Configuration

```env
# server/.env

# Required for Fernet backend
API_KEY_ENCRYPTION_KEY=<any string, at least 32 chars for good entropy>

# Which backend to use
CREDENTIAL_BACKEND=fernet         # fernet | keyring | aws

# Path to credentials SQLite file
CREDENTIALS_DB_PATH=credentials.db

# AWS backend only
AWS_SECRET_ARN=arn:aws:secretsmanager:...
AWS_REGION=us-east-1
```

If `API_KEY_ENCRYPTION_KEY` is missing or changed, existing ciphertext becomes undecryptable. There is no key-rotation mechanism today: users re-enter their keys after a key change. This is a deliberate simplification inherited from the n8n pattern.

## Security Properties

- **Server-scoped key**: not tied to user login sessions. JWT cookies expire, but the encryption key survives across restarts.
- **No plaintext on disk**: credentials are only decrypted in memory.
- **No plaintext in Redis**: even in Redis mode, only encrypted envelopes cross the wire (the cache layer never stores decrypted credentials).
- **Salt per install**: different MachinaOS installs have different salts, so ciphertext is not portable across installs even with the same server key.
- **Wipes on shutdown**: `EncryptionService.clear()` zeroes the Fernet reference, preventing cold-boot recovery of the derived key.

## Related Docs

- [DESIGN.md](DESIGN.md) - overall security posture
- [new_service_integration.md](new_service_integration.md) - where to put credentials for new service integrations
- [status_broadcaster.md](status_broadcaster.md) - WebSocket handlers for credentials (get/save/delete)
