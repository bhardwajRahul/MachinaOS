import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../hooks/useAppTheme';

interface TopToolbarProps {
  workflowName: string;
  onWorkflowNameChange: (name: string) => void;
  onSave: () => void;
  onNew: () => void;
  onOpen: () => void;
  onRun: () => void;
  isRunning?: boolean;
  onDeploy: () => void;
  onCancelDeployment: () => void;
  isDeploying?: boolean;
  hasUnsavedChanges: boolean;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  componentPaletteVisible: boolean;
  onToggleComponentPalette: () => void;
  proMode: boolean;
  onToggleProMode: () => void;
  onOpenSettings: () => void;
  onOpenCredentials: () => void;
  onExportJSON: () => void;
  onExportFile: () => void;
  onImportJSON: () => void;
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  workflowName,
  onWorkflowNameChange,
  onSave,
  onNew,
  onOpen,
  onRun: _onRun,
  isRunning = false,
  onDeploy,
  onCancelDeployment,
  isDeploying = false,
  hasUnsavedChanges,
  sidebarVisible,
  onToggleSidebar,
  componentPaletteVisible,
  onToggleComponentPalette,
  proMode,
  onToggleProMode,
  onOpenSettings,
  onOpenCredentials,
  onExportJSON,
  onExportFile,
  onImportJSON,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(workflowName);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const theme = useAppTheme();

  const handleNameClick = () => {
    setTempName(workflowName);
    setIsEditing(true);
  };

  const handleNameSubmit = () => {
    onWorkflowNameChange(tempName.trim() || 'Untitled Workflow');
    setIsEditing(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(workflowName);
      setIsEditing(false);
    }
  };

  // Icon-only button style - subtle with colored icon
  const iconButtonStyle: React.CSSProperties = {
    width: theme.buttonSize.lg,
    height: theme.buttonSize.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  };

