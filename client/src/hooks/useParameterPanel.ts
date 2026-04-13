import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { nodeDefinitions } from '../nodeDefinitions';
import { useWebSocket } from '../contexts/WebSocketContext';
import { SKILL_NODE_TYPES } from '../nodeDefinitions/skillNodes';
import {
  useNodeParamsQuery,
  useSaveNodeParamsMutation,
} from './useNodeParamsQuery';

/**
 * Build the default parameter map from a node definition's `properties`.
 * Pure function so a single instance can be reused across renders without
 * re-allocating per node type.
 */
function defaultsForNodeType(nodeType: string): Record<string, any> {
  const def = nodeDefinitions[nodeType];
  if (!def?.properties) return {};
  const defaults: Record<string, any> = {};
  for (const param of def.properties as any[]) {
    defaults[param.name] = param.default !== undefined ? param.default : null;
  }
  return defaults;
}

export const useParameterPanel = () => {
  const { selectedNode, setSelectedNode } = useAppStore();
  const { sendRequest, isConnected } = useWebSocket();

  const nodeId = selectedNode?.id;
  const nodeType = selectedNode?.type;

  // Server-cached read.
  const paramsQuery = useNodeParamsQuery(nodeId);
  const saveMutation = useSaveNodeParamsMutation();

  // Local edit buffer. Initialized from defaults + saved params on the
  // first successful query, then mutated by user edits until save.
  const [editBuffer, setEditBuffer] = useState<Record<string, any>>({});
  const [originalParameters, setOriginalParameters] = useState<Record<string, any>>({});
  const [seedingSkill, setSeedingSkill] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize the edit buffer once per node selection. Identity of
  // sendRequest / saveMutation / paramsQuery.data churns on every render,
  // so we must NOT depend on them — that would trigger an infinite loop
  // because the optimistic setQueryData on save mints a fresh data object.
  // The ref guard keeps initialization bound to nodeId transitions only.
  const initializedFor = useRef<string | null>(null);
  // Stable refs to read-only deps the effect needs without listing them.
  const sendRequestRef = useRef(sendRequest);
  sendRequestRef.current = sendRequest;
  const saveMutationRef = useRef(saveMutation);
  saveMutationRef.current = saveMutation;
  const queryDataRef = useRef(paramsQuery.data);
  queryDataRef.current = paramsQuery.data;

  useEffect(() => {
    if (!nodeType || !nodeId) {
      setEditBuffer({});
      setOriginalParameters({});
      setError(null);
      initializedFor.current = null;
      return;
    }
    if (paramsQuery.isLoading) return;
    if (initializedFor.current === nodeId) return;
    initializedFor.current = nodeId;

    const defaults = defaultsForNodeType(nodeType);
    const saved = queryDataRef.current?.parameters ?? {};
    let initial: Record<string, any> = { ...defaults, ...saved };

    // Seed skill instructions from SKILL.md only the first time a skill
    // node is opened (DB has no instructions yet). Persist the seeded
    // value back so subsequent loads come from the DB directly.
    const isSeedableSkill =
      SKILL_NODE_TYPES.includes(nodeType) &&
      nodeType !== 'customSkill' &&
      nodeType !== 'masterSkill';

    const skillName = initial.skillName as string | undefined;
    if (isSeedableSkill && skillName && !initial.instructions) {
      let cancelled = false;
      setSeedingSkill(true);
      (async () => {
        try {
          const skillResult = await sendRequestRef.current<any>(
            'get_skill_content',
            { skill_name: skillName },
          );
          if (cancelled) return;
          if (skillResult?.success && skillResult?.instructions) {
            initial = { ...initial, instructions: skillResult.instructions };
            await saveMutationRef.current.mutateAsync({
              nodeId,
              parameters: initial,
              version: queryDataRef.current?.version,
            });
          }
        } catch (err) {
          console.error('[useParameterPanel] Failed to seed skill content:', err);
        } finally {
          if (!cancelled) {
            setEditBuffer(initial);
            setOriginalParameters(initial);
            setSeedingSkill(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setEditBuffer(initial);
    setOriginalParameters(initial);
  }, [nodeId, nodeType, paramsQuery.isLoading]);

  // Surface query errors.
  useEffect(() => {
    setError(paramsQuery.isError ? 'Failed to load saved parameters' : null);
  }, [paramsQuery.isError]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(editBuffer) !== JSON.stringify(originalParameters);
  }, [editBuffer, originalParameters]);

  const handleParameterChange = useCallback((paramName: string, value: any) => {
    setEditBuffer((prev) => ({ ...prev, [paramName]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!nodeId) return;
    try {
      await saveMutation.mutateAsync({
        nodeId,
        parameters: editBuffer,
        version: paramsQuery.data?.version,
      });
      setOriginalParameters({ ...editBuffer });
      setError(null);
    } catch (err) {
      console.error('Failed to save parameters via WebSocket:', err);
      setError('Failed to save parameters');
    }
  }, [nodeId, editBuffer, saveMutation, paramsQuery.data?.version]);

  const handleCancel = useCallback(() => {
    setEditBuffer({ ...originalParameters });
    setSelectedNode(null);
  }, [originalParameters, setSelectedNode]);

  const nodeDefinition = nodeType ? nodeDefinitions[nodeType] : null;

  return {
    selectedNode,
    nodeDefinition,
    parameters: editBuffer,
    hasUnsavedChanges,
    handleParameterChange,
    handleSave,
    handleCancel,
    isLoading: paramsQuery.isLoading || seedingSkill,
    isSaving: saveMutation.isPending,
    error,
    isConnected,
  };
};
