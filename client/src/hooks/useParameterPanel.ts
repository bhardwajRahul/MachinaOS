import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useWebSocket } from '../contexts/WebSocketContext';
import { SKILL_NODE_TYPES } from '../nodeDefinitions/skillNodes';

export const useParameterPanel = () => {
  const { selectedNode, setSelectedNode } = useAppStore();
  const [parameters, setParameters] = useState<any>({});
  const [originalParameters, setOriginalParameters] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use WebSocket for parameter operations
  const { getNodeParameters, saveNodeParameters, sendRequest, isConnected } = useWebSocket();

  // Use stable references to prevent multiple effect runs
  const nodeId = selectedNode?.id;
  const nodeType = selectedNode?.type;

  useEffect(() => {
    if (!nodeType || !nodeId) {
      setParameters({});
      setOriginalParameters({});
      setError(null);
      return;
    }

    const loadParameters = async () => {
      const nodeDefinition = nodeDefinitions[nodeType];
      if (!nodeDefinition) return;

      const defaults: any = {};

      // Set parameter defaults
      if (nodeDefinition.properties) {
        nodeDefinition.properties.forEach((param: any) => {
          defaults[param.name] = param.default !== undefined ? param.default : null;
        });
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load saved parameters via WebSocket
        const result = await getNodeParameters(nodeId);
        // Extract parameters from NodeParameters response
        const savedParams = result?.parameters || {};
        let initialParams = { ...defaults, ...savedParams };

        console.log('[useParameterPanel] Loading params for node:', nodeId, nodeType);
        console.log('[useParameterPanel] Defaults:', defaults);
        console.log('[useParameterPanel] Saved from backend:', savedParams);

        // For skill nodes, seed instructions from SKILL.md only if DB has none yet
        if (SKILL_NODE_TYPES.includes(nodeType) && nodeType !== 'customSkill' && nodeType !== 'masterSkill') {
          const skillName = initialParams.skillName;
          if (skillName && !initialParams.instructions) {
            try {
              console.log('[useParameterPanel] Seeding skill content from SKILL.md for:', skillName);
              const skillResult = await sendRequest('get_skill_content', { skill_name: skillName });
              if (skillResult?.success && skillResult?.instructions) {
                initialParams = {
                  ...initialParams,
                  instructions: skillResult.instructions
                };
                // Auto-save seeded instructions to DB so next load uses DB directly
                await saveNodeParameters(nodeId, initialParams);
                console.log('[useParameterPanel] Seeded and saved skill instructions for:', skillName);
              }
            } catch (skillErr) {
              console.error('[useParameterPanel] Failed to seed skill content:', skillErr);
            }
          }
        }

        console.log('[useParameterPanel] Merged initial:', initialParams);

        setParameters(initialParams);
        setOriginalParameters(initialParams);
      } catch (err) {
        console.error('Failed to load parameters via WebSocket:', err);
        // Use defaults if WebSocket fails
        setParameters(defaults);
        setOriginalParameters(defaults);
        setError('Failed to load saved parameters');
      } finally {
        setIsLoading(false);
      }
    };

    loadParameters();
  }, [nodeId, nodeType, getNodeParameters, sendRequest]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(parameters) !== JSON.stringify(originalParameters);
  }, [parameters, originalParameters]);

  const handleParameterChange = useCallback((paramName: string, value: any) => {
    setParameters((prevParams: any) => ({
      ...prevParams,
      [paramName]: value
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedNode) {
      setIsSaving(true);
      setError(null);

      try {
        // Save parameters to database via WebSocket
        const success = await saveNodeParameters(selectedNode.id, parameters);

        if (success) {
          // DB is the source of truth for parameters.
          // node.data only stores UI-display fields (label, disabled).
          // Do NOT copy parameters to node.data to prevent data leaking into exports.
          setOriginalParameters({ ...parameters });
        } else {
          setError('Failed to save parameters');
        }
      } catch (err) {
        console.error('Failed to save parameters via WebSocket:', err);
        setError('Failed to save parameters');
      } finally {
        setIsSaving(false);
      }
    }
  }, [selectedNode, parameters, saveNodeParameters]);

  const handleCancel = useCallback(() => {
    setParameters({ ...originalParameters });
    setSelectedNode(null);
  }, [originalParameters, setSelectedNode]);

  const nodeDefinition = selectedNode?.type ? nodeDefinitions[selectedNode.type] : null;
  console.log('[useParameterPanel] selectedNode.type:', selectedNode?.type, 'nodeDefinition.name:', nodeDefinition?.name);

  return {
    selectedNode,
    nodeDefinition,
    parameters,
    hasUnsavedChanges,
    handleParameterChange,
    handleSave,
    handleCancel,
    // New state for loading/saving status
    isLoading,
    isSaving,
    error,
    isConnected,
  };
};
