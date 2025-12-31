import React from 'react';
import { Node } from 'reactflow';
import InputSection from './InputSection';
import MiddleSection from './MiddleSection';
import MapsSection from './MapsSection';
import { INodeTypeDescription } from '../../types/INodeProperties';

interface LocationPanelLayoutProps {
  // Node data
  selectedNode: Node;
  nodeDefinition: INodeTypeDescription;
  parameters: Record<string, any>;
  hasUnsavedChanges: boolean;

  // Parameter handling
  onParameterChange: (paramName: string, value: any) => void;

  // Layout configuration
  showInputSection?: boolean;
}

const LocationPanelLayout: React.FC<LocationPanelLayoutProps> = ({
  selectedNode,
  nodeDefinition,
  parameters,
  hasUnsavedChanges: _hasUnsavedChanges,
  onParameterChange,
  showInputSection = true
}) => {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left: Input Nodes JSON Data */}
      {showInputSection && (
        <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          <InputSection
            nodeId={selectedNode.id}
            visible={showInputSection}
          />
        </div>
      )}

      {/* Middle: Parameter Content */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <MiddleSection
          nodeDefinition={nodeDefinition}
          parameters={parameters}
          onParameterChange={onParameterChange}
        />
      </div>

      {/* Right: Maps Section */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <MapsSection
          selectedNode={selectedNode}
          nodeDefinition={nodeDefinition}
          parameters={parameters}
          onParameterChange={onParameterChange}
        />
      </div>
    </div>
  );
};

export default LocationPanelLayout;