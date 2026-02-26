# Onboarding Service

## Overview

The onboarding service provides a multi-step welcome wizard that appears after a user's first launch, guiding them through platform capabilities, key concepts, API key setup, UI layout, and getting started. It is database-backed, skippable, resumable, and replayable from Settings.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Dashboard.tsx                           │
│  ┌────────────────────────────────────────────────────────┐    │
│  │               OnboardingWizard.tsx                      │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │  useOnboarding(reopenTrigger)                  │    │    │
│  │  │  - Checks onboarding_completed via WebSocket   │    │    │
│  │  │  - Manages step navigation + persistence       │    │    │
│  │  └───────────────┬────────────────────────────────┘    │    │
│  │                  │                                      │    │
│  │  ┌───────┬───────┼───────┬──────────┐                  │    │
│  │  │Step 0 │Step 1 │Step 2 │Step 3    │Step 4            │    │
│  │  │Welcome│Concept│APIKey │Canvas    │GetStarted         │    │
│  │  └───────┴───────┴───────┴──────────┘                  │    │
│  │                                                         │    │
│  │  Modal (Radix UI) + Steps (Ant Design)                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  SettingsPanel.tsx → "Replay Welcome Guide" button             │
│    └── onReplayOnboarding → increments reopenTrigger           │
└────────────────────────────────────────────────────────────────┘
          │                              │
          │ WebSocket                    │ WebSocket
          ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│  server/routers/websocket.py                                  │
│  - get_user_settings → returns onboarding_completed, step    │
│  - save_user_settings → persists onboarding_completed, step  │
│                                                               │
│  server/core/database.py                                      │
│  - _migrate_user_settings() adds columns + marks existing    │
│    users (examples_loaded=1) as onboarding_completed=1       │
│                                                               │
│  server/models/database.py                                    │
│  - UserSettings.onboarding_completed: bool                    │
│  - UserSettings.onboarding_step: int                          │
└──────────────────────────────────────────────────────────────┘
```

## Database Schema

### UserSettings Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `onboarding_completed` | `bool` | `False` | Whether onboarding was completed or skipped |
| `onboarding_step` | `int` | `0` | Last completed step (for resuming mid-wizard) |

### Migration

In `server/core/database.py` `_migrate_user_settings()`:

```python
if "onboarding_completed" not in columns:
    await conn.execute(text(
        "ALTER TABLE user_settings ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0"
    ))
    # Existing users (examples_loaded=1) skip onboarding
    await conn.execute(text(
        "UPDATE user_settings SET onboarding_completed = 1 WHERE examples_loaded = 1"
    ))

if "onboarding_step" not in columns:
    await conn.execute(text(
        "ALTER TABLE user_settings ADD COLUMN onboarding_step INTEGER DEFAULT 0"
    ))
```

**Existing user handling**: The migration marks all rows with `examples_loaded=1` as `onboarding_completed=1`, so returning users never see the wizard.

## Frontend File Structure

```
client/src/
├── components/
│   └── onboarding/
│       ├── OnboardingWizard.tsx        # Main wizard modal orchestrator
│       └── steps/
│           ├── WelcomeStep.tsx          # Step 0: Platform intro
│           ├── ConceptsStep.tsx         # Step 1: Nodes, Edges, Agents, Skills, Modes
│           ├── ApiKeyStep.tsx           # Step 2: AI provider key setup
│           ├── CanvasStep.tsx           # Step 3: UI layout tour
│           └── GetStartedStep.tsx       # Step 4: First workflow tips
└── hooks/
    └── useOnboarding.ts                # State management + WebSocket persistence
