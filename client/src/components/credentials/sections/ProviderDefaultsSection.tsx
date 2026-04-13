/**
 * ProviderDefaultsSection — antd Form bound to a remote ProviderDefaults object.
 *
 * Uses:
 *   - Form.useForm() + setFieldsValue() — replaces manual defaults state
 *   - Form.Item with label+extra — replaces custom label/desc styling
 *   - Form.Item shouldUpdate — reactive conditional fields from Form state
 *   - Form.useWatch — react to default_model changes to refetch constraints
 *   - Collapse native header — no custom rendering
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Select, InputNumber, Switch, Button } from 'antd';
import { Settings } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useApiKeys, type ProviderDefaults, type ModelConstraints } from '../../../hooks/useApiKeys';

interface Props {
  providerId: string;
}

const ProviderDefaultsSection: React.FC<Props> = ({ providerId }) => {
  const theme = useAppTheme();
  const { getProviderDefaults, saveProviderDefaults, getStoredModels, getModelConstraints, isConnected } = useApiKeys();

  const [form] = Form.useForm<ProviderDefaults>();
  const [models, setModels] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<ModelConstraints | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Watch default_model from the Form — refetch constraints when it changes
  const selectedModel = Form.useWatch('default_model', form);
  const thinkingEnabled = Form.useWatch('thinking_enabled', form);

  // Load defaults + models on mount
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [d, m] = await Promise.all([getProviderDefaults(providerId), getStoredModels(providerId)]);
        if (!cancelled) {
          form.setFieldsValue(d);
          if (m?.length) setModels(m);
          setDirty(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId, isConnected]);

  // Refetch constraints when selected model changes
  useEffect(() => {
    if (!isConnected || !selectedModel) return;
    let cancelled = false;
    getModelConstraints(selectedModel, providerId).then(c => {
      if (cancelled) return;
      setConstraints(c);
      if (c?.max_output_tokens && form.getFieldValue('max_tokens') !== c.max_output_tokens) {
        form.setFieldValue('max_tokens', c.max_output_tokens);
      }
    });
    return () => { cancelled = true; };
  }, [selectedModel, providerId, isConnected]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const ok = await saveProviderDefaults(providerId, values);
      if (ok) setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [form, providerId, saveProviderDefaults]);

  // Derived from constraints
  const [tempMin, tempMax] = constraints?.temperature_range ?? [0, 2];
  const maxOut = constraints?.max_output_tokens;
  const thinkType = constraints?.thinking_type;
  const canThink = constraints?.supports_thinking;
  const fixedTemp = constraints?.is_reasoning_model && tempMin === tempMax;

  const chipStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: `${bg}20`, borderColor: `${bg}50`, color: bg,
  });

  return (
    <Accordion type="single" collapsible defaultValue="defaults">
      <AccordionItem value="defaults">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Default Parameters
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className={loading ? 'pointer-events-none opacity-60' : ''}>
            <Form form={form} layout="vertical" size="small" onValuesChange={() => setDirty(true)} preserve>
            <Form.Item
              label="Default Model"
              name="default_model"
              extra="Model used when none specified"
            >
              <Select showSearch placeholder="Select model"
                options={models.map(m => ({ label: m, value: m }))}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                notFoundContent={models.length ? 'No models found' : 'Validate API key first'}
                popupMatchSelectWidth={false}
                getPopupContainer={trigger => trigger.parentElement || document.body}
                listHeight={300}
              />
            </Form.Item>

            {constraints && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {maxOut != null && <Badge style={chipStyle(theme.dracula.green)}>Max Output: {maxOut.toLocaleString()}</Badge>}
                {constraints.context_length != null && <Badge style={chipStyle(theme.dracula.cyan)}>Context: {constraints.context_length.toLocaleString()}</Badge>}
                <Badge style={chipStyle(theme.dracula.purple)}>Temp: {tempMin}-{tempMax}</Badge>
                {canThink && <Badge style={chipStyle(theme.dracula.orange)}>Thinking: {thinkType}</Badge>}
                {constraints.is_reasoning_model && <Badge style={chipStyle(theme.dracula.pink)}>Reasoning</Badge>}
              </div>
            )}

            {!fixedTemp && (
              <Form.Item label="Temperature" name="temperature" extra={`Controls randomness (${tempMin}-${tempMax})`}>
                <InputNumber min={tempMin} max={tempMax} step={0.1} style={{ width: 100 }} />
              </Form.Item>
            )}

            <Form.Item label="Max Tokens" name="max_tokens"
              extra={maxOut != null ? `Up to ${maxOut.toLocaleString()}` : 'Maximum response length'}>
              <InputNumber min={1} max={maxOut || undefined} style={{ width: 140 }} />
            </Form.Item>

            {canThink && (
              <Form.Item label="Thinking / Reasoning" name="thinking_enabled" valuePropName="checked"
                extra={`Extended thinking (${thinkType})`}>
                <Switch />
              </Form.Item>
            )}

            {canThink && thinkType === 'budget' && thinkingEnabled && (
              <Form.Item label="Thinking Budget" name="thinking_budget" extra="Token budget (1024-16000)">
                <InputNumber min={1024} max={16000} style={{ width: 120 }} />
              </Form.Item>
            )}

            {canThink && thinkType === 'effort' && thinkingEnabled && (
              <Form.Item label="Reasoning Effort" name="reasoning_effort" extra="Low, medium, or high">
                <Select style={{ width: 130 }}
                  options={[{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }]}
                  getPopupContainer={trigger => trigger.parentElement || document.body} />
              </Form.Item>
            )}

            {canThink && thinkType === 'format' && thinkingEnabled && (
              <Form.Item label="Reasoning Format" name="reasoning_format" extra="Parsed or hidden">
                <Select style={{ width: 130 }}
                  options={[{ label: 'Parsed', value: 'parsed' }, { label: 'Hidden', value: 'hidden' }]}
                  getPopupContainer={trigger => trigger.parentElement || document.body} />
              </Form.Item>
            )}

            <Button onClick={handleSave} disabled={!dirty} loading={loading} block
              style={{
                backgroundColor: dirty ? `${theme.dracula.green}25` : undefined,
                borderColor: dirty ? `${theme.dracula.green}60` : undefined,
                color: dirty ? theme.dracula.green : undefined,
              }}>
              Save Defaults
            </Button>
          </Form>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ProviderDefaultsSection;
