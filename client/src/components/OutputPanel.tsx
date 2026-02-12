import React, { useState } from 'react';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { INodeOutputDefinition, NodeConnectionType } from '../types/INodeProperties';
import { useDragVariable } from '../hooks/useDragVariable';

interface OutputPanelProps {
  nodeId: string;
}

interface ConnectedNodeData {
  nodeId: string;
  nodeName: string;
  outputs: INodeOutputDefinition[];
}

// Android node output schemas - matches the flattened output structure from backend
// These are shown as draggable outputs for template variable creation
const ANDROID_OUTPUT_SCHEMAS: Record<string, Record<string, string>> = {
  batteryMonitor: {
    battery_level: 'number',
    is_charging: 'boolean',
    temperature_celsius: 'number',
    health: 'string',
    voltage: 'number'
  },
  systemInfo: {
    device_model: 'string',
    android_version: 'string',
    api_level: 'number',
    manufacturer: 'string',
    total_memory: 'number',
    available_memory: 'number'
  },
  networkMonitor: {
    connected: 'boolean',
    type: 'string',
    ssid: 'string',
    ip_address: 'string',
    signal_strength: 'number'
  },
  wifiAutomation: {
    enabled: 'boolean',
    connected: 'boolean',
    ssid: 'string',
    networks: 'array'
  },
  bluetoothAutomation: {
    enabled: 'boolean',
    connected: 'boolean',
    paired_devices: 'array'
  },
  audioAutomation: {
    media_volume: 'number',
    ring_volume: 'number',
    muted: 'boolean'
  },
  location: {
    latitude: 'number',
    longitude: 'number',
    accuracy: 'number',
    provider: 'string',
    altitude: 'number',
    speed: 'number',
    bearing: 'number'
  },
  appLauncher: {
    package_name: 'string',
    launched: 'boolean',
    app_name: 'string'
  },
  appList: {
    apps: 'array',
    count: 'number'
  },
  deviceStateAutomation: {
    airplane_mode: 'boolean',
    screen_on: 'boolean',
    brightness: 'number'
  },
  screenControlAutomation: {
    brightness: 'number',
    auto_brightness: 'boolean',
    screen_timeout: 'number'
  },
  motionDetection: {
    acceleration_x: 'number',
    acceleration_y: 'number',
    acceleration_z: 'number',
    is_moving: 'boolean'
  },
  environmentalSensors: {
    temperature: 'number',
    humidity: 'number',
    pressure: 'number',
    light: 'number'
  },
  cameraControl: {
    cameras: 'array',
    photo_path: 'string'
  },
  mediaControl: {
    playing: 'boolean',
    volume: 'number',
    track: 'string'
  },
  airplaneModeControl: {
    enabled: 'boolean'
  }
};

// List of Android service node types
const ANDROID_NODE_TYPES = [
  'batteryMonitor', 'systemInfo', 'networkMonitor', 'location',
  'wifiAutomation', 'bluetoothAutomation', 'audioAutomation',
  'deviceStateAutomation', 'screenControlAutomation', 'airplaneModeControl',
  'motionDetection', 'environmentalSensors', 'cameraControl', 'mediaControl',
  'appLauncher', 'appList'
];

