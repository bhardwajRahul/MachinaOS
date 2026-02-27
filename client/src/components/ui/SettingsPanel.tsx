import React, { useState, useEffect, useCallback } from 'react';
import { Switch, InputNumber, Slider, Button, message } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import Modal from './Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useWebSocket } from '../../contexts/WebSocketContext';

export interface WorkflowSettings {
  autoSave: boolean;
  autoSaveInterval: number;
  sidebarDefaultOpen: boolean;
  componentPaletteDefaultOpen: boolean;
  consolePanelDefaultOpen: boolean;
  memoryWindowSize: number;
  compactionRatio: number;
}

export const defaultSettings: WorkflowSettings = {
  autoSave: true,
  autoSaveInterval: 30,
  sidebarDefaultOpen: true,
  componentPaletteDefaultOpen: true,
  consolePanelDefaultOpen: false,
  memoryWindowSize: 100,
  compactionRatio: 0.5,
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkflowSettings;
  onSettingsChange: (settings: WorkflowSettings) => void;
  onReplayOnboarding?: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onReplayOnboarding,
}) => {
  const theme = useAppTheme();
  const { sendRequest, isConnected } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from database on open
  useEffect(() => {
    if (isOpen && isConnected) {
      loadSettingsFromDB();
    }
  }, [isOpen, isConnected]);

  const loadSettingsFromDB = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await sendRequest<{ settings: any }>('get_user_settings', {});
      if (response?.settings) {
        const dbSettings = response.settings;
        onSettingsChange({
          autoSave: dbSettings.auto_save ?? defaultSettings.autoSave,
          autoSaveInterval: dbSettings.auto_save_interval ?? defaultSettings.autoSaveInterval,
          sidebarDefaultOpen: dbSettings.sidebar_default_open ?? defaultSettings.sidebarDefaultOpen,
          componentPaletteDefaultOpen: dbSettings.component_palette_default_open ?? defaultSettings.componentPaletteDefaultOpen,
          consolePanelDefaultOpen: dbSettings.console_panel_default_open ?? defaultSettings.consolePanelDefaultOpen,
          memoryWindowSize: dbSettings.memory_window_size ?? defaultSettings.memoryWindowSize,
          compactionRatio: dbSettings.compaction_ratio ?? defaultSettings.compactionRatio,
        });
      }
    } catch (error) {
      console.error('[SettingsPanel] Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sendRequest, onSettingsChange]);

  const saveSettingsToDB = useCallback(async (newSettings: WorkflowSettings, showMessage = false) => {
    setIsSaving(true);
    try {
      await sendRequest('save_user_settings', {
        settings: {
          auto_save: newSettings.autoSave,
          auto_save_interval: newSettings.autoSaveInterval,
          sidebar_default_open: newSettings.sidebarDefaultOpen,
          component_palette_default_open: newSettings.componentPaletteDefaultOpen,
          console_panel_default_open: newSettings.consolePanelDefaultOpen,
          memory_window_size: newSettings.memoryWindowSize,
          compaction_ratio: newSettings.compactionRatio,
        }
      });
      if (showMessage) {
        message.success('Settings saved successfully');
      }
      console.log('[SettingsPanel] Settings saved to database');
    } catch (error) {
      console.error('[SettingsPanel] Failed to save settings:', error);
      if (showMessage) {
        message.error('Failed to save settings');
      }
    } finally {
      setIsSaving(false);
    }
  }, [sendRequest]);

  const handleChange = (key: keyof WorkflowSettings, value: number | boolean) => {
    const newSettings = {
      ...settings,
      [key]: value,
    };
    onSettingsChange(newSettings);
    // Auto-save to database (without message)
    saveSettingsToDB(newSettings, false);
  };

  const handleReset = async () => {
    onSettingsChange(defaultSettings);
    await saveSettingsToDB(defaultSettings, true);
  };

  const handleSave = async () => {
    await saveSettingsToDB(settings, true);
  };

  // Section card style
  const sectionStyle: React.CSSProperties = {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
  };

  // Section header style
  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const sectionIconStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    backgroundColor: `${theme.dracula.purple}20`,
    borderRadius: theme.borderRadius.md,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: '2px',
  };

  const settingRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} 0`,
  };

  const settingLabelStyle: React.CSSProperties = {
    flex: 1,
  };

  const labelTextStyle: React.CSSProperties = {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  };

  // Button style helper following ParameterPanel pattern
  const actionButtonStyle = (color: string, isDisabled = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: isDisabled ? `${theme.colors.primary}15` : `${color}25`,
    color: isDisabled ? theme.colors.primary : color,
    border: `1px solid ${isDisabled ? `${theme.colors.primary}40` : `${color}60`}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: '13px',
    fontWeight: 600,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontFamily: 'system-ui, sans-serif',
  });

  // Header actions with title and buttons
  const headerActions = (
    <div style={{
      display: 'flex',
      gap: '16px',
      alignItems: 'center'
    }}>
      {/* Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '15px',
        fontWeight: 600,
        color: theme.colors.text,
        fontFamily: 'system-ui, sans-serif'
      }}>
        <span>{'\u2699'}</span>
        <span>Settings</span>
      </div>

      {/* Buttons: Reset, Save, Close */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Reset Button */}
        <button
          style={actionButtonStyle(theme.dracula.orange, isSaving)}
          onClick={handleReset}
          disabled={isSaving}
          title="Reset to default settings"
          onMouseEnter={(e) => {
            if (!isSaving) {
              e.currentTarget.style.backgroundColor = `${theme.dracula.orange}40`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSaving) {
              e.currentTarget.style.backgroundColor = `${theme.dracula.orange}25`;
            }
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Reset
        </button>

        {/* Save Button */}
        <button
          style={actionButtonStyle(theme.dracula.green, isSaving)}
          onClick={handleSave}
          disabled={isSaving}
          title="Save settings"
          onMouseEnter={(e) => {
            if (!isSaving) {
              e.currentTarget.style.backgroundColor = `${theme.dracula.green}40`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSaving) {
              e.currentTarget.style.backgroundColor = `${theme.dracula.green}25`;
            }
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {/* Close Button */}
        <button
          style={actionButtonStyle(theme.dracula.pink, false)}
          onClick={onClose}
          title="Close settings"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.dracula.pink}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.dracula.pink}25`;
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      maxWidth="95vw"
      maxHeight="95vh"
      headerActions={headerActions}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing.lg,
          opacity: isLoading ? 0.6 : 1,
          transition: 'opacity 0.2s ease',
        }}>
          {/* UI Defaults Section */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={sectionIconStyle}>{'\uD83D\uDDA5'}</div>
              <div style={sectionTitleStyle}>UI Defaults</div>
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Sidebar Open by Default</div>
                <div style={descriptionStyle}>Show the sidebar panel when the application starts</div>
              </div>
              <Switch
                size="small"
                checked={settings.sidebarDefaultOpen}
                onChange={(checked) => handleChange('sidebarDefaultOpen', checked)}
                disabled={isSaving}
              />
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Component Palette Open by Default</div>
                <div style={descriptionStyle}>Show the component palette when the application starts</div>
              </div>
              <Switch
                size="small"
                checked={settings.componentPaletteDefaultOpen}
                onChange={(checked) => handleChange('componentPaletteDefaultOpen', checked)}
                disabled={isSaving}
              />
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Console Panel Open by Default</div>
                <div style={descriptionStyle}>Show the console/chat panel at the bottom when the application starts</div>
              </div>
              <Switch
                size="small"
                checked={settings.consolePanelDefaultOpen}
                onChange={(checked) => handleChange('consolePanelDefaultOpen', checked)}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Auto-save Settings */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ ...sectionIconStyle, backgroundColor: `${theme.dracula.cyan}20` }}>{'\uD83D\uDCBE'}</div>
              <div style={sectionTitleStyle}>Auto-save</div>
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Enable Auto-save</div>
                <div style={descriptionStyle}>Automatically save the workflow at regular intervals</div>
              </div>
              <Switch
                size="small"
                checked={settings.autoSave}
                onChange={(checked) => handleChange('autoSave', checked)}
                disabled={isSaving}
              />
            </div>

            {settings.autoSave && (
              <div style={{ ...settingRowStyle, marginTop: theme.spacing.xs }}>
                <div style={settingLabelStyle}>
                  <div style={labelTextStyle}>Auto-save Interval</div>
                  <div style={descriptionStyle}>How often to auto-save (10-300 seconds)</div>
                </div>
                <InputNumber
                  size="small"
                  min={10}
                  max={300}
                  step={5}
                  value={settings.autoSaveInterval}
                  onChange={(value) => handleChange('autoSaveInterval', value ?? 30)}
                  disabled={isSaving}
                  style={{ width: 80 }}
                  suffix="s"
                />
              </div>
            )}
          </div>

          {/* Memory & Compaction Settings */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ ...sectionIconStyle, backgroundColor: `${theme.dracula.purple}20` }}>{'\uD83E\uDDE0'}</div>
              <div style={sectionTitleStyle}>Memory & Compaction</div>
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Default Window Size</div>
                <div style={descriptionStyle}>Number of message pairs to keep in short-term memory (1-100)</div>
              </div>
              <InputNumber
                size="small"
                min={1}
                max={100}
                step={1}
                value={settings.memoryWindowSize}
                onChange={(value) => handleChange('memoryWindowSize', value ?? 100)}
                disabled={isSaving}
                style={{ width: 80 }}
              />
            </div>

            <div style={{ borderBottom: `1px solid ${theme.colors.border}40`, margin: `${theme.spacing.xs} 0` }} />

            <div style={{ padding: `${theme.spacing.sm} 0` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
                <div style={settingLabelStyle}>
                  <div style={labelTextStyle}>Compaction Ratio</div>
                  <div style={descriptionStyle}>
                    Fraction of context window that triggers memory compaction
                  </div>
                </div>
                <span style={{
                  fontSize: theme.fontSize.sm,
                  fontWeight: theme.fontWeight.semibold,
                  color: theme.dracula.cyan,
                  minWidth: 42,
                  textAlign: 'right',
                }}>
                  {Math.round(settings.compactionRatio * 100)}%
                </span>
              </div>
              <Slider
                min={10}
                max={90}
                step={5}
                value={Math.round(settings.compactionRatio * 100)}
                onChange={(value) => handleChange('compactionRatio', value / 100)}
                disabled={isSaving}
                tooltip={{ formatter: (val) => `${val}%` }}
                marks={{
                  10: { label: '10%', style: { fontSize: 10, color: theme.colors.textMuted } },
                  50: { label: '50%', style: { fontSize: 10, color: theme.colors.textMuted } },
                  90: { label: '90%', style: { fontSize: 10, color: theme.colors.textMuted } },
                }}
              />
              <div style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.textMuted,
                marginTop: theme.spacing.xs,
                lineHeight: 1.4,
              }}>
                Lower = compact sooner (saves tokens, loses detail). Higher = compact later (preserves context, uses more tokens).
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ ...sectionIconStyle, backgroundColor: `${theme.dracula.cyan}20` }}>
                <QuestionCircleOutlined style={{ color: theme.dracula.cyan }} />
              </div>
              <div style={sectionTitleStyle}>Help</div>
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Replay Welcome Guide</div>
                <div style={descriptionStyle}>Show the onboarding wizard again to review platform features</div>
              </div>
              <Button
                size="small"
                icon={<QuestionCircleOutlined />}
                onClick={onReplayOnboarding}
                disabled={!onReplayOnboarding}
                style={{
                  backgroundColor: `${theme.dracula.cyan}25`,
                  color: theme.dracula.cyan,
                  borderColor: `${theme.dracula.cyan}60`,
                }}
              >
                Replay
              </Button>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default SettingsPanel;
