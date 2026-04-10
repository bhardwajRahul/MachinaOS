/**
 * QrPairingPanel — config-driven QR pairing for WhatsApp and Android.
 * Status rows + QR config come from ProviderConfig — zero isWhatsApp conditionals.
 * Only action handlers need hook access (WhatsApp start vs Android relay connect).
 */

import React, { useMemo } from 'react';
import { Alert, Flex } from 'antd';
import ApiKeyInput from '../../ui/ApiKeyInput';
import QRCodeDisplay from '../../ui/QRCodeDisplay';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { useWhatsApp } from '../../../hooks/useWhatsApp';
import { useCredentialPanel } from '../useCredentialPanel';
import { useProviderStatus } from '../hooks';
import { StatusCard, ActionBar } from '../primitives';
import { RateLimitSection } from '../sections';
import type { ActionDef } from '../primitives/ActionBar';
import type { ProviderConfig } from '../types';

const QrPairingPanel: React.FC<{ config: ProviderConfig; visible: boolean }> = ({ config, visible }) => {
  const theme = useAppTheme();
  const panel = useCredentialPanel(config, visible);
  const status = useProviderStatus(config.statusHook);
  const { startConnection, restartConnection, getStatus: refreshWa } = useWhatsApp();
  const { sendRequest, setAndroidStatus } = useWebSocket();
  const qr = config.qr!;
  const connected = qr.isConnected(status);
  const qrData = status?.[qr.qrField];
  const field = config.fields?.[0];

  // Build actions from config.actions descriptors + hook methods
  const actionHandlers: Record<string, () => void> = useMemo(() => ({
    start: () => panel.execute('start', startConnection),
    restart: () => panel.execute('restart', restartConnection),
    refresh: () => panel.execute('refresh', refreshWa),
    connect: () => panel.execute('connect', async () => {
      const key = panel.form.getFieldValue('android_remote')?.trim();
      if (!key) { panel.setError('No API key configured'); return; }
      const res = await sendRequest('android_relay_connect', { url: (import.meta as any).env?.VITE_ANDROID_RELAY_URL || '', api_key: key });
      if (res.qr_data) setAndroidStatus((prev: any) => ({ ...prev, connected: true, paired: false, qr_data: res.qr_data, session_token: res.session_token || prev.session_token }));
      return res;
    }),
    disconnect: () => panel.execute('disconnect', () => sendRequest('android_relay_disconnect', {})),
  }), [panel, startConnection, restartConnection, refreshWa, sendRequest, setAndroidStatus]);

  const actions: ActionDef[] = (config.actions ?? []).map(a => ({
    key: a.key,
    label: a.label,
    color: (theme.dracula as any)[a.themeColor] ?? a.themeColor,
    onClick: actionHandlers[a.key] ?? (() => {}),
    hidden: a.hidden?.(status, panel.stored),
    disabled: a.disabled?.(status, panel.stored),
  }));

  return (
    <Flex vertical gap={theme.spacing.lg} style={{ padding: theme.spacing.xl, flex: 1, minHeight: 0 }}>
      {field && <ApiKeyInput
        value={panel.form.getFieldValue(field.key) || ''}
        onChange={(v: string) => panel.form.setFieldValue(field.key, v)}
        onSave={() => panel.actions.save(field.key, panel.form.getFieldValue(field.key)?.trim()).then(() => panel.setStored(true))}
        onDelete={() => panel.actions.remove(field.key)}
        placeholder={field.placeholder} loading={panel.loading === 'save'} isStored={panel.stored}
      />}
      {config.statusRows && <StatusCard icon={<config.icon size={parseInt(theme.iconSize.md)} />} title={config.name} rows={config.statusRows} status={status} />}
      <Flex vertical align="center" justify="center"
        style={{ backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.borderRadius.lg, padding: theme.spacing.xl, flex: 1, minHeight: 300 }}>
        <QRCodeDisplay value={qrData} isConnected={connected} size={280}
          connectedTitle={qr.connectedTitle} connectedSubtitle={qr.connectedSubtitle(status)}
          loading={qr.isLoading(status)} emptyText={qr.emptyText(status, panel.stored)} />
        {!connected && qrData && <div style={{ marginTop: theme.spacing.md, color: theme.colors.textSecondary, fontSize: theme.fontSize.sm }}>{qr.scanText}</div>}
      </Flex>
      {config.hasRateLimits && connected && <RateLimitSection />}
      {panel.error && <Alert type="error" message={panel.error} showIcon />}
      <ActionBar actions={actions} loading={panel.loading} />
    </Flex>
  );
};

export default QrPairingPanel;
