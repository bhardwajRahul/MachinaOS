import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useWebSocket } from '../contexts/WebSocketContext';
import { SKILL_NODE_TYPES } from '../nodeDefinitions/skillNodes';

export const useParameterPanel = () => {
  const { selectedNode, setSelectedNode, updateNodeData } = useAppStore();
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

        // For skill nodes, load skill content (instructions) from SKILL.md files
        if (SKILL_NODE_TYPES.includes(nodeType) && nodeType !== 'customSkill') {
          const skillName = initialParams.skillName;
          if (skillName) {
            try {
              console.log('[useParameterPanel] Loading skill content for:', skillName);
              const skillResult = await sendRequest('get_skill_content', { skill_name: skillName });
              if (skillResult?.success && skillResult?.instructions) {
                initialParams = {
                  ...initialParams,
                  instructions: skillResult.instructions
                };
                console.log('[useParameterPanel] Loaded skill instructions:', skillResult.instructions.substring(0, 100) + '...');
              }
            } catch (skillErr) {
              console.error('[useParameterPanel] Failed to load skill content:', skillErr);
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
          // For skill nodes, also save skill content (instructions) to SKILL.md files
          if (selectedNode.type && SKILL_NODE_TYPES.includes(selectedNode.type) && selectedNode.type !== 'customSkill') {
            const skillName = parameters.skillName;
            const instructions = parameters.instructions;
            if (skillName && instructions !== undefined) {
              try {
                console.log('[useParameterPanel] Saving skill content for:', skillName);
                const skillResult = await sendRequest('save_skill_content', {
                  skill_name: skillName,
                  instructions: instructions
                });
                if (!skillResult?.success) {
                  console.error('[useParameterPanel] Failed to save skill content:', skillResult?.error);
                  setError(skillResult?.error || 'Failed to save skill content');
                } else {
                  console.log('[useParameterPanel] Skill content saved successfully');
                }
              } catch (skillErr) {
                console.error('[useParameterPanel] Failed to save skill content:', skillErr);
                setError('Failed to save skill content');
              }
            }
          }

          // Also update the node data in store for faster loading
          updateNodeData(selectedNode.id, parameters);
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
  }, [selectedNode, parameters, updateNodeData, saveNodeParameters, sendRequest]);

  const handleCancel = useCallback(() => {
    setParameters({ ...originalParameters });
    setSelectedNode(null);
  }, [originalParameters, setSelectedNode]);

  const nodeDefinition = selectedNode?.type ? nodeDefinitions[selectedNode.type] : null;

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
