import React from 'react';
import { Steps, Button, Space } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined } from '@ant-design/icons';
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
      maxWidth="680px"
      maxHeight="85vh"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px 24px 16px',
      }}>
        {/* Progress steps */}
        <Steps
          current={currentStep}
          size="small"
          items={stepItems}
          style={{ marginBottom: 20 }}
        />

        {/* Step content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          paddingRight: 4,
        }}>
          {renderStep()}
        </div>

        {/* Footer navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 16,
          marginTop: 16,
          borderTop: `1px solid ${theme.colors.border}`,
        }}>
          {/* Left: Skip */}
          <Button type="text" onClick={skip} size="small" style={{ color: theme.colors.textSecondary }}>
            Skip for now
          </Button>

          {/* Right: Back + Next/Finish */}
          <Space>
            {currentStep > 0 && (
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={prevStep}
                size="middle"
              >
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={complete}
                size="middle"
                style={{
                  backgroundColor: theme.dracula.green,
                  borderColor: theme.dracula.green,
                }}
              >
                Start Building
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={nextStep}
                size="middle"
                style={{
                  backgroundColor: theme.dracula.purple,
                  borderColor: theme.dracula.purple,
                }}
              >
                Next <ArrowRightOutlined />
              </Button>
            )}
          </Space>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingWizard;
