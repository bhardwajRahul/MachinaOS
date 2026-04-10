/**
 * LlmUsageSection — token usage and costs for an AI provider.
 * Uses antd Collapse + Statistic + Descriptions for fully declarative display.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Collapse, Statistic, Descriptions, Alert, Space, Button, Spin, Flex } from 'antd';
import { DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useApiKeys, type ProviderUsageSummary } from '../../../hooks/useApiKeys';

interface Props {
  providerId: string;
  providerName: string;
}

const LlmUsageSection: React.FC<Props> = ({ providerId, providerName }) => {
  const theme = useAppTheme();
  const { getProviderUsageSummary, isConnected } = useApiKeys();
  const [data, setData] = useState<ProviderUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const summary = await getProviderUsageSummary();
      setData(summary.find(p => p.provider === providerId) ?? null);
    } finally {
      setLoading(false);
    }
  }, [isConnected, providerId, getProviderUsageSummary]);

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  return (
    <Collapse ghost
      onChange={keys => setExpanded(Array.isArray(keys) ? keys.includes('usage') : keys === 'usage')}
      items={[{
        key: 'usage',
        label: <Space><DollarOutlined /> Usage &amp; Costs</Space>,
        children: loading ? (
          <Flex justify="center" style={{ padding: theme.spacing.lg }}><Spin size="small" /></Flex>
        ) : !data || data.execution_count === 0 ? (
          <Alert type="info" showIcon message={`No usage data yet for ${providerName}`} />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Flex gap={theme.spacing.lg} wrap="wrap">
              <Statistic title="Total Tokens" value={data.total_tokens}
                valueStyle={{ color: theme.dracula.cyan, fontSize: theme.fontSize.lg }} />
              <Statistic title="Total Cost" value={data.total_cost} precision={4} prefix="$"
                valueStyle={{ color: theme.dracula.green, fontSize: theme.fontSize.lg }} />
              <Statistic title="Executions" value={data.execution_count}
                valueStyle={{ color: theme.dracula.purple, fontSize: theme.fontSize.lg }} />
            </Flex>

            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Input Tokens">
                {data.total_input_tokens.toLocaleString()}
                <span style={{ color: theme.dracula.green, marginLeft: theme.spacing.sm }}>
                  (${data.total_input_cost.toFixed(4)})
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Output Tokens">
                {data.total_output_tokens.toLocaleString()}
                <span style={{ color: theme.dracula.green, marginLeft: theme.spacing.sm }}>
                  (${data.total_output_cost.toFixed(4)})
                </span>
              </Descriptions.Item>
              {data.total_cache_cost > 0 && (
                <Descriptions.Item label="Cache Cost" span={2}>
                  <span style={{ color: theme.dracula.green }}>${data.total_cache_cost.toFixed(4)}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            {data.models.length > 1 && (
              <Descriptions size="small" column={1} title="By Model" bordered>
                {data.models.map(m => (
                  <Descriptions.Item key={m.model} label={<code style={{ fontSize: theme.fontSize.xs }}>{m.model}</code>}>
                    <span style={{ color: theme.dracula.green }}>${m.total_cost.toFixed(4)}</span>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}

            <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          </Space>
        ),
      }]} />
  );
};

export default LlmUsageSection;
