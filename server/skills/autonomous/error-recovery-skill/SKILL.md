---
name: error-recovery-skill
description: Handle errors gracefully with retry strategies and fallback patterns
allowed-tools: delegate_to_ai_agent python_code check_delegated_tasks
metadata:
  author: machina
  version: "1.0"
  category: autonomous
  icon: "🛡️"
  color: "#EF4444"
---
# Error Recovery Pattern

You are an agent that handles errors gracefully through retry strategies, alternative approaches, and graceful degradation.

## Error Classification

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR CATEGORIES                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TRANSIENT (Retry)          RECOVERABLE (Alternative)       │
│  ─────────────────          ────────────────────────        │
│  • Network timeout          • Missing data → try another    │
│  • Rate limit (429)         • Format error → parse differ   │
│  • Service busy (503)       • Partial failure → use partial │
│  • Connection reset         • Auth expired → re-auth        │
│                                                              │
│  PERMANENT (Report)         CRITICAL (Escalate)             │
│  ──────────────────         ───────────────────             │
│  • Not found (404)          • Security violation            │
│  • Permission denied (403)  • Data corruption               │
│  • Invalid input (400)      • System failure                │
│  • Resource deleted (410)   • Unrecoverable state           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Retry Strategy

For transient errors, use exponential backoff:

```
┌─────────────────────────────────────────────────────────────┐
│                 EXPONENTIAL BACKOFF                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Attempt 1 ──▶ FAIL ──▶ Wait 1 second                      │
│                              │                               │
│                              ▼                               │
│   Attempt 2 ──▶ FAIL ──▶ Wait 2 seconds                     │
│                              │                               │
│                              ▼                               │
│   Attempt 3 ──▶ FAIL ──▶ Wait 4 seconds                     │
│                              │                               │
│                              ▼                               │
│   Attempt 4 ──▶ FAIL ──▶ Report failure                     │
│                                                              │
│   Formula: wait_time = 2^(attempt - 1) seconds              │
│   Max attempts: 4 (configurable)                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Code Mode Retry Implementation

```python
import json
import time

def with_retry(operation, max_attempts=4):
    """Execute operation with exponential backoff retry."""
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            result = operation()
            return {"success": True, "result": result, "attempts": attempt}
        except Exception as e:
            last_error = str(e)

            # Check if error is retryable
            if is_permanent_error(e):
                return {
                    "success": False,
                    "error": last_error,
                    "error_type": "permanent",
                    "attempts": attempt
                }

            # Wait before retry (exponential backoff)
            if attempt < max_attempts:
                wait_time = 2 ** (attempt - 1)
                time.sleep(wait_time)

    return {
        "success": False,
        "error": last_error,
        "error_type": "transient_exhausted",
        "attempts": max_attempts
    }

def is_permanent_error(e):
    """Check if error is permanent (should not retry)."""
    error_msg = str(e).lower()
    permanent_indicators = [
        "not found", "404",
        "permission denied", "403", "forbidden",
        "invalid", "400", "bad request",
        "unauthorized", "401"
    ]
    return any(indicator in error_msg for indicator in permanent_indicators)

# Usage
result = with_retry(lambda: risky_operation())
print(json.dumps(result, indent=2))
```

## Alternative Approach Pattern

When the primary approach fails, try alternatives:

```
┌─────────────────────────────────────────────────────────────┐
│                 ALTERNATIVE APPROACHES                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Primary: API call to service A                            │
│       │                                                     │
│       ▼                                                     │
│   FAILED (service down)                                     │
│       │                                                     │
│       ▼                                                     │
│   Alternative 1: Try service B (backup API)                 │
│       │                                                     │
│       ▼                                                     │
│   FAILED (rate limited)                                     │
│       │                                                     │
│       ▼                                                     │
│   Alternative 2: Use cached data                            │
│       │                                                     │
│       ▼                                                     │
│   SUCCESS (stale but available)                             │
│       │                                                     │
│       ▼                                                     │
│   Return with warning: "Data may be outdated"               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Self-Delegation for Retry

Use delegation to retry with a different approach:

```json
{
  "task": "Retry: Get weather data using alternative source",
  "context": "Attempt: 2/3
Error: Primary weather API timeout
Previous approach: OpenWeatherMap API
New approach: Try WeatherAPI.com or use cached forecast
Original request: Weather for New York"
}
```

## Graceful Degradation

When full success isn't possible, return partial results:

```
┌─────────────────────────────────────────────────────────────┐
│                 GRACEFUL DEGRADATION                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Request: "Get user profile with posts and followers"      │
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │   Profile   │  │    Posts    │  │  Followers  │        │
│   │   SUCCESS   │  │   FAILED    │  │   SUCCESS   │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│   Response:                                                  │
│   {                                                          │
│     "profile": { ... },      // Full data                   │
│     "posts": null,           // Unavailable                 │
│     "posts_error": "Service temporarily unavailable",       │
│     "followers": [ ... ],    // Full data                   │
│     "partial": true,         // Indicates degraded response │
│     "degraded_fields": ["posts"]                            │
│   }                                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Code Mode Graceful Degradation

```python
import json

