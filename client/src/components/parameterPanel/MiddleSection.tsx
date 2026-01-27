import React, { useState, useEffect } from 'react';
import ParameterRenderer from '../ParameterRenderer';
import ToolSchemaEditor from './ToolSchemaEditor';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { nodeDefinitions } from '../../nodeDefinitions';
import { INodeTypeDescription, INodeProperties } from '../../types/INodeProperties';
import { ExecutionResult } from '../../services/executionService';
import { Edge } from 'reactflow';
import { SKILL_NODE_TYPES } from '../../nodeDefinitions/skillNodes';

// Tool node types that support schema editing
const TOOL_NODE_TYPES = ['androidTool', 'calculatorTool', 'currentTimeTool', 'webSearchTool'];

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
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);
  const [connectedSkills, setConnectedSkills] = useState<ConnectedSkill[]>([]);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(true);

  const visibleParams = (nodeDefinition.properties || [])
    .filter((param: INodeProperties) => shouldShowParameter(param, parameters));

  // Check if this is a code executor node (Python or JavaScript)
  const isCodeExecutorNode = nodeDefinition.name === 'pythonExecutor' || nodeDefinition.name === 'javascriptExecutor';

  // Check if this is a skill node with code editor (needs similar flex layout)
  const isSkillNode = SKILL_NODE_TYPES.includes(nodeDefinition.name) && nodeDefinition.name !== 'customSkill';

  // Nodes that need flexible code editor layout
  const needsCodeEditorLayout = isCodeExecutorNode || isSkillNode;

  // Check if this is a tool node that supports schema editing
  const isToolNode = TOOL_NODE_TYPES.includes(nodeDefinition.name);

  // Check if this is a Chat Agent node
  const isChatAgentNode = nodeDefinition.name === 'chatAgent';

  // Get connected skills for Chat Agent nodes
  useEffect(() => {
    if (!isChatAgentNode || !currentWorkflow) {
      setConnectedSkills([]);
      return;
    }

    const nodes = currentWorkflow.nodes || [];
    const edges = currentWorkflow.edges || [];

    // Find edges connecting to this node's input-skill handle
    const skillEdges = edges.filter((edge: Edge) =>
      edge.target === nodeId && edge.targetHandle === 'input-skill'
    );

    // Get skill node data
    const skills: ConnectedSkill[] = skillEdges.map((edge: Edge) => {
      const sourceNode = nodes.find((n: any) => n.id === edge.source);
      const nodeType = sourceNode?.type || '';
      const nodeDef = nodeDefinitions[nodeType];

      return {
        id: edge.source,
        name: sourceNode?.data?.label || nodeDef?.displayName || nodeType,
        type: nodeType,
        icon: nodeDef?.icon || '',
        description: nodeDef?.description || '',
        color: nodeDef?.defaults?.color as string || '#6366F1',
      };
    });

    setConnectedSkills(skills);
  }, [nodeId, isChatAgentNode, currentWorkflow]);

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
      {/* Description - hide for code editor nodes (Python, Skill) */}
      {!needsCodeEditorLayout && (
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
          </div>

          {/* Connected Skills Section - Only for Chat Agent nodes */}
          {isChatAgentNode && (
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
                  color: connectedSkills.length > 0 ? theme.dracula.purple : theme.colors.textMuted,
                  padding: `2px ${theme.spacing.sm}`,
                  backgroundColor: connectedSkills.length > 0 ? theme.dracula.purple + '20' : theme.colors.backgroundAlt,
                  borderRadius: theme.borderRadius.sm,
                  fontWeight: theme.fontWeight.medium
                }}>
                  {connectedSkills.length}
                </span>
              </div>

              {/* Skills Content */}
              {isSkillsExpanded && (
                <div style={{ padding: theme.spacing.md }}>
                  {connectedSkills.length === 0 ? (
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
                      {connectedSkills.map((skill) => (
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
                            <span style={{ fontSize: 18 }}>{skill.icon}</span>
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
      </div>
    </div>
  );
};

export default MiddleSection;
