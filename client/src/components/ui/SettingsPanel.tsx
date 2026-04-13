import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import Modal from './Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  useUserSettingsQuery,
  useSaveUserSettingsMutation,
} from '../../hooks/useUserSettingsQuery';
import {
  workflowSettingsSchema,
  defaultSettings,
  fromServerRow,
  toServerRow,
  type WorkflowSettings,
} from './settingsPanel/schema';

export type { WorkflowSettings } from './settingsPanel/schema';
export { defaultSettings } from './settingsPanel/schema';

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
  const settingsQuery = useUserSettingsQuery();
  const saveMutation = useSaveUserSettingsMutation();
  const isLoading = settingsQuery.isLoading;
  const isSaving = saveMutation.isPending;

  // Hydrate Dashboard's controlled state from the cached settings row
  // exactly once per open. The query is shared with useOnboarding so
  // cross-component reads stay in sync.
  useEffect(() => {
    if (!isOpen || !settingsQuery.data) return;
    onSettingsChange(fromServerRow(settingsQuery.data));
    // onSettingsChange identity may change every parent render; only
    // re-hydrate when the modal opens or fresh data lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, settingsQuery.data]);

  const persist = async (next: WorkflowSettings, withToast: boolean) => {
    // Validate before persisting so an out-of-range field never reaches
    // the server. Surface zod errors as a toast and refuse the save.
    const parsed = workflowSettingsSchema.safeParse(next);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid settings';
      toast.error(message);
      return;
    }
    try {
      await saveMutation.mutateAsync(toServerRow(parsed.data));
      if (withToast) toast.success('Settings saved successfully');
    } catch (error) {
      console.error('[SettingsPanel] Failed to save settings:', error);
      if (withToast) toast.error('Failed to save settings');
    }
  };

  const handleChange = (key: keyof WorkflowSettings, value: number | boolean) => {
    const next = { ...settings, [key]: value } as WorkflowSettings;
    onSettingsChange(next);
    void persist(next, false);
  };

  const handleReset = async () => {
    onSettingsChange(defaultSettings);
    await persist(defaultSettings, true);
  };

  const handleSave = async () => {
    await persist(settings, true);
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
                
                checked={settings.sidebarDefaultOpen}
                onCheckedChange={(checked) => handleChange('sidebarDefaultOpen', checked)}
                disabled={isSaving}
              />
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Component Palette Open by Default</div>
                <div style={descriptionStyle}>Show the component palette when the application starts</div>
              </div>
              <Switch
                
                checked={settings.componentPaletteDefaultOpen}
                onCheckedChange={(checked) => handleChange('componentPaletteDefaultOpen', checked)}
                disabled={isSaving}
              />
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Console Panel Open by Default</div>
                <div style={descriptionStyle}>Show the console/chat panel at the bottom when the application starts</div>
              </div>
              <Switch
                
                checked={settings.consolePanelDefaultOpen}
                onCheckedChange={(checked) => handleChange('consolePanelDefaultOpen', checked)}
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
                
                checked={settings.autoSave}
                onCheckedChange={(checked) => handleChange('autoSave', checked)}
                disabled={isSaving}
              />
            </div>

            {settings.autoSave && (
              <div style={{ ...settingRowStyle, marginTop: theme.spacing.xs }}>
                <div style={settingLabelStyle}>
                  <div style={labelTextStyle}>Auto-save Interval</div>
                  <div style={descriptionStyle}>How often to auto-save (10-300 seconds)</div>
                </div>
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    step={5}
                    value={settings.autoSaveInterval}
                    onChange={(e) => handleChange('autoSaveInterval', Number(e.target.value) || 30)}
                    disabled={isSaving}
                    className="pr-6"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                    s
                  </span>
                </div>
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
              <Input
                type="number"
                min={1}
                max={100}
                step={1}
                value={settings.memoryWindowSize}
                onChange={(e) => handleChange('memoryWindowSize', Number(e.target.value) || 100)}
                disabled={isSaving}
                className="w-20"
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
                value={[Math.round(settings.compactionRatio * 100)]}
                onValueChange={(value) => handleChange('compactionRatio', (value[0] ?? 50) / 100)}
                disabled={isSaving}
                className="my-3"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10%</span>
                <span>50%</span>
                <span>90%</span>
              </div>
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

          {/* Process Manager Section */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ ...sectionIconStyle, backgroundColor: `${theme.dracula.orange}20` }}>{'\u2699\uFE0F'}</div>
              <div style={sectionTitleStyle}>Process Manager</div>
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Max Concurrent Processes</div>
                <div style={descriptionStyle}>Maximum number of running processes per workflow (1-50)</div>
              </div>
              <Input
                type="number"
                min={1}
                max={50}
                step={1}
                value={settings.maxProcesses ?? 10}
                onChange={(e) => handleChange('maxProcesses', Number(e.target.value) || 10)}
                disabled={isSaving}
                className="w-20"
              />
            </div>
          </div>

          {/* Help Section */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ ...sectionIconStyle, backgroundColor: `${theme.dracula.cyan}20` }}>
                <HelpCircle className="h-4 w-4" style={{ color: theme.dracula.cyan }} />
              </div>
              <div style={sectionTitleStyle}>Help</div>
            </div>

            <div style={settingRowStyle}>
              <div style={settingLabelStyle}>
                <div style={labelTextStyle}>Replay Welcome Guide</div>
                <div style={descriptionStyle}>Show the onboarding wizard again to review platform features</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onReplayOnboarding}
                disabled={!onReplayOnboarding}
                style={{
                  backgroundColor: `${theme.dracula.cyan}25`,
                  color: theme.dracula.cyan,
                  borderColor: `${theme.dracula.cyan}60`,
                }}
              >
                <HelpCircle className="h-3.5 w-3.5" />
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
