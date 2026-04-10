/**
 * OAuthConnect — reusable OAuth connect/disconnect flow.
 * Composes StatusCard (data-driven) + FieldRenderer + ActionBar.
 * Accepts optional `extraSection` slot for panel-specific content (e.g., API usage).
 */

import React from 'react';
import { Button, Alert, Flex, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';
import FieldRenderer from './FieldRenderer';
import ActionBar, { type ActionDef } from './ActionBar';
import StatusCard from './StatusCard';
import type { ProviderConfig, StatusRowDef } from '../types';
import type { FormInstance } from 'antd';

interface Props {
  config: ProviderConfig;
  form: FormInstance;
  connected: boolean;
  stored: boolean;
  loading: string | null;
  error: string | null;
  icon: React.ReactNode;
  onSaveCredentials: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  /** Optional slot rendered below the info box, above the ActionBar. */
  extraSection?: React.ReactNode;
}

const OAuthConnect: React.FC<Props> = ({
  config, form, connected, stored, loading, error, icon,
  onSaveCredentials, onLogin, onLogout, onRefresh, extraSection,
}) => {
  const theme = useAppTheme();

  const statusRows: StatusRowDef[] = [
    { label: 'Status', ok: () => connected, trueText: 'Connected', falseText: 'Not Connected' },
    { label: 'Credentials', ok: () => stored, trueText: 'Configured', falseText: 'Not configured' },
  ];

  const actions: ActionDef[] = [
    { key: 'login', label: `Login with ${config.name}`, color: theme.dracula.green, onClick: onLogin, disabled: !stored, hidden: connected },
    { key: 'logout', label: 'Disconnect', color: theme.dracula.pink, onClick: onLogout, hidden: !connected },
    { key: 'refresh', label: 'Refresh', color: theme.dracula.cyan, onClick: onRefresh, icon: <ReloadOutlined /> },
  ];

  return (
    <Flex vertical gap={theme.spacing.lg} style={{ flex: 1, minHeight: 0 }}>
      <StatusCard icon={icon} title={config.name} rows={statusRows} status={null} />

      {!connected && config.fields && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <FieldRenderer fields={config.fields} form={form} />
          <Button onClick={onSaveCredentials} loading={loading === 'save'}
            style={{ backgroundColor: `${theme.dracula.purple}25`, borderColor: `${theme.dracula.purple}60`, color: theme.dracula.purple }}>
            Save Credentials
          </Button>
          {config.instructions && (
            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted, lineHeight: 1.5 }}>
              {config.instructions}
              {config.callbackUrl && <><br/>Callback URL: <code style={{ color: theme.dracula.cyan }}>{config.callbackUrl}</code></>}
            </div>
          )}
        </Space>
      )}

      {error && <Alert type="error" message={error} showIcon />}

      <div style={{ padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
        backgroundColor: `${theme.dracula.cyan}10`, border: `1px solid ${theme.dracula.cyan}30` }}>
        <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, lineHeight: 1.5 }}>
          {connected ? `Your ${config.name} account is connected.`
            : stored ? 'Click Login to authorize.'
            : 'Enter your credentials above to get started.'}
        </div>
      </div>

      {extraSection}

      <div style={{ flex: 1 }} />

      <ActionBar actions={actions} loading={loading} />
    </Flex>
  );
};

export default OAuthConnect;
