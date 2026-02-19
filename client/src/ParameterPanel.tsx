import React from 'react';
import Modal from './components/ui/Modal';
import ParameterPanelLayout from './components/parameterPanel/ParameterPanelLayout';
import { useParameterPanel } from './hooks/useParameterPanel';
import { useAppStore } from './store/useAppStore';
import { useWebSocket } from './contexts/WebSocketContext';
import { ExecutionService, ExecutionResult } from './services/executionService';
import { useAppTheme } from './hooks/useAppTheme';
import { ScheduleOutlined, PlayCircleFilled } from '@ant-design/icons';
import { SKILL_NODE_TYPES } from './nodeDefinitions/skillNodes';

const ParameterPanel: React.FC = () => {
  const theme = useAppTheme();
  const {
    selectedNode,
    nodeDefinition,
    parameters,
    hasUnsavedChanges,
    handleParameterChange,
    handleSave,
    handleCancel,
    isLoading,
  } = useParameterPanel();

  const { currentWorkflow } = useAppStore();
  const { executeNode, getNodeParameters, clearNodeStatus, cancelEventWait, getNodeStatus } = useWebSocket();

  // Get current node status to check if waiting
  const nodeStatus = selectedNode ? getNodeStatus(selectedNode.id) : null;
  const isWaiting = nodeStatus?.status === 'waiting';

  // Execution state
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executionResults, setExecutionResults] = React.useState<ExecutionResult[]>([]);
  

  const handleModalClose = () => {
    handleCancel();
  };

  // Execute the current node
  const handleRun = async () => {
    if (!selectedNode || !nodeDefinition) return;
    
    // Save parameters first if there are unsaved changes
    if (hasUnsavedChanges) {
      await handleSave();
    }
    
    setIsExecuting(true);
    
    try {
      
      // Get current workflow nodes and edges from app store
      const nodes = currentWorkflow?.nodes || [];
      const edges = currentWorkflow?.edges || [];
      
      // Execute node via WebSocket
      const result: ExecutionResult = await ExecutionService.executeNodeViaWebSocket(
        selectedNode.id,
        nodeDefinition.name,
        executeNode,
        getNodeParameters,
        nodes,
        edges
      );

      // Debug logging
      console.log('[ParameterPanel] Execution result:', result);
      console.log('[ParameterPanel] Result nodeId:', result.nodeId);
      console.log('[ParameterPanel] Result outputs:', result.outputs);
      console.log('[ParameterPanel] Selected node id:', selectedNode.id);

      // Add result to the beginning of the array (newest first)
      setExecutionResults(prev => [result, ...prev]);
      
    } catch (error: any) {
      console.error('Execution failed:', error);
      
      // Add error result
      const errorResult: ExecutionResult = {
        success: false,
        nodeId: selectedNode.id,
        nodeType: nodeDefinition.name,
        nodeName: nodeDefinition.displayName,
        timestamp: new Date().toISOString(),
        executionTime: 0,
        error: error.message || 'Unknown execution error',
        nodeData: [[{
          json: {
            error: error.message || 'Unknown execution error',
            nodeId: selectedNode.id,
            success: false,
            timestamp: new Date().toISOString()
          }
        }]]
      };
      
      setExecutionResults(prev => [errorResult, ...prev]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Clear execution results (both local state and WebSocket nodeStatuses)
  const handleClearResults = () => {
    setExecutionResults([]);
    // Also clear the node status from WebSocket context
    if (selectedNode) {
      clearNodeStatus(selectedNode.id);
    }
  };


  // Check if node can be executed
  const canExecute = selectedNode && nodeDefinition &&
    ExecutionService.isNodeTypeSupported(nodeDefinition.name);

  // Check if this is a Start node, Skill node, or Monitor node (only show middle section)
  const isStartNode = nodeDefinition?.name === 'start';
  const isSkillNode = nodeDefinition?.name && SKILL_NODE_TYPES.includes(nodeDefinition.name);
  const isMonitorNode = nodeDefinition?.name === 'teamMonitor';

  if (!selectedNode || !nodeDefinition) {
    return null;
  }



  // Helper to render icon (handles image URLs, Ant Design icons, and emoji/text)
  const renderIcon = (icon: string) => {
    // Handle Ant Design icon names
    if (icon === 'schedule') {
      return <ScheduleOutlined style={{ fontSize: 20, color: theme.colors.actionDeploy }} />;
    }
    if (icon === 'play' || nodeDefinition?.name === 'start') {
      return <PlayCircleFilled style={{ fontSize: 20, color: theme.dracula.cyan }} />;
    }
    // Handle image URLs
    if (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/')) {
      return (
        <img
          src={icon}
          alt="icon"
          style={{ width: 20, height: 20, objectFit: 'contain' }}
        />
      );
    }
    return <span>{icon}</span>;
  };

  // Action button style helper - Dracula theme for visibility
  const actionButtonStyle = (color: string, isDisabled = false): React.CSSProperties => ({
    height: '32px',
    padding: '0 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: isDisabled ? `${theme.colors.primary}15` : `${color}25`,
    color: isDisabled ? theme.colors.primary : color,
    border: `1px solid ${isDisabled ? `${theme.colors.primary}40` : `${color}60`}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: '13px',
    fontWeight: 600,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontFamily: 'system-ui, sans-serif',
  });

  // Header actions with node name and buttons in middle area
  const headerActions = (
    <div style={{
      display: 'flex',
      gap: '16px',
      alignItems: 'center'
    }}>
      {/* Node Name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '15px',
        fontWeight: 600,
        color: theme.colors.text,
        fontFamily: 'system-ui, sans-serif'
      }}>
        {renderIcon(nodeDefinition.icon)}
        <span>{nodeDefinition.displayName}</span>
        {hasUnsavedChanges && <span style={{ color: theme.accent.orange }}>*</span>}
      </div>

      {/* Buttons: Run, Save, Cancel */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Run Button - hide for monitor nodes since they show live data */}
        {canExecute && !isMonitorNode && (
          <button
            style={actionButtonStyle(theme.dracula.green, isExecuting)}
            onClick={handleRun}
            disabled={isExecuting}
            title={isExecuting ? 'Execution in progress...' : 'Execute this node'}
            onMouseEnter={(e) => {
              if (!isExecuting) {
                e.currentTarget.style.backgroundColor = `${theme.dracula.green}40`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isExecuting) {
                e.currentTarget.style.backgroundColor = `${theme.dracula.green}25`;
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        )}

        {/* Save Button */}
        <button
          style={actionButtonStyle(theme.dracula.purple, !hasUnsavedChanges)}
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          onMouseEnter={(e) => {
            if (hasUnsavedChanges) {
              e.currentTarget.style.backgroundColor = `${theme.dracula.purple}40`;
            }
          }}
          onMouseLeave={(e) => {
            if (hasUnsavedChanges) {
              e.currentTarget.style.backgroundColor = `${theme.dracula.purple}25`;
            }
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save
        </button>

        {/* Cancel/Stop Button */}
        <button
          style={actionButtonStyle(theme.dracula.pink, false)}
          onClick={async () => {
            if (isWaiting && selectedNode) {
              // Cancel the event wait for trigger nodes - don't close modal, let execution complete
              console.log('[ParameterPanel] Cancelling event wait:', {
                nodeId: selectedNode.id,
                waiterId: nodeStatus?.data?.waiter_id,
                nodeStatus
              });
              const result = await cancelEventWait(selectedNode.id, nodeStatus?.data?.waiter_id);
              console.log('[ParameterPanel] Cancel result:', result);
              // Don't call handleCancel() - let the execution complete with cancelled state
              return;
            }
            handleCancel();
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.dracula.pink}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.dracula.pink}25`;
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {isWaiting ? 'Stop' : 'Cancel'}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={!!selectedNode}
      onClose={handleModalClose}
      title="Node Configuration"
      maxWidth="95vw"
      maxHeight="95vh"
      headerActions={headerActions}
    >
      {/* Modular Three Panel Layout */}
      <ParameterPanelLayout
        selectedNode={selectedNode}
        nodeDefinition={nodeDefinition}
        parameters={parameters}
        hasUnsavedChanges={hasUnsavedChanges}
        onParameterChange={handleParameterChange}
        executionResults={executionResults}
        onClearResults={handleClearResults}
        showInputSection={!isStartNode && !isSkillNode && !isMonitorNode}
        showOutputSection={!isStartNode && !isSkillNode && !isMonitorNode}
        isLoadingParameters={isLoading}
      />
    </Modal>
  );
};

export default ParameterPanel;