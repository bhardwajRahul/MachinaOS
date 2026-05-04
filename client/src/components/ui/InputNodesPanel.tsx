import React, { useState, useEffect } from 'react';
import { Link2, RefreshCw, Copy, Database, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '../../store/useAppStore';
import { useWebSocket } from '../../contexts/WebSocketContext';
import DataPanel from '../shared/DataPanel';
import { copyToClipboard } from '../../utils/formatters';

interface InputNodesPanelProps {
  nodeId: string;
}

interface InputDataItem {
  index: number;
  data: any;
  source: string;
}

const InputNodesPanel: React.FC<InputNodesPanelProps> = ({ nodeId }) => {
  const currentWorkflow = useAppStore((s) => s.currentWorkflow);
  const { getNodeOutput } = useWebSocket();
  const [inputData, setInputData] = useState<InputDataItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInputData = async () => {
      if (!currentWorkflow || !nodeId) {
        setInputData([]);
        return;
      }

      setLoading(true);
      const nodes = currentWorkflow.nodes || [];
      const edges = currentWorkflow.edges || [];
      const incomingEdges = edges.filter((edge: any) => edge.target === nodeId);
      const inputItems: InputDataItem[] = [];

      for (const edge of incomingEdges) {
        const sourceNode = nodes.find((node: any) => node.id === edge.source);
        const sourceName = sourceNode?.data?.label || sourceNode?.type || 'Unknown';
        const outputData = await getNodeOutput(edge.source, 'output_0');

        if (outputData && outputData[0] && outputData[0][0]) {
          const actualData = outputData[0][0].json || outputData[0][0];
          inputItems.push({
            index: inputItems.length,
            data: actualData,
            source: sourceName,
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
        icon={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
        title="Loading input data..."
        description="Fetching execution data from backend"
      />
    );
  }

  if (!hasExecutionData) {
    return (
      <DataPanel.Empty
        icon={<Database className="h-12 w-12 text-muted-foreground" />}
        title="No input data"
        description="Execute connected nodes to see the input data received by this node"
      />
    );
  }

  return (
    <DataPanel.Root>
      <DataPanel.Header
        title={
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Input Data ({inputData.length} item{inputData.length !== 1 ? 's' : ''})
            </span>
          </div>
        }
        extra={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInputData([]);
              setLoading(true);
            }}
            title="Refresh input data from backend"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <DataPanel.Content>
        <div className="flex flex-col gap-2">
          {inputData.map((inputItem) => (
            <div
              key={inputItem.index}
              className="rounded-md border border-border border-l-4 border-l-success bg-card p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold">Item {inputItem.index + 1}</span>
                  <Badge variant="success">from {inputItem.source}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(inputItem.data, 'Input data copied to clipboard!')}
                  title="Copy input data"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>

              <div className="overflow-hidden rounded-md border border-border">
                <div className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">
                  Received Data
                </div>
                <pre className="m-0 max-h-[300px] overflow-auto whitespace-pre-wrap break-words bg-muted/40 p-3 font-mono text-xs leading-[1.4]">
                  {JSON.stringify(inputItem.data, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </DataPanel.Content>

      <DataPanel.Footer>
        <span className="text-[11px] text-muted-foreground">
          Shows actual data received by this node during execution
        </span>
      </DataPanel.Footer>
    </DataPanel.Root>
  );
};

export default InputNodesPanel;
