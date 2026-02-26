import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

export interface OnboardingState {
  isVisible: boolean;
  currentStep: number;
  isCompleted: boolean;
  isLoading: boolean;
  hasChecked: boolean;
}

const TOTAL_STEPS = 5;

export const useOnboarding = (reopenTrigger?: number) => {
  const { sendRequest, isConnected } = useWebSocket();
  const [state, setState] = useState<OnboardingState>({
    isVisible: false,
    currentStep: 0,
    isCompleted: false,
    isLoading: true,
    hasChecked: false,
  });
  const hasCheckedRef = useRef(false);

  // Check onboarding status on WebSocket connect (once)
  useEffect(() => {
    if (!isConnected || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkOnboarding = async () => {
      try {
        const response = await sendRequest<{ settings: any }>('get_user_settings', {});
        const settings = response?.settings;
        const completed = settings?.onboarding_completed ?? false;
        const step = settings?.onboarding_step ?? 0;

        setState({
          isVisible: !completed,
          currentStep: step,
          isCompleted: completed,
          isLoading: false,
          hasChecked: true,
        });
      } catch (error) {
        console.error('[Onboarding] Failed to check status:', error);
        setState(prev => ({ ...prev, isLoading: false, hasChecked: true }));
      }
    };

    checkOnboarding();
  }, [isConnected, sendRequest]);

  // Handle reopen trigger from SettingsPanel
  useEffect(() => {
    if (reopenTrigger && reopenTrigger > 0) {
      hasCheckedRef.current = false;
      setState(prev => ({
        ...prev,
        isVisible: true,
        currentStep: 0,
        isCompleted: false,
      }));
    }
  }, [reopenTrigger]);

  const saveProgress = useCallback(async (step: number, completed: boolean) => {
    try {
      await sendRequest('save_user_settings', {
        settings: {
          onboarding_step: step,
          onboarding_completed: completed,
        }
      });
    } catch (error) {
      console.error('[Onboarding] Failed to save progress:', error);
    }
  }, [sendRequest]);

  const nextStep = useCallback(() => {
    setState(prev => {
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
    setState(prev => {
      const next = Math.max(0, prev.currentStep - 1);
      saveProgress(next, false);
      return { ...prev, currentStep: next };
    });
  }, [saveProgress]);

  const skip = useCallback(() => {
    saveProgress(state.currentStep, true);
    setState(prev => ({ ...prev, isVisible: false, isCompleted: true }));
  }, [saveProgress, state.currentStep]);

  const complete = useCallback(() => {
    saveProgress(TOTAL_STEPS, true);
    setState(prev => ({ ...prev, isVisible: false, isCompleted: true }));
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