def fetch_user_data(user_id):
    """Fetch user data with graceful degradation."""
    result = {
        "user_id": user_id,
        "partial": False,
        "errors": []
    }

    # Try to get profile (required)
    try:
        result["profile"] = get_profile(user_id)
    except Exception as e:
        # Profile is required - cannot degrade
        return {
            "success": False,
            "error": f"Cannot fetch required profile: {e}"
        }

    # Try to get posts (optional, can degrade)
    try:
        result["posts"] = get_posts(user_id)
    except Exception as e:
        result["posts"] = None
        result["errors"].append(f"posts: {e}")
        result["partial"] = True

    # Try to get followers (optional, can degrade)
    try:
        result["followers"] = get_followers(user_id)
    except Exception as e:
        result["followers"] = None
        result["errors"].append(f"followers: {e}")
        result["partial"] = True

    return {"success": True, "data": result}

# Simulated functions
def get_profile(uid): return {"name": "John", "email": "john@example.com"}
def get_posts(uid): raise Exception("Service unavailable")
def get_followers(uid): return [{"id": 1, "name": "Jane"}]

output = fetch_user_data("user_123")
print(json.dumps(output, indent=2))
```

## Error Recovery in Agentic Loops

When an iteration fails in an agentic loop:

```
┌─────────────────────────────────────────────────────────────┐
│              LOOP ERROR RECOVERY                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Iteration 2: FAILED                                       │
│       │                                                     │
│       ▼                                                     │
│   Classify Error                                            │
│       │                                                     │
│       ├──▶ Transient? ──▶ Retry same iteration             │
│       │                                                     │
│       ├──▶ Recoverable? ──▶ Try alternative approach       │
│       │                                                     │
│       └──▶ Permanent? ──▶ Skip or report                   │
│                                                              │
│   Continue to Iteration 3 with updated context:            │
│   "Iteration 2 failed: [reason]. Proceeding with           │
│    partial results from Iteration 1."                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Delegation with Error Context

```json
{
  "task": "Continue: Process remaining items (skip failed)",
  "context": "Iteration: 3/5
Progress: Processed items 1-5, item 3 failed (invalid format)
State: Results for items [1,2,4,5] available
Error handling: Skipping item 3, continuing with remaining
Next: Process items 6-10"
}
```

## Error Reporting Best Practices

### What to Include

```
┌─────────────────────────────────────────────────────────────┐
│                 ERROR REPORT STRUCTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. WHAT failed                                            │
│      "Failed to send WhatsApp message"                      │
│                                                              │
│   2. WHY it failed                                          │
│      "Recipient phone number not registered on WhatsApp"    │
│                                                              │
│   3. WHAT was tried                                         │
│      "Attempted 3 times with exponential backoff"           │
│                                                              │
│   4. WHAT can be done                                       │
│      "Try a different contact method (SMS, email) or        │
│       verify the phone number is correct"                   │
│                                                              │
│   5. PARTIAL results (if any)                               │
│      "Message was prepared but not delivered"               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Example Error Response

```json
{
  "success": false,
  "error": {
    "type": "delivery_failed",
    "message": "Failed to send WhatsApp message",
    "reason": "Recipient not on WhatsApp",
    "attempts": 3,
    "recovery_attempted": true,
    "partial_result": {
      "message_prepared": true,
      "recipient_validated": false
    }
  },
  "suggestions": [
    "Verify the phone number format (+1234567890)",
    "Try sending via SMS instead",
    "Check if recipient has WhatsApp installed"
  ]
}
```

## Anti-Patterns to Avoid

### 1. Silent Failures
```
// Never do this
try:
    result = risky_operation()
except:
    pass  // Error swallowed silently

// Always report
try:
    result = risky_operation()
except Exception as e:
    return {"success": False, "error": str(e)}
```

### 2. Infinite Retry
```
// Never do this
while True:
    try:
        result = operation()
        break
    except:
        continue  // Infinite loop

// Always limit attempts
for attempt in range(MAX_ATTEMPTS):
    ...
```

### 3. Retry Permanent Errors
```
// Never retry these
- 404 Not Found
- 403 Forbidden
- 401 Unauthorized
- 400 Bad Request

// Only retry these
- 429 Too Many Requests
- 503 Service Unavailable
- 504 Gateway Timeout
- Connection errors
```

### 4. Lose Context on Error
```
// Never do this
except Exception:
    return "An error occurred"

// Preserve context
except Exception as e:
    return f"Failed at step {step}: {e}. Progress: {progress}"
```
