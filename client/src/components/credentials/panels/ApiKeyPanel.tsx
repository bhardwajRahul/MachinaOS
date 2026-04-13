/**
 * ApiKeyPanel — generic API key panel for AI providers, search, scrapers, services.
 * Composes: Card header + ApiKeyInput. Config-driven, zero per-provider JSX.
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    <div className="flex flex-col gap-5 p-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}15` }}
            >
              <config.icon size={iconSize} />
            </div>
            <CardTitle className="text-lg">{config.name}</CardTitle>
          </div>
          {panel.stored && (
            <Badge variant="success" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {field && (
            <ApiKeyInput
              value={inputValue}
              onChange={(v) => {
                setInputValue(v);
                panel.form.setFieldValue(field.key, v);
                panel.setStored(false);
              }}
              onSave={() =>
                panel.actions
                  .validate(config.id, inputValue.trim())
                  .then((r) => {
                    if (r?.isValid) panel.setStored(true);
                  })
              }
              onDelete={
                panel.stored
                  ? () => {
                      panel.actions.remove(config.id);
                      setInputValue('');
                    }
                  : undefined
              }
              placeholder={field.placeholder}
              loading={panel.loading === 'validate'}
              isStored={panel.stored}
            />
          )}
        </CardContent>
      </Card>

      {panel.error && (
        <Alert variant="destructive">
          <AlertDescription>{panel.error}</AlertDescription>
        </Alert>
      )}

      {config.hasDefaults && <ProviderDefaultsSection providerId={config.id} />}
      {config.hasDefaults && <LlmUsageSection providerId={config.id} providerName={config.name} />}
      {config.usageService && <ApiUsageSection service={config.usageService} serviceName={config.name} />}
    </div>
  );
};

export default ApiKeyPanel;
