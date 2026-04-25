# Skill Creation Guide

This guide explains how to create new skills for MachinaOs.

## Folder Structure

Skills are organized in subfolders under `server/skills/`:

```
server/skills/
├── GUIDE.md                  # This file
├── assistant/                # General-purpose assistant skills
│   ├── assistant-personality/SKILL.md
│   ├── compaction-skill/SKILL.md
│   ├── humanify-skill/SKILL.md
│   ├── memory-skill/SKILL.md
│   └── subagent-skill/SKILL.md
├── android_agent/            # Android device control skills
│   ├── personality/SKILL.md
│   ├── battery-skill/SKILL.md
│   ├── wifi-skill/SKILL.md
│   ├── bluetooth-skill/SKILL.md
│   ├── location-skill/SKILL.md
│   ├── app-launcher-skill/SKILL.md
│   ├── app-list-skill/SKILL.md
│   ├── audio-skill/SKILL.md
│   ├── screen-control-skill/SKILL.md
│   ├── camera-skill/SKILL.md
│   ├── motion-skill/SKILL.md
│   └── environmental-skill/SKILL.md
├── autonomous/               # Autonomous agent patterns
│   ├── code-mode-skill/SKILL.md
│   ├── agentic-loop-skill/SKILL.md
│   ├── progressive-discovery-skill/SKILL.md
│   ├── error-recovery-skill/SKILL.md
│   └── multi-tool-orchestration-skill/SKILL.md
├── coding_agent/             # Code execution skills
│   ├── python-skill/SKILL.md
│   └── javascript-skill/SKILL.md
├── productivity_agent/       # Google Workspace skills
│   ├── gmail-skill/SKILL.md
│   ├── calendar-skill/SKILL.md
│   ├── drive-skill/SKILL.md
│   ├── sheets-skill/SKILL.md
│   ├── tasks-skill/SKILL.md
│   └── contacts-skill/SKILL.md
├── social_agent/             # Social messaging skills
│   ├── whatsapp-send-skill/SKILL.md
│   ├── whatsapp-db-skill/SKILL.md
│   ├── twitter-send-skill/SKILL.md
│   ├── twitter-search-skill/SKILL.md
│   └── twitter-user-skill/SKILL.md
├── task_agent/               # Task management skills
│   ├── timer-skill/SKILL.md
│   ├── cron-scheduler-skill/SKILL.md
│   └── task-manager-skill/SKILL.md
├── travel_agent/             # Location and maps skills
│   ├── geocoding-skill/SKILL.md
│   └── nearby-places-skill/SKILL.md
└── web_agent/                # Web automation skills
    ├── web-search-skill/SKILL.md
    └── http-request-skill/SKILL.md
```

Each top-level folder (e.g. `assistant`, `android`) appears as an option in the Master Skill node's folder dropdown. Skills inside are discovered recursively via `SKILL.md` files.

## Creating a New Skill

### 1. Create the skill directory

```
server/skills/<folder>/<skill-name>/SKILL.md
```

- `<folder>` - Group folder (use an existing one or create a new one)
- `<skill-name>` - Lowercase with hyphens (e.g. `my-new-skill`)

### 2. Write the SKILL.md file

Every skill requires a single `SKILL.md` file with YAML frontmatter followed by markdown instructions:

```markdown
---
name: my-new-skill
description: Brief description visible to the LLM when listing available skills
allowed-tools: tool1 tool2
metadata:
  author: your-name
  version: "1.0"
  category: general
---

# My New Skill

Instructions for the AI model go here. Write in clear markdown.
The AI reads these instructions when the skill is activated.

## What This Skill Does

Describe the skill's capabilities.

## How to Use

Provide usage guidelines, examples, and constraints.
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Lowercase, hyphens only. Must match pattern `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description` | Yes | One-line summary shown in skill lists and to the LLM |
| `allowed-tools` | No | Space-delimited list of tool names. The first that resolves to a known node is the skill's visual source — its icon/color come from `server/nodes/visuals.json` via the `_visuals` handler. |
| `metadata` | No | Arbitrary key-value pairs (author, version, category). **Do NOT set `icon` or `color`** — those are resolved automatically from the target node so the skill always mirrors the canvas. |

### Name Format Rules

- Lowercase letters and numbers only
- Words separated by single hyphens
- No consecutive hyphens
- Examples: `my-skill`, `web-search-skill`, `code-skill`
- Invalid: `My_Skill`, `my--skill`, `MySkill`

## Optional Supporting Files

Skills can include additional files that are loaded alongside the main instructions:

```
server/skills/assistant/my-new-skill/
├── SKILL.md              # Required: main skill file
├── scripts/              # Optional: code snippets
│   ├── helper.py
│   └── utils.js
└── references/           # Optional: reference documents
    ├── api-docs.md
    ├── config.json
    └── examples.txt
```

- **scripts/**: All files loaded as text, available to the AI as code context
- **references/**: Only `.md`, `.txt`, `.json` files loaded as reference material

## Creating a New Folder Group

To create a new skill group (appears as a new option in the folder dropdown):

1. Create a directory under `server/skills/`:
   ```
   mkdir server/skills/my-group
   ```

2. Add at least one skill with a `SKILL.md` file inside it:
   ```
   mkdir server/skills/my-group/my-skill
   # Create SKILL.md with frontmatter + instructions
   ```

3. The folder will automatically appear in the Master Skill node dropdown.

## How Skills Are Used

1. **Master Skill Node**: Select a folder from the dropdown. Enable/disable individual skills with checkboxes. Edit instructions inline.

2. **Individual Skill Nodes**: Each built-in skill also has a dedicated node in the Component Palette (e.g. WhatsApp Skill, Memory Skill). These connect directly to an AI Agent's skill handle.

3. **At Execution Time**: When the AI Agent runs, enabled skills' instructions are injected into the system prompt, giving the AI context about its available capabilities.

## Skill Content Lifecycle

1. **First Load**: Instructions are read from the `SKILL.md` file on disk
2. **Seeded to DB**: On first activation, instructions are saved to the database
3. **DB is Source of Truth**: Subsequent loads read from the database
4. **Customization**: Users can edit instructions in the UI. Edits are saved to DB only
5. **Reset**: "Reset to Default" reloads from the original `SKILL.md` file on disk
