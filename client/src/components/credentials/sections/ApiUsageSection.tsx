/**
 * ApiUsageSection — generic API call stats for external services.
 * Used by Twitter, Google Workspace, Google Maps panels.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Collapse, Statistic, Alert, Button, Tag, Space, Spin, Flex, Descriptions } from 'antd';
import { DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useApiKeys, type APIUsageSummary } from '../../../hooks/useApiKeys';

interface Props {
  service: string;
  serviceName: string;
}

const ApiUsageSection: React.FC<Props> = ({ service, serviceName }) => {
  const theme = useAppTheme();
  const { getAPIUsageSummary, isConnected } = useApiKeys();
  const [data, setData] = useState<APIUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const services = await getAPIUsageSummary(service);
      setData(services.find(s => s.service === service) ?? null);
    } finally {
      setLoading(false);
    }
  }, [isConnected, service, getAPIUsageSummary]);

  useEffect(() => { load(); }, [load]);

  const costTag = data ? (
    <Tag style={{ backgroundColor: `${theme.dracula.green}25`, borderColor: `${theme.dracula.green}60`, color: theme.dracula.green }}>
      ${data.total_cost.toFixed(4)}
    </Tag>
  ) : null;

  return (
    <Collapse items={[{
      key: 'usage',
      label: <Space><DollarOutlined style={{ color: theme.dracula.yellow }} /> API Usage &amp; Costs {costTag}</Space>,
      children: loading ? (
        <Flex justify="center" style={{ padding: theme.spacing.lg }}><Spin size="small" /></Flex>
      ) : !data ? (
        <Alert type="info" showIcon
          message={`No usage data yet. Use ${serviceName} nodes in your workflows to track costs.`} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex gap={theme.spacing.md} wrap="wrap">
            <Statistic title="Total Cost" value={data.total_cost} precision={4} prefix="$"
              valueStyle={{ color: theme.dracula.green, fontSize: theme.fontSize.lg }} />
            <Statistic title="API Calls" value={data.execution_count}
              valueStyle={{ color: theme.dracula.cyan, fontSize: theme.fontSize.lg }} />
            <Statistic title="Resources" value={data.total_resources}
              valueStyle={{ color: theme.dracula.purple, fontSize: theme.fontSize.lg }} />
          </Flex>

          {data.operations?.length > 0 && (
            <Descriptions size="small" column={1} bordered title="Operations Breakdown">
              {data.operations.map(op => (
                <Descriptions.Item key={op.operation} label={<code>{op.operation}</code>}>
                  <Space>
                    <Tag>{op.resource_count} resources</Tag>
                    <Tag style={{ backgroundColor: `${theme.dracula.green}15`, color: theme.dracula.green, border: 'none' }}>
                      ${op.total_cost.toFixed(4)}
                    </Tag>
                  </Space>
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

export default ApiUsageSection;
