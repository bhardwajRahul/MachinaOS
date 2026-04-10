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
import { Form, Collapse, Select, InputNumber, Switch, Button, Tag, Space, Spin } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
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
    margin: 0, fontSize: theme.fontSize.xs,
    backgroundColor: `${bg}20`, borderColor: `${bg}50`, color: bg,
  });

  return (
    <Collapse ghost defaultActiveKey={['defaults']} items={[{
      key: 'defaults',
      label: <Space><SettingOutlined /> Default Parameters</Space>,
      children: (
        <Spin spinning={loading}>
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
              <Space wrap size="small" style={{ marginBottom: theme.spacing.md }}>
                {maxOut != null && <Tag style={chipStyle(theme.dracula.green)}>Max Output: {maxOut.toLocaleString()}</Tag>}
                {constraints.context_length != null && <Tag style={chipStyle(theme.dracula.cyan)}>Context: {constraints.context_length.toLocaleString()}</Tag>}
                <Tag style={chipStyle(theme.dracula.purple)}>Temp: {tempMin}-{tempMax}</Tag>
                {canThink && <Tag style={chipStyle(theme.dracula.orange)}>Thinking: {thinkType}</Tag>}
                {constraints.is_reasoning_model && <Tag style={chipStyle(theme.dracula.pink)}>Reasoning</Tag>}
              </Space>
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
        </Spin>
      ),
    }]} />
  );
};

export default ProviderDefaultsSection;
