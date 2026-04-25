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
import { useCredentialPanel } from '../useCredentialPanel';
import { ProviderDefaultsSection, LlmUsageSection, ApiUsageSection } from '../sections';
import type { ProviderConfig } from '../types';

const ApiKeyPanel: React.FC<{ config: ProviderConfig; visible: boolean }> = ({ config, visible }) => {
  const panel = useCredentialPanel(config, visible);
  const field = config.fields?.[0];

  const [inputValue, setInputValue] = useState('');
  // Direct local flag — same pattern as main repo's validKeys[id].
  // Completely independent from useCredentialPanel's stored state.
  const [validated, setValidated] = useState(panel.stored);

  // Sync from the form when stored credentials load
  useEffect(() => {
    if (panel.stored && field) {
      const v = panel.form.getFieldValue(field.key);
      if (v) {
        setInputValue(v);
        setValidated(true);
      }
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
              // config.color is per-provider brand metadata (data-driven,
              // same carve-out as canvas nodeColor); CSS color-mix keeps
              // the math in CSS rather than as JS string concat.
              style={{ backgroundColor: `color-mix(in srgb, ${config.color} 8%, transparent)` }}
            >
              <config.icon className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">{config.name}</CardTitle>
          </div>
          {validated && (
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
                setValidated(false);
              }}
              onSave={() =>
                panel.actions
                  .validate(config.id, inputValue.trim())
                  .then((r) => {
                    if (r?.isValid) setValidated(true);
                  })
              }
              onDelete={
                validated
                  ? () => {
                      panel.actions.remove(config.id);
                      setInputValue('');
                      setValidated(false);
                    }
                  : undefined
              }
              placeholder={field.placeholder}
              loading={panel.loading === 'validate'}
              isStored={validated}
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
