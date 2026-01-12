import React from 'react';
import { Node } from 'reactflow';
import InputSection from './InputSection';
import MiddleSection from './MiddleSection';
import OutputSection from './OutputSection';
import { INodeTypeDescription } from '../../types/INodeProperties';
import { ExecutionResult } from '../../services/executionService';

interface ParameterPanelLayoutProps {
  // Node data
  selectedNode: Node;
  nodeDefinition: INodeTypeDescription;
  parameters: Record<string, any>;
  hasUnsavedChanges: boolean;

  // Parameter handling
  onParameterChange: (paramName: string, value: any) => void;

  // Execution data
  executionResults: ExecutionResult[];
  onClearResults: () => void;

  // Layout configuration
  showInputSection?: boolean;
  showOutputSection?: boolean;

  // Loading state
  isLoadingParameters?: boolean;
}

const ParameterPanelLayout: React.FC<ParameterPanelLayoutProps> = ({
  selectedNode,
  nodeDefinition,
  parameters,
  hasUnsavedChanges: _hasUnsavedChanges,
  onParameterChange,
  executionResults,
  onClearResults,
  showInputSection = true,
  showOutputSection = true,
  isLoadingParameters = false
}) => {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left: Input Nodes JSON Data */}
      {showInputSection && (
        <div style={{ flex: 0.7, height: '100%', overflow: 'hidden' }}>
          <InputSection
            nodeId={selectedNode.id}
            visible={showInputSection}
          />
        </div>
      )}

      {/* Middle: Parameter Content */}
      <div style={{ flex: 1.6, height: '100%', overflow: 'hidden', minWidth: 0 }}>
        <MiddleSection
          nodeId={selectedNode.id}
          nodeDefinition={nodeDefinition}
          parameters={parameters}
          onParameterChange={onParameterChange}
          isLoadingParameters={isLoadingParameters}
          executionResults={executionResults}
        />
      </div>

      {/* Right: Current Node Output */}
      {showOutputSection && (
        <div style={{ flex: 0.7, height: '100%', overflow: 'hidden' }}>
          <OutputSection
            selectedNode={selectedNode}
            executionResults={executionResults}
            onClearResults={onClearResults}
            visible={showOutputSection}
          />
        </div>
      )}
    </div>
  );
};

export default ParameterPanelLayout;