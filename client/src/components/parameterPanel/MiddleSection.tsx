import React, { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Zap, Pencil } from 'lucide-react';
import ParameterRenderer from '../ParameterRenderer';
import ToolSchemaEditor from './ToolSchemaEditor';
import MasterSkillEditor from './MasterSkillEditor';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { useWebSocket, CompactionStats } from '../../contexts/WebSocketContext';
import { useUserSettingsQuery } from '../../hooks/useUserSettingsQuery';
import { nodeDefinitions } from '../../nodeDefinitions';
import { INodeTypeDescription, INodeProperties } from '../../types/INodeProperties';
import { ExecutionResult } from '../../services/executionService';
import { Edge } from 'reactflow';
import { SKILL_NODE_TYPES, skillNodes } from '../../nodeDefinitions/skillNodes';

// Tool node types that support schema editing
const TOOL_NODE_TYPES = ['androidTool', 'calculatorTool', 'currentTimeTool', 'duckduckgoSearch'];

const Stat: React.FC<{ title: React.ReactNode; value: React.ReactNode }> = ({ title, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{title}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
);

// Agent node types that support skills (have input-skill handle)
const AGENT_WITH_SKILLS_TYPES = [
  'aiAgent',
  'chatAgent',
  'android_agent',
  'coding_agent',
  'web_agent',
  'task_agent',
  'social_agent',
  'travel_agent',
  'tool_agent',
  'productivity_agent',
  'payments_agent',
  'consumer_agent',
  'autonomous_agent',
  'orchestrator_agent',
  'ai_employee',
  'rlm_agent',
  'claude_code_agent',
  'deep_agent'
];

interface ConnectedSkill {
  id: string;
  name: string;
  type: string;
  icon: string;
  description: string;
  color: string;
}

interface MiddleSectionProps {
  nodeId: string;
  nodeDefinition: INodeTypeDescription;
  parameters: Record<string, any>;
  onParameterChange: (paramName: string, value: any) => void;
  isLoadingParameters?: boolean;
  executionResults?: ExecutionResult[];
}

const shouldShowParameter = (param: INodeProperties, allParameters: Record<string, any>): boolean => {
  if (!param.displayOptions?.show) {
    return true;
  }

  const showConditions = param.displayOptions.show;

  for (const [paramName, allowedValues] of Object.entries(showConditions)) {
    const currentValue = allParameters[paramName];

    if (Array.isArray(allowedValues)) {
      if (!allowedValues.includes(currentValue)) {
        return false;
      }
    } else {
      if (currentValue !== allowedValues) {
        return false;
      }
    }
  }

  return true;
};

const MiddleSection: React.FC<MiddleSectionProps> = ({
  nodeId,
  nodeDefinition,
  parameters,
  onParameterChange,
  isLoadingParameters = false,
  executionResults = []
}) => {
  const theme = useAppTheme();
  const { currentWorkflow } = useAppStore();
  const { clearMemory, resetSkill, sendRequest, compactionStats: contextCompactionStats, updateCompactionStats } = useWebSocket();
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);
  const [connectedSkills, setConnectedSkills] = useState<ConnectedSkill[]>([]);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(true);

  // Clear/Reset dialog state
  const [showClearMemoryDialog, setShowClearMemoryDialog] = useState(false);
  const [showResetSkillDialog, setShowResetSkillDialog] = useState(false);
  const [clearLongTermMemory, setClearLongTermMemory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Compaction state - reads from WebSocket context (real-time updates via broadcasts)
  const [connectedMemorySessionId, setConnectedMemorySessionId] = useState<string | null>(null);
  const [compactionLoading, setCompactionLoading] = useState(false);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [editThresholdValue, setEditThresholdValue] = useState<number>(0);

  // Threshold edit commit goes through TanStack Query so the WS call,
  // toast feedback, and context-store patch live in one hook instead of
  // a setState + try/finally chain inline on the Save button.
  const configureCompactionMutation = useMutation({
    mutationFn: async (input: { sessionId: string; threshold: number }) => {
      await sendRequest('configure_compaction', {
        session_id: input.sessionId,
        threshold: input.threshold,
      });
      return input;
    },
    onSuccess: ({ sessionId, threshold }) => {
      const existing = contextCompactionStats[sessionId];
      if (existing && currentWorkflow?.id) {
        updateCompactionStats(currentWorkflow.id, sessionId, { ...existing, threshold });
      }
      setIsEditingThreshold(false);
      toast.success('Threshold updated');
    },
    onError: () => {
      toast.error('Failed to update threshold');
    },
  });
  const savingThreshold = configureCompactionMutation.isPending;

  // Derive compaction stats from WebSocket context for the connected memory session
  const compactionStats: CompactionStats | null = connectedMemorySessionId
    ? contextCompactionStats[connectedMemorySessionId] || null
    : null;

  // For Memory nodes: track the connected agent's ID for auto-session display
  const [connectedAgentId, setConnectedAgentId] = useState<string | null>(null);

  // Clear memory handler
  const handleClearMemory = async () => {
    setIsProcessing(true);
    try {
      const sessionId = parameters.sessionId || 'default';
      const result = await clearMemory(sessionId, clearLongTermMemory);
      if (result.success && result.default_content) {
        onParameterChange('memoryContent', result.default_content);
      }
    } finally {
      setIsProcessing(false);
      setShowClearMemoryDialog(false);
      setClearLongTermMemory(false);
    }
  };

  // Reset skill handler
  const handleResetSkill = async () => {
    setIsProcessing(true);
    try {
      const skillName = parameters.skillName;
      if (!skillName) return;
      const result = await resetSkill(skillName);
      if (result.success && result.original_content) {
        onParameterChange('instructions', result.original_content);
      }
    } finally {
      setIsProcessing(false);
      setShowResetSkillDialog(false);
    }
  };

  const visibleParams = (nodeDefinition.properties || [])
    .filter((param: INodeProperties) => shouldShowParameter(param, parameters));

  // Schema-driven layout flags. Read from nodeDefinition.uiHints first;
  // fall back to legacy name checks for nodes not yet annotated. The two
  // legacy arrays (TOOL_NODE_TYPES, AGENT_WITH_SKILLS_TYPES) are also
  // legacy fallbacks until every agent / tool node sets uiHints.hasSkills
  // / uiHints.isToolPanel respectively.
  const hints = nodeDefinition.uiHints ?? {};
  const isMasterSkillNode = hints.isMasterSkillEditor ?? (nodeDefinition.name === 'masterSkill');
  const isMemoryNode = hints.isMemoryPanel ?? (nodeDefinition.name === 'simpleMemory');
  // hasCodeEditor covers code executors, seedable skill nodes, and memory.
  const isLegacyCodeExecutor = nodeDefinition.name === 'pythonExecutor' || nodeDefinition.name === 'javascriptExecutor';
  const isLegacySkillWithEditor = SKILL_NODE_TYPES.includes(nodeDefinition.name)
    && nodeDefinition.name !== 'customSkill'
    && nodeDefinition.name !== 'masterSkill';
  const needsCodeEditorLayout = hints.hasCodeEditor ?? (isLegacyCodeExecutor || isLegacySkillWithEditor || isMemoryNode);
  // Kept as separate flags for downstream JSX that still references them.
  const isCodeExecutorNode = needsCodeEditorLayout && (hints.hasCodeEditor ?? isLegacyCodeExecutor);
  const isSkillNode = needsCodeEditorLayout && isLegacySkillWithEditor;
  const isToolNode = hints.isToolPanel ?? TOOL_NODE_TYPES.includes(nodeDefinition.name);
  const isAgentWithSkills = hints.hasSkills ?? AGENT_WITH_SKILLS_TYPES.includes(nodeDefinition.name);

  // State for Master Skill parameters
  const [masterSkillParams, setMasterSkillParams] = useState<Record<string, any>>({});

  // Global user settings read via TanStack Query (shared cache with
  // Onboarding / SettingsPanel — one WS call across the whole app).
  const { data: userSettings } = useUserSettingsQuery();

  // Apply the global memory_window_size default to new Memory nodes. Only
  // fires when a Memory node is opened AND the node hasn't had windowSize
  // set yet (brand-new instance).
  useEffect(() => {
    if (!isMemoryNode) return;
    const globalWindowSize = userSettings?.memory_window_size;
    if (globalWindowSize !== undefined && parameters.windowSize === undefined) {
      onParameterChange('windowSize', globalWindowSize);
    }
    // Same dep set as the previous imperative effect — only wake up on
    // node change, not on every parameter edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, isMemoryNode, userSettings?.memory_window_size]);

  // Get connected memory session ID and compaction stats for agent nodes
  useEffect(() => {
    if (!isAgentWithSkills || !currentWorkflow) {
      setConnectedMemorySessionId(null);
      return;
    }

    const edges = currentWorkflow.edges || [];

    // Find memory node connected to input-memory handle
    const memoryEdge = edges.find((edge: Edge) =>
      edge.target === nodeId && edge.targetHandle === 'input-memory'
    );

    if (!memoryEdge) {
      setConnectedMemorySessionId(null);
      return;
    }

    // Get memory node's sessionId from its parameters
    // If empty or 'default', the actual session will be the agent's node_id (auto-derived)
    const fetchMemorySessionId = async () => {
      try {
        const response = await sendRequest<{ parameters: Record<string, any> }>('get_node_parameters', {
          node_id: memoryEdge.source
        });
        const configuredSession = response?.parameters?.sessionId || '';
        // Auto-derive: use agent's nodeId if sessionId is empty or 'default'
        const actualSessionId = configuredSession && configuredSession !== 'default'
          ? configuredSession
          : nodeId;  // nodeId is the agent's ID
        setConnectedMemorySessionId(actualSessionId);

        // Get agent's model/provider for model-aware threshold computation
        const agentModel = parameters.model || '';
        const agentProvider = parameters.provider || '';

        // Fetch compaction stats for this session (with model-aware threshold)
        setCompactionLoading(true);
        const statsResponse = await sendRequest<{
          session_id: string;
          total: number;
          threshold: number;
          context_length?: number;
          count: number;
        }>('get_compaction_stats', {
          session_id: actualSessionId,
          model: agentModel,
          provider: agentProvider,
        });

        if (statsResponse && currentWorkflow?.id) {
          updateCompactionStats(currentWorkflow.id, actualSessionId, {
            session_id: statsResponse.session_id || actualSessionId,
            total: statsResponse.total || 0,
            threshold: statsResponse.threshold,
            context_length: statsResponse.context_length || 0,
            count: statsResponse.count || 0
          });
        }
      } catch (err) {
        console.error('[MiddleSection] Failed to fetch memory session/compaction stats:', err);
      } finally {
        setCompactionLoading(false);
      }
    };

    fetchMemorySessionId();
  }, [nodeId, isAgentWithSkills, currentWorkflow, sendRequest, updateCompactionStats, parameters.model, parameters.provider]);

  // For Memory nodes: find which AI Agent this memory is connected TO
  // Used to display the auto-derived session ID
  useEffect(() => {
    if (!isMemoryNode || !currentWorkflow) {
      setConnectedAgentId(null);
      return;
    }

    const edges = currentWorkflow.edges || [];

    // Find edge where this memory node is the SOURCE and target handle is 'input-memory'
    const agentEdge = edges.find((edge: Edge) =>
      edge.source === nodeId && edge.targetHandle === 'input-memory'
    );

    if (agentEdge) {
      setConnectedAgentId(agentEdge.target);
    } else {
      setConnectedAgentId(null);
    }
  }, [nodeId, isMemoryNode, currentWorkflow]);

  // Get connected skills for agent nodes
  useEffect(() => {
    if (!isAgentWithSkills || !currentWorkflow) {
      setConnectedSkills([]);
      return;
    }

    const nodes = currentWorkflow.nodes || [];
    const edges = currentWorkflow.edges || [];

    // Find edges connecting to this node's input-skill handle
    const skillEdges = edges.filter((edge: Edge) =>
      edge.target === nodeId && edge.targetHandle === 'input-skill'
    );

    // Get skill node data - expand Master Skill nodes
    const skills: ConnectedSkill[] = [];

    for (const edge of skillEdges) {
      const sourceNode = nodes.find((n: any) => n.id === edge.source);
      const nodeType = sourceNode?.type || '';
      const nodeDef = nodeDefinitions[nodeType];

      // Check if this is a Master Skill node
      if (nodeType === 'masterSkill') {
        // Load Master Skill parameters to get enabled skills
        const loadMasterSkillParams = async () => {
          try {
            const response = await sendRequest<{ parameters: Record<string, any> }>('get_node_parameters', {
              node_id: edge.source
            });
            if (response?.parameters) {
              setMasterSkillParams(prev => ({ ...prev, [edge.source]: response.parameters }));
            }
          } catch (err) {
            console.error('[MiddleSection] Failed to load Master Skill params:', err);
          }
        };
        loadMasterSkillParams();
      } else {
        // Regular skill node
        skills.push({
          id: edge.source,
          name: sourceNode?.data?.label || nodeDef?.displayName || nodeType,
          type: nodeType,
          icon: nodeDef?.icon || '',
          description: nodeDef?.description || '',
          color: nodeDef?.defaults?.color as string || '#6366F1',
        });
      }
    }

    setConnectedSkills(skills);
  }, [nodeId, isAgentWithSkills, currentWorkflow, sendRequest]);

  // Expand Master Skill enabled skills into connected skills list
  const expandedConnectedSkills = React.useMemo(() => {
    const skills = [...connectedSkills];

    // Get Master Skill node IDs from edges
    const nodes = currentWorkflow?.nodes || [];
    const edges = currentWorkflow?.edges || [];
    const skillEdges = edges.filter((edge: Edge) =>
      edge.target === nodeId && edge.targetHandle === 'input-skill'
    );

    for (const edge of skillEdges) {
      const sourceNode = nodes.find((n: any) => n.id === edge.source);
      if (sourceNode?.type === 'masterSkill') {
        const params = masterSkillParams[edge.source];
        const skillsConfig = params?.skillsConfig || {};

        // Add each enabled skill from Master Skill
        for (const [skillName, config] of Object.entries(skillsConfig as Record<string, any>)) {
          if (!config?.enabled) continue;

          // Find the skill node definition by skillName
          const skillNodeType = SKILL_NODE_TYPES.find(type => {
            const def = skillNodes[type];
            const skillNameProp = def?.properties?.find((p: any) => p.name === 'skillName');
            return skillNameProp?.default === skillName;
          });

          const nodeDef = skillNodeType ? skillNodes[skillNodeType] : null;

          skills.push({
            id: `${edge.source}_${skillName}`,
            name: nodeDef?.displayName || skillName,
            type: skillNodeType || 'masterSkill',
            icon: nodeDef?.icon || '🎯',
            description: nodeDef?.description || `Skill from Master Skill node`,
            color: (nodeDef?.defaults?.color as string) || '#9333EA',
          });
        }
      }
    }

    return skills;
  }, [connectedSkills, masterSkillParams, currentWorkflow, nodeId]);

  // Extract console output from execution results
  const getConsoleOutput = (): string => {
    if (executionResults.length === 0) return '';

    const latestResult = executionResults[0];
    const outputs = latestResult.outputs || latestResult.data || latestResult.nodeData?.[0]?.[0]?.json;

    if (!outputs) return '';

    // Check for console_output or stdout in the result
    if (outputs.console_output) return outputs.console_output;
    if (outputs.stdout) return outputs.stdout;
    if (outputs.result?.console_output) return outputs.result.console_output;
    if (outputs.result?.stdout) return outputs.result.stdout;

    // Check for error output
    if (latestResult.error) return `Error: ${latestResult.error}`;
    if (outputs.error) return `Error: ${outputs.error}`;
    if (outputs.stderr) return `Error: ${outputs.stderr}`;

    return '';
  };

  const consoleOutput = isCodeExecutorNode ? getConsoleOutput() : '';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Description - hide for code editor nodes (Python, Skill) and masterSkill */}
      {!needsCodeEditorLayout && !isMasterSkillNode && (
        <div style={{
          padding: `${theme.spacing.lg} ${theme.spacing.xl} ${theme.spacing.sm}`,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundAlt,
          flexShrink: 0
        }}>
          <p style={{
            margin: 0,
            fontSize: theme.fontSize.base,
            color: theme.colors.textSecondary,
            lineHeight: '1.5',
          }}>
            {nodeDefinition.description}
          </p>
        </div>
      )}

      {/* Main Content Area - Flexible */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Master Skill Editor - Full panel for masterSkill nodes */}
        {isMasterSkillNode ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: theme.spacing.lg, overflow: 'hidden' }}>
            <MasterSkillEditor
              skillsConfig={parameters.skillsConfig || {}}
              onConfigChange={(config) => onParameterChange('skillsConfig', config)}
              skillFolder={parameters.skillFolder || 'assistant'}
              onSkillFolderChange={(folder) => onParameterChange('skillFolder', folder)}
              nodeId={nodeId}
            />
          </div>
        ) : (
        <>
        {/* Parameters */}
        <div style={{
          padding: theme.spacing.xl,
          flex: needsCodeEditorLayout ? '3' : 1,
          overflowY: needsCodeEditorLayout ? 'hidden' : 'auto',
          overflowX: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 0,
          display: needsCodeEditorLayout ? 'flex' : 'block',
          flexDirection: 'column'
        }}>
          {/* Parameters Container */}
          <div style={{
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            padding: theme.spacing.lg,
            boxShadow: `0 1px 3px ${theme.colors.shadowLight}`,
            height: needsCodeEditorLayout ? '100%' : 'auto',
            display: needsCodeEditorLayout ? 'flex' : 'block',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}>
            {/* All Parameters - standard n8n style */}
            {visibleParams.map((param: INodeProperties, index: number) => {
              // Check if this parameter is a code editor - give it more flex space
              const isCodeParam = (param as any).typeOptions?.editor === 'code';
              return (
              <div
                key={param.name}
                style={{
                  paddingBottom: index < visibleParams.length - 1 ? theme.spacing.md : 0,
                  marginBottom: index < visibleParams.length - 1 ? theme.spacing.md : 0,
                  borderBottom: index < visibleParams.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                  flex: needsCodeEditorLayout && isCodeParam ? 1 : 'none',
                  display: needsCodeEditorLayout ? 'flex' : 'block',
                  flexDirection: 'column',
                  minHeight: needsCodeEditorLayout && isCodeParam ? '300px' : 0
                }}
              >
                <ParameterRenderer
                  parameter={param}
                  value={parameters[param.name]}
                  onChange={(value) => onParameterChange(param.name, value)}
                  allParameters={parameters}
                  onParameterChange={onParameterChange}
                  onClosePanel={() => {}}
                  isLoadingParameters={isLoadingParameters}
                  connectedAgentId={isMemoryNode ? connectedAgentId : undefined}
                />
              </div>
              );
            })}

            {/* Tool Schema Editor - Only for tool nodes */}
            {isToolNode && (
              <ToolSchemaEditor
                nodeId={nodeId}
                toolName={parameters.toolName || nodeDefinition.name}
                toolDescription={parameters.toolDescription || nodeDefinition.description || ''}
              />
            )}

            {/* Clear Memory Button - Only for memory nodes */}
            {isMemoryNode && (
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearMemoryDialog(true)}
                  className="border-dracula-red/50 bg-dracula-red/15 text-dracula-red hover:bg-dracula-red/25"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Clear Memory
                </Button>
              </div>
            )}

            {/* Reset Skill Button - Only for built-in skill nodes */}
            {isSkillNode && (
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetSkillDialog(true)}
                  className="border-dracula-orange/50 bg-dracula-orange/15 text-dracula-orange hover:bg-dracula-orange/25"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Reset to Default
                </Button>
              </div>
            )}
          </div>

          {/* Clear Memory Confirmation Dialog (shadcn AlertDialog) */}
          <AlertDialog
            open={showClearMemoryDialog}
            onOpenChange={(open) => {
              if (!open) {
                setShowClearMemoryDialog(false);
                setClearLongTermMemory(false);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Conversation Memory</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset the conversation history to its initial state. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {parameters.longTermEnabled && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={clearLongTermMemory}
                    onCheckedChange={(checked) => setClearLongTermMemory(checked === true)}
                  />
                  Also clear long-term memory (vector store)
                </label>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isProcessing}
                  onClick={handleClearMemory}
                  className="bg-dracula-red text-white hover:bg-dracula-red/90"
                >
                  {isProcessing ? 'Clearing...' : 'Clear Memory'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reset Skill Confirmation Dialog (shadcn AlertDialog) */}
          <AlertDialog
            open={showResetSkillDialog}
            onOpenChange={(open) => !open && setShowResetSkillDialog(false)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Skill to Default</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore the skill instructions to their original content. Any customizations will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isProcessing}
                  onClick={handleResetSkill}
                  className="bg-dracula-orange text-white hover:bg-dracula-orange/90"
                >
                  {isProcessing ? 'Resetting...' : 'Reset to Default'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Token Usage Section - Only for agent nodes with memory connected */}
          {isAgentWithSkills && connectedMemorySessionId && (
            <Accordion type="single" collapsible defaultValue="tokens" style={{ marginTop: 16 }}>
              <AccordionItem value="tokens">
                <AccordionTrigger>
                  {(() => {
                    const ctxLen = compactionStats?.context_length || 0;
                    const displayMax = ctxLen > 0 ? ctxLen : compactionStats?.threshold || 0;
                    return (
                      <span className="flex flex-1 items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Token Usage
                        {compactionStats && displayMax > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {Math.round(compactionStats.total / 1000)}K / {Math.round(displayMax / 1000)}K{ctxLen > 0 ? ' context' : ''}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </AccordionTrigger>
                <AccordionContent>
                  {compactionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : compactionStats ? (() => {
                  const ctxLen = compactionStats.context_length || 0;
                  const hasContext = ctxLen > 0;
                  const progressMax = hasContext ? ctxLen : compactionStats.threshold;
                  const percent = progressMax > 0 ? Math.round((compactionStats.total / progressMax) * 100) : 0;
                  const isWarning = hasContext
                    ? compactionStats.total >= ctxLen * 0.8
                    : compactionStats.total >= compactionStats.threshold * 0.8;
                  return (
                    <>
                      <Progress
                        value={Math.min(percent, 100)}
                        className={cn(isWarning && '[&>div]:bg-destructive')}
                      />
                      {hasContext && compactionStats.threshold > 0 && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Compaction at {Math.round(compactionStats.threshold / 1000)}K ({Math.round(compactionStats.threshold / ctxLen * 100)}% of context)
                        </span>
                      )}
                      <div className="mt-3 grid grid-cols-12 gap-4">
                        <div className="col-span-4">
                          <Stat title="Total" value={compactionStats.total} />
                        </div>
                        <div className="col-span-4">
                          {isEditingThreshold ? (
                            <div>
                              <span className="text-xs text-muted-foreground">Threshold</span>
                              <div className="mt-1 flex gap-1">
                                <Input
                                  type="number"
                                  value={editThresholdValue}
                                  onChange={(e) => setEditThresholdValue(Number(e.target.value) || compactionStats.threshold)}
                                  min={10000}
                                  max={2000000}
                                  step={10000}
                                  className="h-7 w-28 text-xs"
                                />
                                <Button
                                  size="icon-sm"
                                  disabled={savingThreshold || !connectedMemorySessionId}
                                  onClick={() => {
                                    if (!connectedMemorySessionId) return;
                                    configureCompactionMutation.mutate({
                                      sessionId: connectedMemorySessionId,
                                      threshold: editThresholdValue,
                                    });
                                  }}
                                >
                                  {savingThreshold ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div onClick={() => { setEditThresholdValue(compactionStats.threshold); setIsEditingThreshold(true); }} className="cursor-pointer">
                              <Stat
                                title={
                                  <span className="inline-flex items-center gap-1">
                                    Threshold
                                    <Pencil className="h-3 w-3" />
                                  </span>
                                }
                                value={compactionStats.threshold}
                              />
                            </div>
                          )}
                        </div>
                        <div className={hasContext ? 'col-span-2' : 'col-span-4'}>
                          <Stat title="Compactions" value={compactionStats.count} />
                        </div>
                        {hasContext && (
                          <div className="col-span-2">
                            <Stat title="Context" value={`${Math.round(ctxLen / 1000)}K`} />
                          </div>
                        )}
                      </div>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        Session: {compactionStats.session_id}
                      </span>
                    </>
                  );
                })() : (
                  <span className="text-xs text-muted-foreground">No data yet. Run the agent to start tracking.</span>
                )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Connected Skills Section - Only for Zeenie nodes */}
          {isAgentWithSkills && (
            <div style={{
              marginTop: theme.spacing.lg,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              boxShadow: `0 1px 3px ${theme.colors.shadowLight}`,
              overflow: 'hidden'
            }}>
              {/* Skills Header */}
              <div
                onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  backgroundColor: theme.colors.backgroundAlt,
                  borderBottom: isSkillsExpanded ? `1px solid ${theme.colors.border}` : 'none',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isSkillsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.dracula.purple}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span style={{
                    fontSize: theme.fontSize.sm,
                    fontWeight: theme.fontWeight.medium,
                    color: theme.colors.text
                  }}>
                    Connected Skills
                  </span>
                </div>
                <span style={{
                  fontSize: theme.fontSize.xs,
                  color: expandedConnectedSkills.length > 0 ? theme.dracula.purple : theme.colors.textMuted,
                  padding: `2px ${theme.spacing.sm}`,
                  backgroundColor: expandedConnectedSkills.length > 0 ? theme.dracula.purple + '20' : theme.colors.backgroundAlt,
                  borderRadius: theme.borderRadius.sm,
                  fontWeight: theme.fontWeight.medium
                }}>
                  {expandedConnectedSkills.length}
                </span>
              </div>

              {/* Skills Content */}
              {isSkillsExpanded && (
                <div style={{ padding: theme.spacing.md }}>
                  {expandedConnectedSkills.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: theme.spacing.lg,
                      color: theme.colors.textMuted,
                      textAlign: 'center'
                    }}>
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={theme.colors.textMuted}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ marginBottom: theme.spacing.sm, opacity: 0.5 }}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span style={{ fontSize: theme.fontSize.sm, marginBottom: theme.spacing.xs }}>
                        No skills connected
                      </span>
                      <span style={{ fontSize: theme.fontSize.xs }}>
                        Connect skill nodes to the Skill handle to add capabilities
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                      {expandedConnectedSkills.map((skill) => (
                        <div
                          key={skill.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: theme.spacing.md,
                            padding: theme.spacing.md,
                            backgroundColor: theme.colors.backgroundAlt,
                            borderRadius: theme.borderRadius.md,
                            border: `1px solid ${theme.colors.border}`,
                            borderLeft: `3px solid ${skill.color}`
                          }}
                        >
                          {/* Skill Icon */}
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: theme.borderRadius.md,
                            backgroundColor: skill.color + '20',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {skill.icon.startsWith('data:') ? (
                              <img src={skill.icon} alt={skill.name} style={{ width: 20, height: 20 }} />
                            ) : (
                              <span style={{ fontSize: 18 }}>{skill.icon}</span>
                            )}
                          </div>

                          {/* Skill Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: theme.fontSize.sm,
                              fontWeight: theme.fontWeight.semibold,
                              color: theme.colors.text,
                              marginBottom: 2
                            }}>
                              {skill.name}
                            </div>
                            <div style={{
                              fontSize: theme.fontSize.xs,
                              color: theme.colors.textMuted,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {skill.description}
                            </div>
                          </div>

                          {/* Active Badge */}
                          <div style={{
                            fontSize: '10px',
                            fontWeight: theme.fontWeight.medium,
                            color: theme.dracula.green,
                            padding: `2px ${theme.spacing.xs}`,
                            backgroundColor: theme.dracula.green + '20',
                            borderRadius: theme.borderRadius.sm,
                            flexShrink: 0
                          }}>
                            Active
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Console Output Section - Only for Python nodes */}
        {isCodeExecutorNode && (
          <div style={{
            padding: `0 ${theme.spacing.xl} ${theme.spacing.xl}`,
            flex: '1',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              boxShadow: `0 1px 3px ${theme.colors.shadowLight}`,
              overflow: 'hidden',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              {/* Console Header */}
              <div
                onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  backgroundColor: theme.colors.backgroundAlt,
                  borderBottom: isConsoleExpanded ? `1px solid ${theme.colors.border}` : 'none',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isConsoleExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.dracula.cyan}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <span style={{
                    fontSize: theme.fontSize.sm,
                    fontWeight: theme.fontWeight.medium,
                    color: theme.colors.text
                  }}>
                    Console
                  </span>
                </div>
                {consoleOutput && (
                  <span style={{
                    fontSize: theme.fontSize.xs,
                    color: theme.dracula.green,
                    padding: `2px ${theme.spacing.sm}`,
                    backgroundColor: theme.dracula.green + '20',
                    borderRadius: theme.borderRadius.sm
                  }}>
                    Output
                  </span>
                )}
              </div>

              {/* Console Content */}
              {isConsoleExpanded && (
                <div style={{
                  padding: theme.spacing.sm,
                  backgroundColor: '#1a1a2e',
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: theme.fontSize.sm,
                  lineHeight: '1.4'
                }}>
                  {consoleOutput ? (
                    <pre style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: consoleOutput.startsWith('Error') ? theme.dracula.red : theme.dracula.green
                    }}>
                      {consoleOutput}
                    </pre>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      minHeight: '40px',
                      color: theme.colors.textMuted
                    }}>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={theme.colors.textMuted}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ marginBottom: theme.spacing.sm, opacity: 0.5 }}
                      >
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                      </svg>
                      <span style={{ fontSize: theme.fontSize.xs }}>
                        Run the code to see console output
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default MiddleSection;
