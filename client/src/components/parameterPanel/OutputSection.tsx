import React from 'react';
import NodeOutputPanel from '../ui/NodeOutputPanel';
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

    // Check if there's output from workflow execution in nodeStatuses
    const nodeStatus = nodeStatuses[selectedNode.id];
    if (nodeStatus && nodeStatus.data && (nodeStatus.status === 'success' || nodeStatus.status === 'error')) {
      // Check if this output is already in executionResults
      const alreadyExists = results.some(r =>
        r.nodeId === selectedNode.id &&
        JSON.stringify(r.outputs) === JSON.stringify(nodeStatus.data)
      );

      if (!alreadyExists) {
        // Create ExecutionResult from nodeStatus (from workflow execution)
        const wsResult: ExecutionResult = {
          success: nodeStatus.status === 'success',
          nodeId: selectedNode.id,
          nodeType: selectedNode.type || 'unknown',
          nodeName: selectedNode.type || 'Node',
          timestamp: new Date().toISOString(),
          executionTime: 0,
          outputs: nodeStatus.data,
          nodeData: [[{ json: nodeStatus.data }]],
          error: nodeStatus.status === 'error' ? nodeStatus.data?.error : undefined
        };
        // Add WebSocket result to the beginning (most recent)
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
      <NodeOutputPanel
        results={combinedResults}
        onClear={onClearResults}
        selectedNode={selectedNode}
      />
    </div>
  );
};

export default OutputSection;