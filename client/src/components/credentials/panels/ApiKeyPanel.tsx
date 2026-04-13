/**
 * ApiKeyPanel — generic API key panel for AI providers, search, scrapers, services.
 * Composes: Card header + ApiKeyInput. Config-driven, zero per-provider JSX.
 */

import React, { useState, useEffect } from 'react';
import { Alert, Card, Tag, Flex } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import ApiKeyInput from '../../ui/ApiKeyInput';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useCredentialPanel } from '../useCredentialPanel';
import { ProviderDefaultsSection, LlmUsageSection, ApiUsageSection } from '../sections';
import type { ProviderConfig } from '../types';

const ApiKeyPanel: React.FC<{ config: ProviderConfig; visible: boolean }> = ({ config, visible }) => {
  const theme = useAppTheme();
  const panel = useCredentialPanel(config, visible);
  const color = (theme.colors as any)[config.color] ?? config.color;
  const field = config.fields?.[0];
  const iconSize = parseInt(theme.iconSize.md);
  const tagOk = { backgroundColor: `${theme.dracula.green}25`, borderColor: `${theme.dracula.green}60`, color: theme.dracula.green };

  // Local state for the controlled input. antd Form.getFieldValue/setFieldValue
  // are snapshots that don't trigger re-renders — using them as a controlled
  // input's value prop causes typing to be silently rejected. useState is the
  // standard React pattern for controlled inputs.
  const [inputValue, setInputValue] = useState('');

  // Sync from the form when stored credentials load (useCredentialPanel
  // populates the form asynchronously via getStoredApiKey on mount).
  useEffect(() => {
    if (panel.stored && field) {
      const v = panel.form.getFieldValue(field.key);
      if (v) setInputValue(v);
    }
  }, [panel.stored, field, panel.form]);

  // Reset input when switching providers
  useEffect(() => {
    setInputValue('');
  }, [config.id]);

  return (
    <Flex vertical gap={theme.spacing.xl} style={{ padding: theme.spacing.xl }}>
      <Card size="small" styles={{ body: { padding: theme.spacing.lg } }}
        title={
          <Flex align="center" gap={theme.spacing.md}>
            <Flex align="center" justify="center" style={{ width: 48, height: 48, borderRadius: theme.borderRadius.lg, backgroundColor: `${color}15` }}>
              <config.icon size={iconSize} />
            </Flex>
            <span style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{config.name}</span>
          </Flex>}
        extra={panel.stored ? <Tag icon={<CheckCircleOutlined />} style={tagOk}>Connected</Tag> : null}>
        {field && <ApiKeyInput
          value={inputValue}
          onChange={v => { setInputValue(v); panel.form.setFieldValue(field.key, v); panel.setStored(false); }}
          onSave={() => panel.actions.validate(config.id, inputValue.trim()).then(r => { if (r?.isValid) panel.setStored(true); })}
          onDelete={panel.stored ? () => { panel.actions.remove(config.id); setInputValue(''); } : undefined}
          placeholder={field.placeholder}
          loading={panel.loading === 'validate'}
          isStored={panel.stored}
        />}
      </Card>
      {panel.error && <Alert type="error" message={panel.error} showIcon />}
      {config.hasDefaults && <ProviderDefaultsSection providerId={config.id} />}
      {config.hasDefaults && <LlmUsageSection providerId={config.id} providerName={config.name} />}
      {config.usageService && <ApiUsageSection service={config.usageService} serviceName={config.name} />}
    </Flex>
  );
};

export default ApiKeyPanel;
