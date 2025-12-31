import React, { useState } from 'react';
import Modal from './ui/Modal';
import LocationPanelLayout from './parameterPanel/LocationPanelLayout';
import { useParameterPanel } from '../hooks/useParameterPanel';
import { ExecutionService } from '../services/executionService';

const LocationParameterPanel: React.FC = () => {
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
      // Location nodes like createMap typically don't need backend execution
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

  // Only show LocationParameterPanel for createMap node
  if (nodeDefinition.name !== 'createMap') {
    return null;
  }

  // Header actions with node name and buttons in middle area
  const headerActions = (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center'
    }}>
      {/* Node Name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#1f2937',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <span>{nodeDefinition.icon}</span>
        <span>{nodeDefinition.displayName}</span>
        {hasUnsavedChanges && <span style={{ color: '#f59e0b' }}>*</span>}
      </div>

      {/* Buttons: Run, Save, Cancel */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Run Button */}
        {canExecute && (
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff6d5a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              opacity: isExecuting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'system-ui, sans-serif'
            }}
            onClick={handleRun}
            disabled={isExecuting}
            title={isExecuting ? 'Execution in progress...' : 'Execute this node'}
          >
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        )}

        {/* Save Button */}
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: hasUnsavedChanges ? '#3b82f6' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
            fontFamily: 'system-ui, sans-serif'
          }}
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
        >
          Save
        </button>

        {/* Cancel Button */}
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif'
          }}
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