const OutputPanel: React.FC<OutputPanelProps> = ({ nodeId }) => {
  const theme = useAppTheme();
  const { currentWorkflow } = useAppStore();
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedParam, setDraggedParam] = useState<{ nodeId: string; output: string } | null>(null);

  // Use the same template variable naming as InputSection for consistency
  const { getTemplateVariableName } = useDragVariable(nodeId);

  // Helper to get outputs from a node definition
  const getNodeOutputs = (nodeType: string): INodeOutputDefinition[] => {
    // For Android nodes, use the detailed schema to show individual draggable properties
    if (ANDROID_NODE_TYPES.includes(nodeType)) {
      const schema = ANDROID_OUTPUT_SCHEMAS[nodeType];
      if (schema) {
        return Object.entries(schema).map(([name, type]) => ({
          name,
          displayName: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          type: type as NodeConnectionType,
          description: `${type} value`
        }));
      }
    }

    const definition = nodeDefinitions[nodeType];
    if (!definition) return [];

    if (!definition.outputs) {
      return [{
        name: 'output',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Node output'
      }];
    } else if (Array.isArray(definition.outputs)) {
      if (typeof definition.outputs[0] === 'string') {
        return (definition.outputs as string[]).map(outputName => ({
          name: outputName,
          displayName: outputName.charAt(0).toUpperCase() + outputName.slice(1),
          type: 'main' as NodeConnectionType,
          description: `${outputName} output`
        }));
      } else {
        return definition.outputs as INodeOutputDefinition[];
      }
    }
    return [{
      name: 'output',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Node output'
    }];
  };

  // Helper to check if a handle is a config/auxiliary handle (not main data flow)
  const isConfigHandle = (handle: string | null | undefined): boolean => {
    if (!handle) return false;
    // Config handles follow pattern: input-<type> where type is not 'main', 'chat', or 'task'
    // Examples: input-memory, input-tools, input-model
    // Non-config (data flow) handles: input-main, input-chat, input-task
    if (handle.startsWith('input-') && handle !== 'input-main' && handle !== 'input-chat' && handle !== 'input-task') {
      return true;
    }
    return false;
  };

  // Helper to check if a node is a config/auxiliary node (connects to config handles)
  const isConfigNode = (nodeType: string | undefined): boolean => {
    if (!nodeType) return false;
    const definition = nodeDefinitions[nodeType];
    if (!definition) return false;
    // Config nodes typically have 'memory' or 'tool' in their group, or have no main input
    const groups = definition.group || [];
    return groups.includes('memory') || groups.includes('tool');
  };

  // Get connected nodes with their outputs
  const getConnectedNodes = (): ConnectedNodeData[] => {
    if (!currentWorkflow || !nodeId) return [];

    const connectedNodes: ConnectedNodeData[] = [];
    const addedNodeIds = new Set<string>();

    // Helper to add a node to connected list
    const addConnectedNode = (sourceNodeId: string, label?: string) => {
      if (addedNodeIds.has(sourceNodeId)) return;

      const sourceNode = currentWorkflow.nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode?.type) return;

      const sourceDefinition = nodeDefinitions[sourceNode.type];
      if (!sourceDefinition) return;

      addedNodeIds.add(sourceNodeId);
      connectedNodes.push({
        nodeId: sourceNode.id,
        nodeName: label ? `${sourceDefinition.displayName} (${label})` : sourceDefinition.displayName,
        outputs: getNodeOutputs(sourceNode.type)
      });
    };

    // Find all edges that connect TO the current node
    const incomingEdges = currentWorkflow.edges.filter(edge => edge.target === nodeId);

    // Get current node info
    const currentNode = currentWorkflow.nodes.find(n => n.id === nodeId);
    const currentNodeType = currentNode?.type;

    for (const edge of incomingEdges) {
      // Skip config handle connections - they're for auxiliary nodes, not main data flow
      if (isConfigHandle(edge.targetHandle)) {
        continue;
      }
      addConnectedNode(edge.source);
    }

    // If current node is a config node (memory, tool), inherit parent node's main inputs
    if (isConfigNode(currentNodeType)) {
      // Find which parent node this config node is connected to
      const outgoingEdges = currentWorkflow.edges.filter(edge => edge.source === nodeId);

      for (const edge of outgoingEdges) {
        // Check if connected to a config handle on the target
        if (isConfigHandle(edge.targetHandle)) {
          const targetNode = currentWorkflow.nodes.find(n => n.id === edge.target);
          if (!targetNode) continue;

          const targetDef = nodeDefinitions[targetNode.type || ''];
          const targetName = targetDef?.displayName || targetNode.type;

          // Find nodes connected to the parent's main input (non-config handles)
          const parentInputEdges = currentWorkflow.edges.filter(
            e => e.target === targetNode.id && !isConfigHandle(e.targetHandle)
          );

          for (const parentEdge of parentInputEdges) {
            addConnectedNode(parentEdge.source, `via ${targetName}`);
          }
        }
      }
    }

    return connectedNodes;
  };

  const connectedNodes = getConnectedNodes();

  const handleDragStart = (e: React.DragEvent, sourceNodeId: string, outputName: string) => {
    setIsDragging(true);
    setDraggedParam({ nodeId: sourceNodeId, output: outputName });
    e.dataTransfer.effectAllowed = 'copy';

    // Use the same template naming as InputSection for consistency
    // This ensures Android nodes and all other nodes work properly with template variables
    const templateName = getTemplateVariableName(sourceNodeId);

    e.dataTransfer.setData('text/plain', `{{${templateName}.${outputName}}}`);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedParam(null);
  };

  if (connectedNodes.length === 0) {
    return (
      <div style={{
        width: '300px',
        height: '100%',
        padding: theme.spacing.md,
        backgroundColor: theme.colors.backgroundAlt,
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{
          margin: 0,
          fontSize: theme.fontSize.sm,
          color: theme.colors.textSecondary,
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          No connected nodes.
          <br />
          Connect nodes to see their outputs here.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      width: '300px',
      height: '100%',
      backgroundColor: theme.colors.backgroundAlt,
      borderRight: `1px solid ${theme.colors.border}`,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: theme.spacing.md,
        backgroundColor: theme.colors.backgroundPanel,
        borderBottom: `1px solid ${theme.colors.border}`,
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }}>
        🔗 Connected Outputs
      </div>

      {/* Scrollable content */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: theme.spacing.sm 
      }}>
        {connectedNodes.map((node) => (
          <div key={node.nodeId} style={{
            marginBottom: theme.spacing.xs,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.background,
            overflow: 'hidden'
          }}>
            <div
              onClick={() => setExpandedNode(expandedNode === node.nodeId ? null : node.nodeId)}
              style={{
                padding: theme.spacing.sm,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.colors.backgroundAlt,
                transition: theme.transitions.fast
              }}
            >
              <span style={{
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.medium,
                color: theme.colors.text
              }}>
                📦 {node.nodeName}
              </span>
              <span style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.textSecondary,
                transform: expandedNode === node.nodeId ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}>
                ▼
              </span>
            </div>

            {expandedNode === node.nodeId && (
              <div style={{
                padding: theme.spacing.sm,
                borderTop: `1px solid ${theme.colors.border}`
              }}>
                {node.outputs.length === 0 ? (
                  <p style={{
                    margin: 0,
                    fontSize: theme.fontSize.xs,
                    color: theme.colors.textSecondary,
                    fontStyle: 'italic',
                    padding: theme.spacing.xs
                  }}>
                    No output parameters available
                  </p>
                ) : (
                  node.outputs.map((output) => (
                    <div
                      key={output.name}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node.nodeId, output.name)}
                      onDragEnd={handleDragEnd}
                      style={{
                        padding: theme.spacing.xs,
                        marginBottom: theme.spacing.xs,
                        backgroundColor: isDragging && draggedParam?.nodeId === node.nodeId && draggedParam?.output === output.name
                          ? theme.colors.focusRing
                          : theme.colors.backgroundAlt,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                        cursor: 'grab',
                        transition: theme.transitions.fast
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{
                            fontSize: theme.fontSize.sm,
                            fontWeight: theme.fontWeight.medium,
                            color: theme.colors.text,
                            marginBottom: '2px'
                          }}>
                            {output.displayName}
                          </div>
                          <div style={{
                            fontSize: theme.fontSize.xs,
                            color: theme.colors.textSecondary
                          }}>
                            {output.type} • {output.description}
                          </div>
                        </div>
                        <div style={{
                          fontSize: theme.fontSize.xs,
                          color: theme.colors.textSecondary,
                          fontFamily: 'monospace',
                          padding: `2px ${theme.spacing.xs}`,
                          backgroundColor: theme.colors.background,
                          borderRadius: theme.borderRadius.sm,
                          border: `1px solid ${theme.colors.border}`
                        }}>
                          {output.name}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: theme.spacing.sm,
        backgroundColor: theme.colors.backgroundPanel,
        borderTop: `1px solid ${theme.colors.border}`,
        fontSize: theme.fontSize.xs,
        color: theme.colors.textSecondary,
        textAlign: 'center'
      }}>
        💡 Drag outputs to parameter fields
      </div>
    </div>
  );
};

export default OutputPanel;