```

## Components

### useOnboarding Hook

**Location**: `client/src/hooks/useOnboarding.ts`

Custom hook managing the full onboarding lifecycle:

```typescript
export const useOnboarding = (reopenTrigger?: number) => {
  // Returns:
  // - isVisible: boolean       - Whether wizard should render
  // - currentStep: number      - Active step index (0-4)
  // - isCompleted: boolean     - Whether already completed/skipped
  // - isLoading: boolean       - WebSocket check in progress
  // - hasChecked: boolean      - Initial check done
  // - totalSteps: number       - Always 5
  // - nextStep(): void         - Advance to next step (or complete if last)
  // - prevStep(): void         - Go back one step
  // - skip(): void             - Skip onboarding entirely
  // - complete(): void         - Mark as completed
};
```

**Key behaviors**:
- On WebSocket connect, calls `get_user_settings` to check `onboarding_completed` (once, using `hasCheckedRef`)
- Each step transition calls `save_user_settings` to persist progress
- `reopenTrigger` prop change resets state and reopens wizard from step 0
- StrictMode-safe via `hasCheckedRef` pattern (same as Dashboard.tsx)

### OnboardingWizard

**Location**: `client/src/components/onboarding/OnboardingWizard.tsx`

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `onOpenCredentials` | `() => void` | Opens CredentialsModal (passed from Dashboard) |
| `reopenTrigger` | `number?` | Incrementing counter triggers wizard reopen |

**UI Structure**:
- Uses existing `Modal` component (`maxWidth="680px"`, `maxHeight="85vh"`)
- Ant Design `Steps` component for progress indicator
- Step content rendered via switch on `currentStep`
- Footer: "Skip for now" (left) | "Back" + "Next"/"Start Building" (right)
- Button colors: Next = `dracula.purple`, final "Start Building" = `dracula.green`
- Only renders when `isVisible && hasChecked && !isLoading`

### Step Components

All steps use Ant Design components (`Typography`, `Card`, `Tag`, `Space`, `Button`, `Alert`, `Row`, `Col`) and `@ant-design/icons` for consistent theming.

| Step | Component | Title | Purpose | Ant Design Components |
|------|-----------|-------|---------|----------------------|
| 0 | `WelcomeStep` | Welcome to MachinaOs | Platform intro + feature highlights | `Card`, `Row`, `Col`, `Typography` |
| 1 | `ConceptsStep` | Key Concepts | Nodes, Edges, Agents, Skills, Normal/Dev Mode | `Space`, `Typography` |
| 2 | `ApiKeyStep` | API Key Setup | Provider list + "Open Credentials" button | `Button`, `Alert`, `Space` |
| 3 | `CanvasStep` | Canvas Tour | Visual UI layout diagram + shortcuts | `Tag`, `Space`, `Typography` |
| 4 | `GetStartedStep` | Get Started | Example workflows, quick recipe, tips | `Card`, `Tag`, `Space` |

**ApiKeyStep** accepts an `onOpenCredentials` prop to link to the existing CredentialsModal without duplicating key input logic.

## Integration Points

### Dashboard.tsx

```typescript
// State for replay trigger
const [onboardingReopenTrigger, setOnboardingReopenTrigger] = React.useState(0);

// SettingsPanel gets replay callback
<SettingsPanel
  onReplayOnboarding={() => {
    setSettingsOpen(false);
    setOnboardingReopenTrigger(prev => prev + 1);
  }}
/>

// OnboardingWizard rendered after CredentialsModal
<OnboardingWizard
  onOpenCredentials={() => setCredentialsOpen(true)}
  reopenTrigger={onboardingReopenTrigger}
