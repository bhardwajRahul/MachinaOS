import React, { useState } from 'react';
import Modal from './ui/Modal';
import LocationPanelLayout from './parameterPanel/LocationPanelLayout';
import { useParameterPanel } from '../hooks/useParameterPanel';
import { ExecutionService } from '../services/executionService';
import { useAppTheme } from '../hooks/useAppTheme';

const LocationParameterPanel: React.FC = () => {
  const theme = useAppTheme();
  const {
    selectedNode,
    nodeDefinition,
    parameters,
    hasUnsavedChanges,
    handleParameterChange,
    handleSave,
    handleCancel,
  } = useParameterPanel();


  // Execution state (kept for potential future location node execution)
  const [isExecuting, setIsExecuting] = useState(false);

  const handleModalClose = () => {
    handleCancel();
  };

  // Execute the current node (simplified - location nodes typically don't execute)
  const handleRun = async () => {
    if (!selectedNode || !nodeDefinition) return;

    if (hasUnsavedChanges) {
      await handleSave();
    }

    setIsExecuting(true);
    try {
      // Location nodes like gmaps_create typically don't need backend execution
      // They're configuration nodes that output map instances
    } catch (error: any) {
      console.error('Location node execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  // Check if node can be executed
  const canExecute = selectedNode && nodeDefinition &&
    ExecutionService.isNodeTypeSupported(nodeDefinition.name);

  if (!selectedNode || !nodeDefinition) {
    return null;
  }

  // Only show LocationParameterPanel for gmaps_create node
  if (nodeDefinition.name !== 'gmaps_create') {
    return null;
  }

  // Action button style helper - matches main ParameterPanel
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
        color: theme.colors.text
      }}>
        <span>{nodeDefinition.icon}</span>
        <span>{nodeDefinition.displayName}</span>
        {hasUnsavedChanges && <span style={{ color: theme.accent.orange }}>*</span>}
      </div>

      {/* Buttons: Run, Save, Cancel */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Run Button */}
        {canExecute && (
          <button
            style={actionButtonStyle(theme.dracula.green, isExecuting)}
            onClick={handleRun}
            disabled={isExecuting}
            title={isExecuting ? 'Execution in progress...' : 'Execute this node'}
          >
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        )}

        {/* Save Button */}
        <button
          style={actionButtonStyle(theme.dracula.purple, !hasUnsavedChanges)}
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
        >
          Save
        </button>

        {/* Cancel Button */}
        <button
          style={actionButtonStyle(theme.dracula.pink, false)}
          onClick={handleCancel}
        >
          Cancel
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
      {/* Modular Location Panel Layout */}
      <LocationPanelLayout
        selectedNode={selectedNode}
        nodeDefinition={nodeDefinition}
        parameters={parameters}
        hasUnsavedChanges={hasUnsavedChanges}
        onParameterChange={handleParameterChange}
        showInputSection={true}
      />
    </Modal>
  );
};

export default LocationParameterPanel;