import { useState, useCallback, useEffect } from 'react';
import {
  useUserSettingsQuery,
  useSaveUserSettingsMutation,
} from './useUserSettingsQuery';

export interface OnboardingState {
  isVisible: boolean;
  currentStep: number;
  isCompleted: boolean;
  isLoading: boolean;
  hasChecked: boolean;
}

const TOTAL_STEPS = 5;

export const useOnboarding = (reopenTrigger?: number) => {
  const settingsQuery = useUserSettingsQuery();
  const saveSettings = useSaveUserSettingsMutation();
  const [state, setState] = useState<OnboardingState>({
    isVisible: false,
    currentStep: 0,
    isCompleted: false,
    isLoading: true,
    hasChecked: false,
  });

  // Hydrate UI state from query result.
  useEffect(() => {
    if (!settingsQuery.isSuccess) return;
    const settings = settingsQuery.data;
    const completed = settings?.onboarding_completed ?? false;
    const step = settings?.onboarding_step ?? 0;
    setState((prev) => ({
      ...prev,
      // Only flip visibility on first hydration; later renders shouldn't
      // re-open the wizard if the user manually closed it.
      isVisible: prev.hasChecked ? prev.isVisible : !completed,
      currentStep: prev.hasChecked ? prev.currentStep : step,
      isCompleted: completed,
      isLoading: false,
      hasChecked: true,
    }));
  }, [settingsQuery.isSuccess, settingsQuery.data]);

  // Surface query errors as a non-blocking "checked" state so the app
  // continues even if the WS round-trip failed.
  useEffect(() => {
    if (settingsQuery.isError) {
      console.error('[Onboarding] Failed to check status:', settingsQuery.error);
      setState((prev) => ({ ...prev, isLoading: false, hasChecked: true }));
    }
  }, [settingsQuery.isError, settingsQuery.error]);

  // Replay trigger from SettingsPanel.
  useEffect(() => {
    if (reopenTrigger && reopenTrigger > 0) {
      setState((prev) => ({
        ...prev,
        isVisible: true,
        currentStep: 0,
        isCompleted: false,
      }));
    }
  }, [reopenTrigger]);

  const saveProgress = useCallback(
    (step: number, completed: boolean) => {
      saveSettings.mutate({
        onboarding_step: step,
        onboarding_completed: completed,
      });
    },
    [saveSettings],
  );

  const nextStep = useCallback(() => {
    setState((prev) => {
      const next = prev.currentStep + 1;
      if (next >= TOTAL_STEPS) {
        saveProgress(TOTAL_STEPS, true);
        return { ...prev, currentStep: next, isCompleted: true, isVisible: false };
      }
      saveProgress(next, false);
      return { ...prev, currentStep: next };
    });
  }, [saveProgress]);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const next = Math.max(0, prev.currentStep - 1);
      saveProgress(next, false);
      return { ...prev, currentStep: next };
    });
  }, [saveProgress]);

  const skip = useCallback(() => {
    saveProgress(state.currentStep, true);
    setState((prev) => ({ ...prev, isVisible: false, isCompleted: true }));
  }, [saveProgress, state.currentStep]);

  const complete = useCallback(() => {
    saveProgress(TOTAL_STEPS, true);
    setState((prev) => ({ ...prev, isVisible: false, isCompleted: true }));
  }, [saveProgress]);

  return {
    ...state,
    totalSteps: TOTAL_STEPS,
    nextStep,
    prevStep,
    skip,
    complete,
  };
};