/>
```

### SettingsPanel.tsx

Added `onReplayOnboarding?: () => void` prop and a "Help" section with:
- `QuestionCircleOutlined` icon header
- "Replay Welcome Guide" button styled with `dracula.cyan`
- Description text

## WebSocket Handlers

No new handlers were needed. The onboarding system reuses existing generic handlers:

| Handler | Usage |
|---------|-------|
| `get_user_settings` | Check `onboarding_completed` and `onboarding_step` on connect |
| `save_user_settings` | Persist step progress on each navigation, skip, or complete |

## Lifecycle

### First Launch (New User)

1. User opens app, WebSocket connects
2. `useOnboarding` calls `get_user_settings` -- no settings exist yet
3. `onboarding_completed` defaults to `false`, `onboarding_step` defaults to `0`
4. Wizard opens at step 0
5. User navigates steps -- each transition saves via `save_user_settings`
6. On "Start Building" or "Skip for now", `onboarding_completed` set to `true`
7. Wizard closes, does not reappear on refresh

### Existing User (Database Migration)

1. Server starts, `_migrate_user_settings()` runs
2. Adds `onboarding_completed` column, sets to `1` where `examples_loaded = 1`
3. User opens app, `useOnboarding` checks -- sees `onboarding_completed = true`
4. Wizard does not appear

### Resume Mid-Wizard

1. User advances to step 3, closes browser
2. `onboarding_step = 3` was saved on last navigation
3. User reopens app, `useOnboarding` reads `step = 3, completed = false`
4. Wizard opens at step 3

### Replay from Settings

1. User opens Settings, clicks "Replay Welcome Guide"
2. `onReplayOnboarding()` callback fires:
   - Closes SettingsPanel
   - Increments `onboardingReopenTrigger`
3. `useOnboarding` detects trigger change:
   - Resets `hasCheckedRef` to allow re-check
   - Sets `isVisible = true, currentStep = 0`
4. Wizard opens from step 0

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Auth disabled (`VITE_AUTH_ENABLED=false`) | Works unchanged -- reads from `user_id="default"` |
| WebSocket not connected yet | Hook waits for `isConnected`, `isLoading=true` prevents render |
| Browser closed mid-wizard | `onboarding_step` saved on each transition, resumes from last step |
| Multiple tabs | Completing in one tab doesn't update others until refresh |
| Replay from Settings | Resets backend state and reopens wizard from step 0 |
| Fresh database (no machina.db) | Onboarding appears after first WebSocket connect |

## Verification Checklist

1. **Fresh database**: Delete `server/machina.db`, start server -- wizard appears
2. **Step navigation**: Click through all 5 steps -- progress bar updates, Back/Next work
3. **Skip**: Click "Skip for now" -- wizard closes, doesn't reappear on refresh
4. **Resume**: Advance to step 3, close browser, reopen -- wizard resumes at step 3
5. **Complete**: Finish all steps via "Start Building" -- wizard doesn't reappear
6. **API Key step**: Click "Open Credentials" button -- CredentialsModal opens
7. **Existing user migration**: With existing `machina.db` where `examples_loaded=1` -- onboarding does NOT appear
8. **Theme support**: Toggle dark/light mode -- all onboarding UI adapts correctly
9. **Replay**: Open Settings, click "Replay Welcome Guide" -- wizard reopens from step 0
10. **TypeScript**: `npx tsc --noEmit` passes clean

## Key Files

| File | Description |
|------|-------------|
| `client/src/hooks/useOnboarding.ts` | Onboarding state hook with WebSocket persistence |
| `client/src/components/onboarding/OnboardingWizard.tsx` | Main wizard modal with Ant Design Steps |
| `client/src/components/onboarding/steps/WelcomeStep.tsx` | Step 0: Platform introduction |
| `client/src/components/onboarding/steps/ConceptsStep.tsx` | Step 1: Key concepts (Nodes, Edges, Agents) |
| `client/src/components/onboarding/steps/ApiKeyStep.tsx` | Step 2: API key setup with Credentials link |
| `client/src/components/onboarding/steps/CanvasStep.tsx` | Step 3: UI layout diagram + shortcuts |
| `client/src/components/onboarding/steps/GetStartedStep.tsx` | Step 4: Getting started tips |
| `client/src/Dashboard.tsx` | Integration: renders wizard + passes replay trigger |
| `client/src/components/ui/SettingsPanel.tsx` | Replay button in Help section |
| `server/models/database.py` | `UserSettings.onboarding_completed`, `onboarding_step` fields |
| `server/core/database.py` | Migration + CRUD for onboarding fields |

## Adding New Steps

To add a new onboarding step:

1. Create `client/src/components/onboarding/steps/NewStep.tsx` using Ant Design components
2. Import in `OnboardingWizard.tsx` and add to the `renderStep()` switch
3. Add entry to `stepItems` array
4. Update `TOTAL_STEPS` in `useOnboarding.ts`
5. No backend changes needed (step index is just a number)