  // Text button style - cleaner with subtle border and Dracula accent
  const textButtonStyle: React.CSSProperties = {
    height: theme.buttonSize.md,
    padding: `0 ${theme.spacing.md}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'transparent',
    color: theme.dracula.green,
    border: `1px solid ${theme.dracula.green}40`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontFamily: 'system-ui, sans-serif',
  };

  // Action button style - Dracula theme for visibility
  const actionButtonStyle = (color: string, isDisabled = false): React.CSSProperties => ({
    height: theme.buttonSize.md,
    padding: `0 ${theme.spacing.lg}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: isDisabled ? `${theme.colors.primary}15` : `${color}25`,
    color: isDisabled ? theme.colors.primary : color,
    border: `1px solid ${isDisabled ? `${theme.colors.primary}40` : `${color}60`}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.3px',
  });

  return (
    <div
      style={{
        height: theme.layout.toolbarHeight,
        backgroundColor: theme.colors.backgroundPanel,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${theme.spacing.md}`,
        gap: theme.spacing.md,
      }}
    >
      {/* Left Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          style={{
            ...iconButtonStyle,
            backgroundColor: sidebarVisible ? `${theme.colors.actionSidebar}30` : `${theme.colors.actionSidebar}15`,
            color: theme.colors.actionSidebar,
            border: `1px solid ${sidebarVisible ? `${theme.colors.actionSidebar}60` : `${theme.colors.actionSidebar}40`}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionSidebar}40`;
            e.currentTarget.style.borderColor = `${theme.colors.actionSidebar}80`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = sidebarVisible ? `${theme.colors.actionSidebar}30` : `${theme.colors.actionSidebar}15`;
            e.currentTarget.style.borderColor = sidebarVisible ? `${theme.colors.actionSidebar}60` : `${theme.colors.actionSidebar}40`;
          }}
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarVisible ? (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </>
            )}
          </svg>
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: theme.spacing.xl, backgroundColor: theme.colors.border, margin: `0 ${theme.spacing.xs}` }} />

        {/* File Menu */}
        <div style={{ position: 'relative', marginLeft: sidebarVisible ? `calc(${theme.layout.workflowSidebarWidth} - ${theme.spacing.xxl} - ${theme.spacing.xxl})` : 0 }}>
          <button
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            style={{
              ...textButtonStyle,
              backgroundColor: fileMenuOpen ? theme.colors.backgroundHover : 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
            }}
            onMouseLeave={(e) => {
              if (!fileMenuOpen) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            File
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {fileMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                onClick={() => setFileMenuOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  background: `linear-gradient(135deg, ${theme.colors.backgroundPanel} 0%, ${theme.colors.background} 100%)`,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.lg,
                  boxShadow: `0 8px 24px ${theme.colors.shadow}, 0 2px 8px ${theme.colors.shadowLight}`,
                  minWidth: '200px',
                  zIndex: 1000,
                  overflow: 'hidden',
                  padding: theme.spacing.sm,
                  backdropFilter: 'blur(8px)',
                }}
              >
                {/* Menu Header */}
                <div
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    marginBottom: theme.spacing.xs,
                    borderBottom: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSize.xs,
                      fontWeight: theme.fontWeight.semibold,
                      color: theme.colors.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    File Operations
                  </span>
                </div>
                {[
                  { label: 'New Workflow', icon: 'M12 5v14M5 12h14', action: onNew, color: theme.dracula.green },
                  { label: 'Open', icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', action: onOpen, color: theme.accent.blue },
                  { divider: true },
                  { label: 'Export', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12', action: onExportFile, color: theme.accent.cyan },
                  { label: 'Import', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', action: onImportJSON, color: theme.accent.cyan },
                  { divider: true },
                  { label: 'Copy as JSON', icon: 'M8 17.929H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v0M18 9h-8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2z', action: onExportJSON, color: theme.dracula.purple },
                ].map((item, index) =>
                  item.divider ? (
                    <div key={index} style={{ height: '1px', backgroundColor: theme.colors.border, margin: `${theme.spacing.xs} 0` }} />
                  ) : (
                    <button
                      key={index}
                      onClick={() => { item.action?.(); setFileMenuOpen(false); }}
                      style={{
                        width: '100%',
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: theme.borderRadius.md,
                        color: theme.colors.textSecondary,
                        fontSize: theme.fontSize.sm,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                        textAlign: 'left',
                        fontFamily: 'system-ui, sans-serif',
                        transition: `all ${theme.transitions.fast}`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${item.color}15`;
                        e.currentTarget.style.color = item.color || theme.colors.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = theme.colors.textSecondary;
                      }}
                    >
                      <div
                        style={{
                          width: theme.iconSize.lg,
                          height: theme.iconSize.lg,
                          borderRadius: theme.borderRadius.sm,
                          backgroundColor: `${item.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={item.icon} />
                        </svg>
                      </div>
                      <span style={{ fontWeight: theme.fontWeight.medium }}>{item.label}</span>
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center Section - Workflow Name */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {isEditing ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            autoFocus
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundAlt,
              border: `1px solid ${theme.accent.cyan}`,
              borderRadius: theme.borderRadius.sm,
              padding: '6px 12px',
              outline: 'none',
              fontFamily: 'system-ui, sans-serif',
              minWidth: '200px',
              textAlign: 'center',
            }}
          />
        ) : (
          <button
            onClick={handleNameClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: theme.borderRadius.sm,
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Click to rename"
          >
            <span style={{
              fontSize: '14px',
              fontWeight: 500,
              color: theme.dracula.purple,
              fontFamily: 'system-ui, sans-serif',
            }}>
              {workflowName}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
        {/* Mode Toggle - Segmented control style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span style={{
            fontSize: theme.fontSize.sm,
            color: theme.accent.cyan,
            fontWeight: theme.fontWeight.semibold,
            fontFamily: 'system-ui, sans-serif',
          }}>
            Mode:
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: theme.colors.backgroundAlt,
              borderRadius: theme.borderRadius.md,
              padding: '2px',
              border: `1px solid ${theme.colors.border}`,
            }}
            title={proMode ? 'Dev mode: All components visible' : 'Normal mode: Only AI components'}
          >
          <button
            onClick={() => !proMode ? undefined : onToggleProMode()}
            style={{
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: !proMode ? `${theme.dracula.green}25` : 'transparent',
              color: !proMode ? theme.dracula.green : theme.dracula.orange,
              border: !proMode ? `1px solid ${theme.dracula.green}60` : '1px solid transparent',
              borderRadius: theme.borderRadius.sm,
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.semibold,
              cursor: proMode ? 'pointer' : 'default',
              transition: `all ${theme.transitions.fast}`,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Normal
          </button>
          <button
            onClick={() => proMode ? undefined : onToggleProMode()}
            style={{
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: proMode ? `${theme.dracula.purple}25` : 'transparent',
              color: proMode ? theme.dracula.purple : theme.dracula.orange,
              border: proMode ? `1px solid ${theme.dracula.purple}60` : '1px solid transparent',
              borderRadius: theme.borderRadius.sm,
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.semibold,
              cursor: !proMode ? 'pointer' : 'default',
              transition: `all ${theme.transitions.fast}`,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Dev
          </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: theme.spacing.xl, backgroundColor: theme.colors.border, margin: `0 ${theme.spacing.xs}` }} />

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          style={{
            ...iconButtonStyle,
            backgroundColor: `${theme.colors.actionSettings}15`,
            color: theme.colors.actionSettings,
            border: `1px solid ${theme.colors.actionSettings}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionSettings}30`;
            e.currentTarget.style.borderColor = `${theme.colors.actionSettings}60`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionSettings}15`;
            e.currentTarget.style.borderColor = `${theme.colors.actionSettings}40`;
          }}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Credentials Button */}
        <button
          onClick={onOpenCredentials}
          style={{
            ...iconButtonStyle,
            backgroundColor: `${theme.colors.actionCredentials}15`,
            color: theme.colors.actionCredentials,
            border: `1px solid ${theme.colors.actionCredentials}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionCredentials}30`;
            e.currentTarget.style.borderColor = `${theme.colors.actionCredentials}60`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionCredentials}15`;
            e.currentTarget.style.borderColor = `${theme.colors.actionCredentials}40`;
          }}
          title="API Credentials"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          style={{
            ...iconButtonStyle,
            backgroundColor: `${theme.colors.actionTheme}15`,
            color: theme.colors.actionTheme,
            border: `1px solid ${theme.colors.actionTheme}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionTheme}30`;
            e.currentTarget.style.borderColor = `${theme.colors.actionTheme}60`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionTheme}15`;
            e.currentTarget.style.borderColor = `${theme.colors.actionTheme}40`;
          }}
          title={isDarkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {isDarkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* User & Logout */}
        {user && (
          <button
            onClick={logout}
            style={{
              ...iconButtonStyle,
              backgroundColor: `${theme.dracula.pink}15`,
              color: theme.dracula.pink,
              border: `1px solid ${theme.dracula.pink}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.dracula.pink}30`;
              e.currentTarget.style.borderColor = `${theme.dracula.pink}60`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.dracula.pink}15`;
              e.currentTarget.style.borderColor = `${theme.dracula.pink}40`;
            }}
            title={`Logout ${user.display_name}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}

        {/* Divider */}
        <div style={{ width: '1px', height: theme.spacing.xl, backgroundColor: theme.colors.border, margin: `0 ${theme.spacing.sm}` }} />

        {/* Action Buttons */}
        {!isDeploying ? (
          <button
            onClick={onDeploy}
            disabled={isRunning}
            style={actionButtonStyle(theme.colors.actionDeploy, isRunning)}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.backgroundColor = `${theme.colors.actionDeploy}40`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning) {
                e.currentTarget.style.backgroundColor = `${theme.colors.actionDeploy}25`;
              }
            }}
            title="Start workflow"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Start
          </button>
        ) : (
          <button
            onClick={onCancelDeployment}
            style={actionButtonStyle(theme.colors.actionStop, false)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.actionStop}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.actionStop}25`;
            }}
            title="Stop workflow"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1"/>
            </svg>
            Stop
          </button>
        )}

        <button
          onClick={() => {
            if (typeof onSave === 'function') {
              onSave();
            }
          }}
          style={actionButtonStyle(theme.colors.actionSave, !hasUnsavedChanges)}
          onMouseEnter={(e) => {
            if (hasUnsavedChanges) {
              e.currentTarget.style.backgroundColor = `${theme.colors.actionSave}40`;
            }
          }}
          onMouseLeave={(e) => {
            if (hasUnsavedChanges) {
              e.currentTarget.style.backgroundColor = `${theme.colors.actionSave}25`;
            }
          }}
          title={hasUnsavedChanges ? 'Save changes' : 'No changes to save'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save
        </button>

        {/* Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            backgroundColor: 'transparent',
            borderRadius: theme.borderRadius.sm,
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            color: hasUnsavedChanges ? theme.colors.statusModified : theme.colors.statusSaved,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{
            width: theme.spacing.sm,
            height: theme.spacing.sm,
            borderRadius: '50%',
            backgroundColor: hasUnsavedChanges ? theme.colors.statusModified : theme.colors.statusSaved,
          }} />
          {hasUnsavedChanges ? 'Modified' : 'Saved'}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: theme.spacing.xl, backgroundColor: theme.colors.border, margin: `0 ${theme.spacing.sm}` }} />

        {/* Component Palette Toggle */}
        <button
          onClick={onToggleComponentPalette}
          style={{
            ...iconButtonStyle,
            backgroundColor: componentPaletteVisible ? `${theme.colors.actionPalette}30` : `${theme.colors.actionPalette}15`,
            color: theme.colors.actionPalette,
            border: `1px solid ${componentPaletteVisible ? `${theme.colors.actionPalette}60` : `${theme.colors.actionPalette}40`}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.actionPalette}40`;
            e.currentTarget.style.borderColor = `${theme.colors.actionPalette}80`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = componentPaletteVisible ? `${theme.colors.actionPalette}30` : `${theme.colors.actionPalette}15`;
            e.currentTarget.style.borderColor = componentPaletteVisible ? `${theme.colors.actionPalette}60` : `${theme.colors.actionPalette}40`;
          }}
          title={componentPaletteVisible ? 'Hide components' : 'Show components'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {componentPaletteVisible ? (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </>
            ) : (
              <>
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TopToolbar;
