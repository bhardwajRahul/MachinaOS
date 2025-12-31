import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, List, Tag, Spin } from 'antd';
import {
  LinkOutlined,
  ReloadOutlined,
  CopyOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { useWebSocket } from '../../contexts/WebSocketContext';
import DataPanel from '../shared/DataPanel';
import { copyToClipboard } from '../../utils/formatters';

const { Text } = Typography;

interface InputNodesPanelProps {
  nodeId: string;
}

interface InputDataItem {
  index: number;
  data: any;
  source: string; // Which node this data came from
}

const InputNodesPanel: React.FC<InputNodesPanelProps> = ({ nodeId }) => {
  const { currentWorkflow } = useAppStore();
  const { getNodeOutput } = useWebSocket();
  const [inputData, setInputData] = useState<InputDataItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch actual input data from backend (async)
  useEffect(() => {
    const fetchInputData = async () => {
      if (!currentWorkflow || !nodeId) {
        setInputData([]);
        return;
      }

      setLoading(true);
      const nodes = currentWorkflow.nodes || [];
      const edges = currentWorkflow.edges || [];

      // Find edges that connect TO the current node (incoming connections)
      const incomingEdges = edges.filter((edge: any) => edge.target === nodeId);

      const inputItems: InputDataItem[] = [];

      // Fetch data from backend for each connected node
      for (const edge of incomingEdges) {
        const sourceNode = nodes.find((node: any) => node.id === edge.source);
        const sourceName = sourceNode?.data?.label || sourceNode?.type || 'Unknown';

        // Get the actual output data from backend via WebSocket
        const outputData = await getNodeOutput(edge.source, 'output_0');

        if (outputData && outputData[0] && outputData[0][0]) {
          // Real execution data exists
          const actualData = outputData[0][0].json || outputData[0][0];
          inputItems.push({
            index: inputItems.length,
            data: actualData,
            source: sourceName
          });
        }
      }

      setInputData(inputItems);
      setLoading(false);
    };

    fetchInputData();
  }, [nodeId, currentWorkflow, getNodeOutput]);

  const hasExecutionData = inputData.length > 0;

  if (loading) {
    return (
      <DataPanel.Empty
        icon={<Spin size="large" />}
        title="Loading input data..."
        description="Fetching execution data from backend"
      />
    );
  }

  if (!hasExecutionData) {
    return (
      <DataPanel.Empty
        icon={<DatabaseOutlined style={{ fontSize: 48, color: '#94a3b8' }} />}
        title="No input data"
        description="Execute connected nodes to see the input data received by this node"
      />
    );
  }

  return (
    <DataPanel.Root>
      <DataPanel.Header
        title={
          <Space>
            <LinkOutlined />
            <Text strong style={{ fontSize: 13 }}>Input Data ({inputData.length} item{inputData.length !== 1 ? 's' : ''})</Text>
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              // Trigger re-fetch by updating a dummy state
              setInputData([]);
              setLoading(true);
            }}
            type="text"
            title="Refresh input data from backend"
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      <DataPanel.Content>
        <List
          size="small"
          dataSource={inputData}
          renderItem={(inputItem) => (
            <List.Item key={inputItem.index}>
              <Card
                size="small"
                style={{
                  width: '100%',
                  marginBottom: 8,
                  borderLeft: '4px solid #10b981'
                }}
              >
                {/* Input Item Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <Space>
                    <DatabaseOutlined style={{ color: '#10b981', fontSize: 16 }} />
                    <Text strong style={{ fontSize: 14 }}>
                      Item {inputItem.index + 1}
                    </Text>
                    <Tag color="green" style={{ margin: 0 }}>
                      from {inputItem.source}
                    </Tag>
                  </Space>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(inputItem.data, 'Input data copied to clipboard!')}
                    type="text"
                    title="Copy input data"
                  >
                    Copy
                  </Button>
                </div>

                {/* JSON Input Data */}
                <Card
                  size="small"
                  title={<Text strong style={{ fontSize: 12 }}>Received Data</Text>}
                  headStyle={{ backgroundColor: '#f0fdf4', minHeight: 'auto', padding: '8px 12px' }}
                  bodyStyle={{ padding: 12 }}
                >
                  <pre style={{
                    margin: 0,
                    fontSize: 12,
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    lineHeight: 1.4,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 300,
                    backgroundColor: '#f8fafc',
                    padding: 12,
                    borderRadius: 4,
                    border: '1px solid #d1d5db'
                  }}>
                    {JSON.stringify(inputItem.data, null, 2)}
                  </pre>
                </Card>
              </Card>
            </List.Item>
          )}
        />
      </DataPanel.Content>

      <DataPanel.Footer>
        <Text type="secondary" style={{ fontSize: 11 }}>
          💡 Shows actual data received by this node during execution
        </Text>
      </DataPanel.Footer>
    </DataPanel.Root>
  );
};

export default InputNodesPanel;