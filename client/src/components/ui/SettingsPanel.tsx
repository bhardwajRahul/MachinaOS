import React from 'react';
import Modal from './Modal';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface WorkflowSettings {
  autoSave: boolean;
  autoSaveInterval: number;
}

export const defaultSettings: WorkflowSettings = {
  autoSave: true,
  autoSaveInterval: 30,
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkflowSettings;
  onSettingsChange: (settings: WorkflowSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}) => {
  const theme = useAppTheme();

  const handleChange = (key: keyof WorkflowSettings, value: number | boolean) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const handleReset = () => {
    onSettingsChange(defaultSettings);
  };

  const handleSave = () => {
    // Settings are already persisted to localStorage via onSettingsChange
    console.log('[SettingsPanel] Settings saved');
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: theme.spacing.lg,
  };

  const checkboxContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundPanel,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  // Header actions
  const headerActions = (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '16px',
        fontWeight: '600',
        color: theme.colors.text,
        fontFamily: 'system-ui, sans-serif'
      }}>
        <span style={{ fontSize: '20px' }}>{'\u2699'}</span>
        <span>Workflow Settings</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.textSecondary,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif'
          }}
          onClick={handleReset}
        >
          Reset to Defaults
        </button>

        <button
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.focus,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif'
          }}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      maxWidth="600px"
      maxHeight="95vh"
      headerActions={headerActions}
    >
      <div style={{
        padding: theme.spacing.xl,
        height: '100%',
      }}>
        {/* Auto-save Settings */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <span>{'\uD83D\uDCBE'}</span>
            Auto-save Settings
          </div>

          <div style={checkboxContainerStyle}>
            <input
              type="checkbox"
              id="autoSave"
              checked={settings.autoSave}
              onChange={(e) => handleChange('autoSave', e.target.checked)}
              style={{ cursor: 'pointer', marginTop: '2px' }}
            />
            <div>
              <label
                htmlFor="autoSave"
                style={{
                  fontSize: theme.fontSize.sm,
                  fontWeight: theme.fontWeight.medium,
                  color: theme.colors.text,
                  cursor: 'pointer',
                }}
              >
                Enable auto-save
              </label>
              <p style={descriptionStyle}>
                Automatically save the workflow at regular intervals
              </p>
            </div>
          </div>

          {settings.autoSave && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Auto-save Interval (seconds)</label>
              <input
                type="number"
                min="10"
                max="300"
                step="5"
                value={settings.autoSaveInterval}
                onChange={(e) => handleChange('autoSaveInterval', parseInt(e.target.value) || 30)}
                style={inputStyle}
              />
              <p style={descriptionStyle}>
                How often to auto-save the workflow (10-300 seconds)
              </p>
            </div>
          )}

          {/* Current Settings Summary */}
          <div style={{
            marginTop: theme.spacing.lg,
            padding: theme.spacing.md,
            backgroundColor: theme.colors.backgroundAlt,
            borderRadius: theme.borderRadius.sm,
            fontSize: theme.fontSize.xs,
            color: theme.colors.textSecondary,
          }}>
            <strong>Current Configuration:</strong>
            <ul style={{ margin: `${theme.spacing.sm} 0 0 ${theme.spacing.md}`, paddingLeft: theme.spacing.md }}>
              <li>Auto-save: {settings.autoSave ? `Every ${settings.autoSaveInterval}s` : 'Disabled'}</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsPanel;
