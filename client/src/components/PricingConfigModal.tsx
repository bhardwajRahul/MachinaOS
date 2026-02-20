/**
 * PricingConfigModal - View and edit pricing configuration
 * Displays LLM and API pricing in a tree view with inline editing
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tabs, InputNumber, Collapse, Spin, message } from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import Modal from './ui/Modal';
import { usePricing, PricingConfig, LLMPricing } from '../hooks/usePricing';
import { useAppTheme } from '../hooks/useAppTheme';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface LLMModelRowProps {
  model: string;
  pricing: LLMPricing;
  onChange: (field: keyof LLMPricing, value: number) => void;
  theme: ReturnType<typeof useAppTheme>;
}

const LLMModelRow: React.FC<LLMModelRowProps> = ({ model, pricing, onChange, theme }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: model === '_default' ? `${theme.dracula.purple}15` : 'transparent',
  }}>
    <div style={{
      flex: 1,
      fontFamily: 'monospace',
      fontSize: 13,
      color: model === '_default' ? theme.dracula.purple : theme.colors.text,
    }}>
      {model === '_default' ? 'Default' : model}
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Input:</span>
      <InputNumber
        size="small"
        min={0}
        step={0.01}
        value={pricing.input}
        onChange={(v) => onChange('input', v ?? 0)}
        style={{ width: 80 }}
        prefix="$"
      />
      <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Output:</span>
      <InputNumber
        size="small"
        min={0}
        step={0.01}
        value={pricing.output}
        onChange={(v) => onChange('output', v ?? 0)}
        style={{ width: 80 }}
        prefix="$"
      />
      {pricing.cache_read !== undefined && (
        <>
          <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Cache:</span>
          <InputNumber
            size="small"
            min={0}
            step={0.01}
            value={pricing.cache_read}
            onChange={(v) => onChange('cache_read', v ?? 0)}
            style={{ width: 70 }}
            prefix="$"
          />
        </>
      )}
      {pricing.reasoning !== undefined && (
        <>
          <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Reasoning:</span>
          <InputNumber
            size="small"
            min={0}
            step={0.01}
            value={pricing.reasoning}
            onChange={(v) => onChange('reasoning', v ?? 0)}
            style={{ width: 80 }}
            prefix="$"
          />
        </>
      )}
    </div>
  </div>
);

interface APIPricingRowProps {
  operation: string;
  price: number;
  onChange: (value: number) => void;
  theme: ReturnType<typeof useAppTheme>;
}

const APIPricingRow: React.FC<APIPricingRowProps> = ({ operation, price, onChange, theme }) => {
  // Skip metadata keys
  if (operation.startsWith('_')) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 13,
        color: theme.colors.text,
      }}>
        {operation}
      </div>
      <InputNumber
        size="small"
        min={0}
        step={0.001}
        value={price}
        onChange={(v) => onChange(v ?? 0)}
        style={{ width: 100 }}
        prefix="$"
      />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PricingConfigModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useAppTheme();
  const { getPricingConfig, savePricingConfig, isConnected } = usePricing();

  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load config on mount
  const loadConfig = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const data = await getPricingConfig();
      setConfig(data);
      setIsDirty(false);
    } catch (error) {
      message.error('Failed to load pricing config');
    } finally {
      setLoading(false);
    }
  }, [getPricingConfig, isConnected]);

  useEffect(() => {
    if (visible) {
      loadConfig();
    }
  }, [visible, loadConfig]);

  // Save config
  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const success = await savePricingConfig(config);
      if (success) {
        message.success('Pricing config saved');
        setIsDirty(false);
      } else {
        message.error('Failed to save pricing config');
      }
    } catch (error) {
      message.error('Failed to save pricing config');
    } finally {
      setSaving(false);
    }
  }, [config, savePricingConfig]);

  // Update LLM pricing
  const updateLLMPricing = useCallback((
    provider: string,
    model: string,
    field: keyof LLMPricing,
    value: number
  ) => {
    if (!config) return;
    setConfig(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (!updated.llm[provider]) updated.llm[provider] = {};
      if (!updated.llm[provider][model]) {
        updated.llm[provider][model] = { input: 0, output: 0 };
      }
      updated.llm[provider][model] = { ...updated.llm[provider][model], [field]: value };
      return updated;
    });
    setIsDirty(true);
  }, [config]);

  // Update API pricing
  const updateAPIPricing = useCallback((
    service: string,
    operation: string,
    value: number
  ) => {
    if (!config) return;
    setConfig(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (!updated.api[service]) updated.api[service] = {};
      (updated.api[service] as Record<string, number>)[operation] = value;
      return updated;
    });
    setIsDirty(true);
  }, [config]);

  // Render LLM tab
  const renderLLMTab = () => {
    if (!config?.llm) return null;

    const providers = Object.keys(config.llm).sort();

    return (
      <Collapse
        defaultActiveKey={providers.slice(0, 2)}
        style={{ background: 'transparent' }}
      >
        {providers.map(provider => {
          const models = config.llm[provider];
          const modelNames = Object.keys(models).sort((a, b) => {
            if (a === '_default') return 1;
            if (b === '_default') return -1;
            return a.localeCompare(b);
          });

          return (
            <Collapse.Panel
              key={provider}
              header={
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                  {provider}
                  <span style={{ marginLeft: 8, fontSize: 12, color: theme.colors.textSecondary }}>
                    ({modelNames.length} models)
                  </span>
                </span>
              }
            >
              <div style={{ fontSize: 11, color: theme.colors.textSecondary, padding: '4px 12px' }}>
                Prices in USD per million tokens (MTok)
              </div>
              {modelNames.map(model => (
                <LLMModelRow
                  key={model}
                  model={model}
                  pricing={models[model]}
                  onChange={(field, value) => updateLLMPricing(provider, model, field, value)}
                  theme={theme}
                />
              ))}
            </Collapse.Panel>
          );
        })}
      </Collapse>
    );
  };

  // Render API tab
  const renderAPITab = () => {
    if (!config?.api) return null;

    const services = Object.keys(config.api).sort();

    return (
      <Collapse
        defaultActiveKey={services}
        style={{ background: 'transparent' }}
      >
        {services.map(service => {
          const operations = config.api[service];
          const opNames = Object.keys(operations).filter(k => !k.startsWith('_')).sort();
          const description = (operations as Record<string, string | number>)._description as string | undefined;
          const source = (operations as Record<string, string | number>)._source as string | undefined;

          return (
            <Collapse.Panel
              key={service}
              header={
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                  {service}
                  <span style={{ marginLeft: 8, fontSize: 12, color: theme.colors.textSecondary }}>
                    ({opNames.length} operations)
                  </span>
                </span>
              }
            >
              {description && (
                <div style={{ fontSize: 12, color: theme.colors.textSecondary, padding: '4px 12px 8px' }}>
                  {description}
                  {source && (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 8, color: theme.dracula.cyan }}
                    >
                      Source
                    </a>
                  )}
                </div>
              )}
              <div style={{ fontSize: 11, color: theme.colors.textSecondary, padding: '0 12px 4px' }}>
                Prices in USD per resource/request
              </div>
              {opNames.map(operation => (
                <APIPricingRow
                  key={operation}
                  operation={operation}
                  price={(operations as Record<string, number>)[operation]}
                  onChange={(value) => updateAPIPricing(service, operation, value)}
                  theme={theme}
                />
              ))}
            </Collapse.Panel>
          );
        })}
      </Collapse>
    );
  };

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      title="Pricing Configuration"
      maxWidth="700px"
      maxHeight="85vh"
      headerActions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadConfig}
            loading={loading}
          >
            Reload
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!isDirty}
            style={{
              backgroundColor: isDirty ? theme.dracula.green : undefined,
              borderColor: isDirty ? theme.dracula.green : undefined,
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : config ? (
          <>
            {/* Version info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              padding: '8px 12px',
              backgroundColor: theme.colors.backgroundPanel,
              borderRadius: theme.borderRadius.sm,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarOutlined style={{ color: theme.dracula.yellow }} />
                <span style={{ color: theme.colors.textSecondary }}>
                  Version: <strong style={{ color: theme.colors.text }}>{config.version}</strong>
                </span>
              </div>
              <span style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                Last updated: {config.last_updated}
              </span>
            </div>

            {/* Tabs */}
            <Tabs
              defaultActiveKey="llm"
              items={[
                {
                  key: 'llm',
                  label: 'LLM Pricing',
                  children: renderLLMTab(),
                },
                {
                  key: 'api',
                  label: 'API Pricing',
                  children: renderAPITab(),
                },
              ]}
            />
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: theme.colors.textSecondary }}>
            {isConnected ? 'Failed to load config' : 'Not connected'}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PricingConfigModal;
