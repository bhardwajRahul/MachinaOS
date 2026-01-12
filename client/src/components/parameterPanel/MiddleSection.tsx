import React, { useState } from 'react';
import ParameterRenderer from '../ParameterRenderer';
import ToolSchemaEditor from './ToolSchemaEditor';
import { useAppTheme } from '../../hooks/useAppTheme';
import { INodeTypeDescription, INodeProperties } from '../../types/INodeProperties';
import { ExecutionResult } from '../../services/executionService';

// Tool node types that support schema editing
const TOOL_NODE_TYPES = ['androidTool', 'calculatorTool', 'currentTimeTool', 'webSearchTool'];

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
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);

  const visibleParams = (nodeDefinition.properties || [])
    .filter((param: INodeProperties) => shouldShowParameter(param, parameters));

  // Check if this is a code executor node (Python or JavaScript)
  const isCodeExecutorNode = nodeDefinition.name === 'pythonExecutor' || nodeDefinition.name === 'javascriptExecutor';

  // Check if this is a tool node that supports schema editing
  const isToolNode = TOOL_NODE_TYPES.includes(nodeDefinition.name);

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
      {/* Description - hide for Python nodes */}
      {!isCodeExecutorNode && (
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
          flex: isCodeExecutorNode ? '3' : 1,
          overflowY: isCodeExecutorNode ? 'hidden' : 'auto',
          overflowX: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 0,
          display: isCodeExecutorNode ? 'flex' : 'block',
          flexDirection: 'column'
        }}>
          {/* Parameters Container */}
          <div style={{
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            padding: theme.spacing.lg,
            boxShadow: `0 1px 3px ${theme.colors.shadowLight}`,
            height: isCodeExecutorNode ? '100%' : 'auto',
            display: isCodeExecutorNode ? 'flex' : 'block',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}>
            {/* All Parameters - standard n8n style */}
            {visibleParams.map((param: INodeProperties, index: number) => (
              <div
                key={param.name}
                style={{
                  paddingBottom: index < visibleParams.length - 1 ? theme.spacing.md : 0,
                  marginBottom: index < visibleParams.length - 1 ? theme.spacing.md : 0,
                  borderBottom: index < visibleParams.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                  flex: isCodeExecutorNode ? 1 : 'none',
                  display: isCodeExecutorNode ? 'flex' : 'block',
                  flexDirection: 'column',
                  minHeight: 0
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
            ))}

            {/* Tool Schema Editor - Only for tool nodes */}
            {isToolNode && (
              <ToolSchemaEditor
                nodeId={nodeId}
                toolName={parameters.toolName || nodeDefinition.name}
                toolDescription={parameters.toolDescription || nodeDefinition.description || ''}
              />
            )}
          </div>
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
