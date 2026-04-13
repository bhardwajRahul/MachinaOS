import React from 'react';
import OutputPanel from '../output/OutputPanel';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ExecutionResult } from '../../services/executionService';
import { Node } from 'reactflow';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface OutputSectionProps {
  selectedNode: Node;
  executionResults: ExecutionResult[];
  onClearResults: () => void;
  visible?: boolean;
}

const OutputSection: React.FC<OutputSectionProps> = ({
  selectedNode,
  executionResults,
  onClearResults,
  visible = true
}) => {
  const theme = useAppTheme();
  const { nodeStatuses } = useWebSocket();

  if (!visible) {
    return null;
  }

  // Combine local execution results with WebSocket nodeStatuses from workflow execution
  const combinedResults = React.useMemo(() => {
    const results = [...executionResults];

    // Check if there's output from workflow execution in nodeStatuses.
    // WebSocket node_output messages store data in the `output` field,
    // while node_status messages use `data`. Check both so the formatted
    // response renderer (getMainResponse → ReactMarkdown) receives the
    // actual AI response object instead of falling through to raw JSON.
    const nodeStatus = nodeStatuses[selectedNode.id];
    const statusData = nodeStatus?.data || nodeStatus?.output;
    if (nodeStatus && statusData && (nodeStatus.status === 'success' || nodeStatus.status === 'error')) {
      const alreadyExists = results.some(r =>
        r.nodeId === selectedNode.id &&
        JSON.stringify(r.outputs) === JSON.stringify(statusData)
      );

      if (!alreadyExists) {
        const wsResult: ExecutionResult = {
          success: nodeStatus.status === 'success',
          nodeId: selectedNode.id,
          nodeType: selectedNode.type || 'unknown',
          nodeName: selectedNode.type || 'Node',
          timestamp: new Date().toISOString(),
          executionTime: 0,
          outputs: statusData,
          nodeData: [[{ json: statusData }]],
          error: nodeStatus.status === 'error' ? statusData?.error : undefined
        };
        results.unshift(wsResult);
      }
    }

    return results;
  }, [executionResults, nodeStatuses, selectedNode.id, selectedNode.type]);

  return (
    <div style={{
      backgroundColor: theme.colors.backgroundPanel,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <OutputPanel
        results={combinedResults}
        onClear={onClearResults}
        selectedNode={selectedNode}
      />
    </div>
  );
};

export default OutputSection;