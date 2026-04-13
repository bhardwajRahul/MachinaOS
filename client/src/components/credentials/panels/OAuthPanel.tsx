/**
 * OAuthPanel — generic OAuth panel for Twitter, Google Workspace, Telegram.
 * Delegates entirely to the OAuthConnect primitive.
 */

import React from 'react';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useCredentialPanel } from '../useCredentialPanel';
import { useProviderStatus } from '../hooks';
import { OAuthConnect } from '../primitives';
import { ApiUsageSection } from '../sections';
import type { ProviderConfig } from '../types';

const OAuthPanel: React.FC<{ config: ProviderConfig; visible: boolean }> = ({ config, visible }) => {
  const theme = useAppTheme();
  const panel = useCredentialPanel(config, visible);
  const status = useProviderStatus(config.statusHook);
  const connected = !!status?.connected;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <OAuthConnect
        config={config} form={panel.form} connected={connected}
        stored={panel.stored} loading={panel.loading} error={panel.error}
        icon={<config.icon size={parseInt(theme.iconSize.md)} />}
        onSaveCredentials={() => {
          const missing = config.fields?.find(f => f.required && !panel.form.getFieldValue(f.key)?.trim());
          if (missing) { panel.setError(`${missing.label} is required`); return; }
          panel.execute('save', async () => {
            for (const f of config.fields!) { const v = panel.form.getFieldValue(f.key)?.trim(); if (v) await panel.actions.save(f.key, v); }
            panel.setStored(true);
            return { success: true };
          });
        }}
        onLogin={() => panel.actions.oauthLogin()}
        onLogout={() => panel.actions.oauthLogout()}
        onRefresh={() => panel.actions.oauthRefresh()}
        extraSection={config.usageService && <ApiUsageSection service={config.usageService} serviceName={config.name} />}
      />
    </div>
  );
};

export default OAuthPanel;
