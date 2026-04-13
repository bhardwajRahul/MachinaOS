import React from 'react';
import { Steps } from 'antd';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import Modal from '../ui/Modal';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useAppTheme } from '../../hooks/useAppTheme';
import WelcomeStep from './steps/WelcomeStep';
import ConceptsStep from './steps/ConceptsStep';
import ApiKeyStep from './steps/ApiKeyStep';
import CanvasStep from './steps/CanvasStep';
import GetStartedStep from './steps/GetStartedStep';

interface OnboardingWizardProps {
  onOpenCredentials: () => void;
  reopenTrigger?: number;
}

const stepItems = [
  { title: 'Welcome' },
  { title: 'Concepts' },
  { title: 'API Keys' },
  { title: 'Canvas' },
  { title: 'Get Started' },
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onOpenCredentials, reopenTrigger }) => {
  const theme = useAppTheme();
  const {
    isVisible,
    currentStep,
    isLoading,
    hasChecked,
    totalSteps,
    nextStep,
    prevStep,
    skip,
    complete,
  } = useOnboarding(reopenTrigger);

  if (!isVisible || !hasChecked || isLoading) return null;

  const isLastStep = currentStep >= totalSteps - 1;

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <WelcomeStep />;
      case 1: return <ConceptsStep />;
      case 2: return <ApiKeyStep onOpenCredentials={onOpenCredentials} />;
      case 3: return <CanvasStep />;
      case 4: return <GetStartedStep />;
      default: return <WelcomeStep />;
    }
  };

  return (
    <Modal
      isOpen={isVisible}
      onClose={skip}
      title="Welcome Guide"
      maxWidth="95vw"
      maxHeight="95vh"
      autoHeight
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 20px 12px',
      }}>
        {/* Progress steps */}
        <Steps
          current={currentStep}
          size="small"
          items={stepItems}
          style={{ marginBottom: 16 }}
        />

        {/* Step content */}
        <div style={{
          overflowY: 'auto',
          minHeight: 500,
          maxHeight: 'calc(95vh - 200px)',
          paddingRight: 4,
        }}>
          {renderStep()}
        </div>

        {/* Footer navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 12,
          marginTop: 12,
          borderTop: `1px solid ${theme.colors.border}`,
        }}>
          {/* Left: Skip */}
          <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground">
            Skip for now
          </Button>

          {/* Right: Back + Next/Finish */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button
                onClick={complete}
                style={{
                  backgroundColor: theme.dracula.green,
                  borderColor: theme.dracula.green,
                }}
              >
                <Check className="h-4 w-4" />
                Start Building
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                style={{
                  backgroundColor: theme.dracula.purple,
                  borderColor: theme.dracula.purple,
                }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingWizard;
