---
name: memory-skill
description: Remember information across conversations. Use when user asks you to remember something, recall previous information, or manage conversation history.
allowed-tools: memory-save memory-get memory-clear
metadata:
  author: machina
  version: "1.0"
  category: memory
---

# Memory Management

This skill enables you to save and recall information across conversations using short-term and long-term memory.

## Memory Types

### Short-term Memory (Buffer)
- Keeps recent conversation context
- Automatically managed by the system
- Limited to recent messages

### Long-term Memory (Session)
- Persists information across conversations
- Explicitly saved by you or the user
- Organized by session ID

## Capabilities

- Save important information for later recall
- Retrieve previously saved information
- Clear memory when no longer needed
- Track conversation topics and preferences

## When to Use Memory

Save information when the user:
- Says "remember this" or "don't forget"
- Shares personal preferences
- Provides important context for future use
- Asks you to track something

Recall information when the user:
- Asks "do you remember..."
- References previous conversations
- Needs context from earlier discussions

## Tool Reference

### memory-save
Save information to long-term memory.

Parameters:
- `key` (required): Identifier for the memory
- `value` (required): Information to remember
- `session_id` (optional): Session for organization

### memory-get
Retrieve saved information.

Parameters:
- `key` (required): Identifier to look up
- `session_id` (optional): Specific session to search

### memory-clear
Clear memory entries.

Parameters:
- `key` (optional): Specific key to clear, or all if not specified
- `session_id` (optional): Specific session to clear

## Examples

**User**: "Remember that my favorite color is blue"
**Action**: Use memory-save with:
- key: "user_preference_color"
- value: "blue"

**User**: "What's my favorite color?"
**Action**: Use memory-get with:
- key: "user_preference_color"

**User**: "Forget everything about my preferences"
**Action**: Use memory-clear with:
- key: "user_preference_*" (wildcard pattern)

## Best Practices

1. Use descriptive keys for easy retrieval
2. Group related information under session IDs
3. Don't store sensitive information without consent
4. Periodically review and clean up old memories
