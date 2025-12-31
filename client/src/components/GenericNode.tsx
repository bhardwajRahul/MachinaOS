import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeDefinitions } from '../nodeDefinitions';
import { NodeData } from '../types/NodeTypes';
import { INodeInputDefinition, INodeOutputDefinition, NodeConnectionType } from '../types/INodeProperties';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWebSocket } from '../contexts/WebSocketContext';

const GenericNode: React.FC<NodeProps<NodeData>> = ({ id, type, data, isConnectable, selected }) => {
  const theme = useAppTheme();
  const { setSelectedNode, renamingNodeId, setRenamingNodeId, updateNodeData } = useAppStore();
  const { getNodeStatus } = useWebSocket();
  const isDisabled = data?.disabled === true;

  // Get execution status from WebSocket
  const nodeStatus = getNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';
  const isExecuting = executionStatus === 'executing' || executionStatus === 'waiting';

  // Get definition early for use in hooks
  const definition = type && nodeDefinitions[type] ? nodeDefinitions[type] : null;

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with global renaming state
  useEffect(() => {
    if (renamingNodeId === id) {
      setIsRenaming(true);
      setEditLabel(data?.label || definition?.displayName || type || '');
    } else {
      setIsRenaming(false);
    }
  }, [renamingNodeId, id, data?.label, definition?.displayName, type]);

  // Focus and select input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Handle save rename
  const handleSaveRename = useCallback(() => {
    const newLabel = editLabel.trim();
    const originalLabel = data?.label || definition?.displayName || type || '';

    // Only save if label changed and is not empty
    if (newLabel && newLabel !== originalLabel) {
      updateNodeData(id, { ...data, label: newLabel });
    }

    setIsRenaming(false);
    setRenamingNodeId(null);
  }, [editLabel, data, definition?.displayName, type, id, updateNodeData, setRenamingNodeId]);

  // Handle cancel rename
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenamingNodeId(null);
  }, [setRenamingNodeId]);

  // Handle double-click to rename
  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingNodeId(id);
  }, [id, setRenamingNodeId]);

  const handleParametersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ id, type, data, position: { x: 0, y: 0 } });
  };

  if (!type || !definition) {
    return (
      <div style={{
        padding: '8px 12px',
        backgroundColor: '#ef4444',
        color: 'white',
        borderRadius: '8px',
        fontSize: '12px',
        minWidth: '120px',
        textAlign: 'center'
      }}>
        Unknown node type
      </div>
    );
  }
  
  // Helper functions to get inputs/outputs for both enhanced and legacy nodes
  const getNodeInputs = (): INodeInputDefinition[] => {
    if (!definition.inputs) return [];
    
    // Enhanced nodes: array of input objects
    if (definition.inputs.length > 0 && typeof definition.inputs[0] === 'object') {
      return definition.inputs as INodeInputDefinition[];
    }
    
    // Legacy nodes: array of strings - convert to input objects
    return (definition.inputs as string[]).map((input, index) => ({
      name: `input_${index}`,
      displayName: 'Input',
      type: (input as NodeConnectionType) || 'main',
      description: 'Node input connection'
    }));
  };
  
  const getNodeOutputs = (): INodeOutputDefinition[] => {
    if (!definition.outputs) return [];
    
    // Enhanced nodes: array of output objects
    if (definition.outputs.length > 0 && typeof definition.outputs[0] === 'object') {
      return definition.outputs as INodeOutputDefinition[];
    }
    
    // Legacy nodes: array of strings - convert to output objects
    return (definition.outputs as string[]).map((output, index) => ({
      name: `output_${index}`,
      displayName: 'Output',
      type: (output as NodeConnectionType) || 'main',
      description: 'Node output connection'
    }));
  };

  const nodeInputs = getNodeInputs();
  const nodeOutputs = getNodeOutputs();
  
  // Helper functions for color management
  const getNodeColor = () => definition.defaults.color || '#9E9E9E';
  const getBorderColor = () => {
    const color = getNodeColor();
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 40);
      const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 40);
      const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 40);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return color;
  };

  return (
    <div
      style={{
        position: 'relative',
        padding: '12px 32px 12px 16px',
        minWidth: '160px',
        minHeight: '60px',
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${getNodeColor()} 0%, ${getBorderColor()} 100%)`,
        border: `2px solid ${isExecuting
          ? (theme.isDarkMode ? theme.dracula.cyan : '#2563eb')
          : selected
            ? '#3b82f6'
            : getBorderColor()}`,
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isExecuting
          ? theme.isDarkMode
            ? `0 4px 12px ${theme.dracula.cyan}66, 0 0 0 3px ${theme.dracula.cyan}4D`
            : `0 0 0 3px rgba(37, 99, 235, 0.5), 0 4px 16px rgba(37, 99, 235, 0.35)`
          : selected
            ? `0 8px 25px ${getNodeColor()}40, 0 0 0 2px ${theme.colors.focus}`
            : theme.isDarkMode
              ? `0 4px 12px ${getNodeColor()}40`
              : `0 2px 8px ${getNodeColor()}25, 0 4px 16px rgba(0, 0, 0, 0.08)`,
        overflow: 'visible',
        opacity: isDisabled ? 0.5 : 1,
        animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {/* Disabled Overlay */}
      {isDisabled && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(128, 128, 128, 0.4)',
          borderRadius: 'inherit',
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '24px', opacity: 0.8 }}>||</span>
        </div>
      )}
      {/* Input Handles - Multiple handles based on node definition */}
      {nodeInputs.map((input, index) => {
        const totalInputs = nodeInputs.length;
        const topPosition = totalInputs === 1 ? '50%' : 
          `${20 + (60 * index) / Math.max(totalInputs - 1, 1)}%`;
        
        return (
          <Handle
            key={`input-${input.name}-${index}`}
            id={`input-${input.name}`}
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            style={{
              position: 'absolute',
              left: '-6px',
              top: topPosition,
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: `2px solid ${getBorderColor()}`,
              borderRadius: '50%'
            }}
            title={`${input.displayName}: ${input.description}`}
          />
        );
      })}
      

      {/* Parameters Button */}
      <button
        onClick={handleParametersClick}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: getNodeColor(),
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          zIndex: 20
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.transform = 'scale(1.15)';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
        }}
        title="Edit Parameters"
      >
        ⚙️
      </button>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        position: 'relative',
        zIndex: 10,
        paddingRight: '4px'
      }}>
        <span style={{ fontSize: type === 'aiAgent' ? '18px' : '24px' }}>{definition.icon}</span>
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveRename();
              } else if (e.key === 'Escape') {
                handleCancelRename();
              }
              e.stopPropagation();
            }}
            onBlur={handleSaveRename}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '2px 4px',
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.medium,
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid ${theme.dracula.purple}`,
              borderRadius: theme.borderRadius.sm,
              outline: 'none',
              minWidth: '60px',
              maxWidth: '120px',
            }}
          />
        ) : (
          <span
            onDoubleClick={handleLabelDoubleClick}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              cursor: 'text',
            }}
            title="Double-click to rename"
          >
            {data?.label || definition.displayName}
          </span>
        )}
      </div>

      
      {/* Output Handles - Multiple handles based on node definition */}
      {nodeOutputs.map((output, index) => {
        const totalOutputs = nodeOutputs.length;
        const topPosition = totalOutputs === 1 ? '50%' : 
          `${20 + (60 * index) / Math.max(totalOutputs - 1, 1)}%`;
        
        return (
          <Handle
            key={`output-${output.name}-${index}`}
            id={`output-${output.name}`}
            type="source"
            position={Position.Right}
            isConnectable={isConnectable}
            style={{
              position: 'absolute',
              right: '-6px',
              top: topPosition,
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: `2px solid ${getBorderColor()}`,
              borderRadius: '50%'
            }}
            title={`${output.displayName}: ${output.description}`}
          />
        );
      })}
    </div>
  );
};

export default GenericNode;