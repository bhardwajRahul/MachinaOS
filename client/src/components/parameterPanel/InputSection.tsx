import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { nodeDefinitions } from '../../nodeDefinitions';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Node, Edge } from 'reactflow';
import { useDragVariable } from '../../hooks/useDragVariable';
import { useAppTheme } from '../../hooks/useAppTheme';
import { queryClient } from '../../lib/queryClient';
import { getCachedNodeSpec } from '../../lib/nodeSpec';

// ---------------------------------------------------------------------------
// Backend-driven node output schema lookup.
//
// Mirrors n8n's schemaPreview pattern (see
// docs-internal/schema_source_of_truth_rfc.md): the shape shown in the
// drag-drop variable panel for a node that has not been executed yet
// comes from the backend's Pydantic model registry via the
// `get_node_output_schema` WS handler. Results are cached per node
// type in the shared TanStack Query client (in-memory only, matching
// n8n's approach — schemas are small and the cache is cheap).
//
// Kept as a plain async helper (not a hook) because InputSection
// iterates over connected edges synchronously during render build-up
// and then needs to populate schemas for each unique node type once.
// ---------------------------------------------------------------------------

type NodeOutputSchema = Record<string, any> | null;

const nodeOutputSchemaQueryKey = (nodeType: string) =>
  ['nodeOutputSchema', nodeType] as const;

async function fetchNodeOutputSchema(
  nodeType: string,
  sendRequest: (type: string, data: any) => Promise<any>,
): Promise<NodeOutputSchema> {
  return queryClient.fetchQuery({
    queryKey: nodeOutputSchemaQueryKey(nodeType),
    queryFn: async () => {
      try {
        const response = await sendRequest('get_node_output_schema', { node_type: nodeType });
        return (response?.schema ?? null) as NodeOutputSchema;
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
  });
}

/**
 * Flatten a JSON-Schema-7 "object" shape into the plain
 * { field: 'primitive-type-name' | nestedObject } map the variable
 * panel expects. Only the fields the UI actually needs; other JSON
 * Schema keywords (minLength, pattern, etc.) are ignored.
 */
function jsonSchemaToShape(schema: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!schema || typeof schema !== 'object') return null;
  const props = schema.properties;
  if (!props || typeof props !== 'object') return null;

  const out: Record<string, any> = {};
  for (const [key, raw] of Object.entries(props)) {
    if (!raw || typeof raw !== 'object') continue;
    const prop = raw as Record<string, any>;
    if (prop.type === 'object' && prop.properties) {
      out[key] = jsonSchemaToShape(prop) ?? 'object';
    } else if (prop.type === 'array') {
      out[key] = 'array';
    } else if (typeof prop.type === 'string') {
      // string | number | integer | boolean | null
      out[key] = prop.type === 'integer' ? 'number' : prop.type;
    } else {
      out[key] = 'any';
    }
  }
  return out;
}

interface InputSectionProps {
  nodeId: string;
  visible?: boolean;
}

interface NodeData {
  id: string;           // Unique key (includes handle suffix for multi-output)
  sourceNodeId: string; // Original node ID for template variable resolution
  name: string;
  type: string;
  icon: string;
  inputData?: any;
  outputSchema: Record<string, any>;
  hasExecutionData: boolean;
}

// Helper to render icon (handles both image URLs and emoji/text)
const renderNodeIcon = (icon: string, size: number = 16) => {
  if (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/')) {
    return (
      <img
        src={icon}
        alt="icon"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  return <span style={{ fontSize: size - 2 }}>{icon}</span>;
};

const InputSection: React.FC<InputSectionProps> = ({ nodeId, visible = true }) => {
  const theme = useAppTheme();
  const { currentWorkflow } = useAppStore();
  const { getNodeOutput, sendRequest } = useWebSocket();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [connectedNodes, setConnectedNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const { handleVariableDragStart, getTemplateVariableName } = useDragVariable(nodeId);

  // Fetch connected node data with execution results from backend
  useEffect(() => {
    const fetchConnectedNodes = async () => {
      if (!currentWorkflow || !nodeId) {
        setConnectedNodes([]);
        return;
      }

      setLoading(true);
      const nodes = currentWorkflow.nodes || [];
      const edges = currentWorkflow.edges || [];

      // Helper to check if a handle is a config/auxiliary handle (not main data flow)
      const isConfigHandle = (handle: string | null | undefined): boolean => {
        if (!handle) return false;
        // Config handles follow pattern: input-<type> where type is not 'main', 'chat', or 'task'
        // Examples: input-memory, input-tools, input-model, input-skill
        // Non-config (primary data) handles: input-main, input-chat, input-task
        // Note: input-task is for taskTrigger node output which should be visible as draggable variables
        if (handle.startsWith('input-') && handle !== 'input-main' && handle !== 'input-chat' && handle !== 'input-task' && handle !== 'input-teammates') {
          return true;
        }
        return false;
      };

      // Helper to check if a node is a config/auxiliary node (connects to config handles)
      const isConfigNode = (nodeType: string | undefined): boolean => {
        if (!nodeType) return false;
        const definition = nodeDefinitions[nodeType];
        if (!definition) return false;
        // Config nodes typically have 'memory' or 'tool' in their group
        const groups = definition.group || [];
        return groups.includes('memory') || groups.includes('tool');
      };

      // Get current node info
      const currentNode = nodes.find((node: Node) => node.id === nodeId);
      const currentNodeType = currentNode?.type;

      // Wave 10.G.3: read `uiHints.hasSkills` declared by the node's
      // own plugin module (server/nodes/agents.py via _STD_AGENT_HINTS).
      // Retired the hardcoded AGENT_WITH_SKILLS_TYPES list.
      const agentSpec = currentNodeType ? getCachedNodeSpec(currentNodeType) : null;
      const isAgentWithSkills = (agentSpec?.uiHints as any)?.hasSkills === true;

      // Collect all edges to process (direct + inherited from parent for config nodes)
      interface EdgeWithLabel { edge: Edge; label?: string; targetHandleLabel?: string }
      const edgesToProcess: EdgeWithLabel[] = [];

      // 1. Add direct incoming edges to main data handles
      // Skip config handle connections (memory, tools, skill) for agent nodes - they're shown in Middle Section
      const directEdges = edges.filter((edge: Edge) => edge.target === nodeId);
      directEdges.forEach(edge => {
        // Skip config handle edges for agent nodes - they have dedicated UI in Middle Section
        if (isAgentWithSkills && isConfigHandle(edge.targetHandle)) {
          return;
        }
        // Extract target handle name for display (e.g., "input-skill" -> "skill")
        let targetHandleLabel: string | undefined;
        if (edge.targetHandle && edge.targetHandle.startsWith('input-') && edge.targetHandle !== 'input-main') {
          targetHandleLabel = edge.targetHandle.replace('input-', '');
        }
        edgesToProcess.push({ edge, targetHandleLabel });
      });

      // 2. If current node is a config node (memory, tool), inherit parent node's main inputs
      if (isConfigNode(currentNodeType)) {
        const outgoingEdges = edges.filter((edge: Edge) => edge.source === nodeId);

        for (const outEdge of outgoingEdges) {
          // Check if connected to a config handle on the target
          if (isConfigHandle(outEdge.targetHandle)) {
            const targetNode = nodes.find((node: Node) => node.id === outEdge.target);
            if (!targetNode) continue;

            const targetDef = nodeDefinitions[targetNode.type || ''];
            const targetName = targetDef?.displayName || targetNode.type;

            // Find nodes connected to the parent's main input (non-config handles)
            const parentInputEdges = edges.filter(
              (e: Edge) => e.target === targetNode.id && !isConfigHandle(e.targetHandle)
            );

            for (const parentEdge of parentInputEdges) {
              edgesToProcess.push({ edge: parentEdge, label: `via ${targetName}` });
            }
          }
        }
      }

      const nodeDataPromises = edgesToProcess.map(async ({ edge, label, targetHandleLabel }) => {
        const sourceNode = nodes.find((node: Node) => node.id === edge.source);
        const nodeType = sourceNode?.type || '';
        const nodeDef = nodeDefinitions[nodeType];

        // Determine output key from sourceHandle (edge-aware for multi-output nodes)
        let outputKey = 'output_0';
        if (edge.sourceHandle && edge.sourceHandle.startsWith('output-')) {
          const handleName = edge.sourceHandle.replace('output-', '');
          outputKey = `output_${handleName}`;
        }

        let executionData = await getNodeOutput(edge.source, outputKey);

        // Fallback to output_0 if specific handle output not found
        if (!executionData && outputKey !== 'output_0') {
          executionData = await getNodeOutput(edge.source, 'output_0');
        }
        let inputData: any = null;
        let outputSchema: Record<string, any>;
        let hasExecutionData = false;

        if (executionData && executionData[0] && executionData[0][0]) {
          const rawData = executionData[0][0].json || executionData[0][0];
          if (typeof rawData === 'object' && rawData !== null) {
            inputData = rawData;
            outputSchema = rawData;
            hasExecutionData = true;
          } else {
            inputData = { value: rawData };
            outputSchema = { value: typeof rawData };
            hasExecutionData = true;
          }
        } else {
          hasExecutionData = false;

          // Schema precedence (mirrors n8n VirtualSchema.vue — see
          // docs-internal/schema_source_of_truth_rfc.md):
          //   1. real run data (handled above in the `if` branch)
          //   2. user-authored blob (plugin declares `hasInitialDataBlob`)
          //   3. backend-declared schema via get_node_output_schema
          //   4. `{ data: 'any' }` empty fallback
          //
          // Wave 10.G.5: every dispatch decision reads from the node's
          // own NodeSpec — no `nodeType === 'start'` / 'socialReceive'
          // string checks.
          const sourceSpec = nodeType ? getCachedNodeSpec(nodeType) : null;
          const sourceHints = (sourceSpec?.uiHints as Record<string, any>) ?? {};

          if (sourceHints.hasInitialDataBlob === true) {
            try {
              const initialData = sourceNode?.data?.initialData || '{}';
              outputSchema = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
            } catch (e) {
              outputSchema = {};
            }
          } else {
            const backendSchema = jsonSchemaToShape(await fetchNodeOutputSchema(nodeType, sendRequest));
            if (backendSchema) {
              outputSchema = backendSchema;

              // Multi-output dispatch: when the source node declares
              // multiple output handles and the downstream edge picked
              // a specific one, slice the matching nested sub-shape.
              // Generalises socialReceive's 4-way fan-out to any node
              // whose spec declares >1 output handle — all driven by
              // handle topology, not node-type string.
              const outputHandleCount = (sourceSpec?.handles ?? []).filter(h => h.kind === 'output').length;
              if (outputHandleCount > 1 && edge.sourceHandle?.startsWith('output-')) {
                const handleName = edge.sourceHandle.replace('output-', '');
                const nested = handleName && (backendSchema as Record<string, any>)[handleName];
                if (nested !== undefined) {
                  outputSchema = typeof nested === 'object' && nested !== null
                    ? nested
                    : { [handleName]: nested };
                }
              }
            } else {
              outputSchema = { data: 'any' };
            }
          }
        }

        const baseName = sourceNode?.data?.label || nodeDef?.displayName || nodeType;

        // Build display name with handle info for multi-output and multi-input nodes
        let displayName = baseName;
        let handleSuffix = '';

        // Add source handle (output) info: "Node → message"
        if (edge.sourceHandle && edge.sourceHandle.startsWith('output-')) {
          const handleName = edge.sourceHandle.replace('output-', '');
          handleSuffix = handleName;
          displayName = `${baseName} → ${handleName}`;
        }

        // Add target handle (input) info: "Node (skill)" or "Node → message (skill)"
        if (targetHandleLabel) {
          displayName = `${displayName} (${targetHandleLabel})`;
          handleSuffix = handleSuffix ? `${handleSuffix}-${targetHandleLabel}` : targetHandleLabel;
        }

        // Add inherited label: "Node (via Parent)"
        if (label) {
          displayName = `${displayName} (${label})`;
        }

        // Use unique key combining source node ID, source handle, and target handle
        // to avoid duplicate keys when multiple edges connect the same nodes
        const uniqueId = handleSuffix ? `${edge.source}-${handleSuffix}` : edge.source;

        return {
          id: uniqueId,
          sourceNodeId: edge.source, // Keep original node ID for template variable resolution
          name: displayName,
          type: nodeType,
          icon: nodeDef?.icon || '',
          inputData,
          outputSchema,
          hasExecutionData
        };
      });

      const nodeDataResults = await Promise.all(nodeDataPromises);
      setConnectedNodes(nodeDataResults);
      // Auto-expand all nodes initially
      setExpandedNodes(new Set(nodeDataResults.map(n => n.id)));
      setLoading(false);
    };

    fetchConnectedNodes();
  }, [nodeId, currentWorkflow, getNodeOutput]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Render draggable property
  // NOTE: sourceNodeId is the unique node ID, used for template variable resolution
  const renderDraggableProperty = (key: string, value: any, sourceNodeId: string, path: string = '', depth: number = 0, maxArrayItems: number = 3) => {
    const currentPath = path ? `${path}.${key}` : key;
    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    const isArray = Array.isArray(value);

    // Handle arrays - show indexed items
    if (isArray && value.length > 0) {
      const templateName = getTemplateVariableName(sourceNodeId);
      const itemsToShow = Math.min(value.length, maxArrayItems);

      return (
        <div key={currentPath} style={{ marginLeft: depth > 0 ? 16 : 0, marginBottom: 8 }}>
          <div style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.textMuted,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {key}
            <span style={{
              fontSize: '10px',
              color: theme.dracula.purple,
              padding: '1px 6px',
              backgroundColor: theme.dracula.purple + '20',
              borderRadius: theme.borderRadius.sm,
            }}>
              [{value.length} items]
            </span>
          </div>
          <div>
            {/* Render first N array items with their index */}
            {value.slice(0, itemsToShow).map((item: any, index: number) => {
              const indexedPath = `${key}[${index}]`;
              const fullIndexedPath = path ? `${path}.${indexedPath}` : indexedPath;

              if (typeof item === 'object' && item !== null) {
                // Object item - render its properties with indexed path
                return (
                  <div key={`${currentPath}[${index}]`} style={{
                    marginLeft: 8,
                    marginBottom: 8,
                    padding: theme.spacing.xs,
                    backgroundColor: theme.colors.backgroundElevated,
                    borderRadius: theme.borderRadius.sm,
                    border: `1px dashed ${theme.colors.border}`,
                  }}>
                    <div style={{
                      fontSize: theme.fontSize.xs,
                      fontWeight: theme.fontWeight.medium,
                      color: theme.dracula.cyan,
                      marginBottom: 4,
                    }}>
                      [{index}]
                    </div>
                    {Object.entries(item).map(([itemKey, itemValue]) => {
                      const itemPath = `${fullIndexedPath}.${itemKey}`;
                      // For nested objects within array items, render as draggable
                      if (typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue)) {
                        return (
                          <div key={itemPath} style={{ marginLeft: 8, marginBottom: 4 }}>
                            <div style={{
                              fontSize: theme.fontSize.xs,
                              color: theme.colors.textMuted,
                              marginBottom: 2,
                            }}>
                              {itemKey}:
                            </div>
                            {Object.entries(itemValue as Record<string, any>).map(([nestedKey, nestedValue]) => (
                              <div
                                key={`${itemPath}.${nestedKey}`}
                                draggable
                                onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, `${itemPath}.${nestedKey}`, nestedValue)}
                                style={{
                                  marginBottom: 4,
                                  marginLeft: 8,
                                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                  backgroundColor: theme.colors.backgroundAlt,
                                  border: `1px solid ${theme.colors.focus}`,
                                  borderRadius: theme.borderRadius.sm,
                                  cursor: 'grab',
                                  fontSize: theme.fontSize.xs,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = theme.colors.focusRing;
                                  e.currentTarget.style.borderColor = theme.dracula.cyan;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                                  e.currentTarget.style.borderColor = theme.colors.focus;
                                }}
                              >
                                <span style={{ color: theme.colors.templateVariable, fontFamily: 'monospace' }}>
                                  {`{{${templateName}.${itemPath}.${nestedKey}}}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      // Primitive value in array item
                      return (
                        <div
                          key={itemPath}
                          draggable
                          onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, itemPath, itemValue)}
                          style={{
                            marginBottom: 4,
                            marginLeft: 8,
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            backgroundColor: theme.colors.backgroundAlt,
                            border: `1px solid ${theme.colors.focus}`,
                            borderRadius: theme.borderRadius.sm,
                            cursor: 'grab',
                            fontSize: theme.fontSize.xs,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.focusRing;
                            e.currentTarget.style.borderColor = theme.dracula.cyan;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                            e.currentTarget.style.borderColor = theme.colors.focus;
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ color: theme.colors.templateVariable, fontFamily: 'monospace' }}>
                                {`{{${templateName}.${itemPath}}}`}
                              </span>
                              <span style={{ color: theme.colors.textMuted, marginLeft: 8 }}>
                                {itemKey}: {typeof itemValue}
                              </span>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.colors.templateVariable} strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <polyline points="19 12 12 19 5 12"/>
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                // Primitive array item
                return (
                  <div
                    key={`${currentPath}[${index}]`}
                    draggable
                    onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, fullIndexedPath, item)}
                    style={{
                      marginBottom: 4,
                      marginLeft: 8,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: theme.colors.backgroundAlt,
                      border: `1px solid ${theme.colors.focus}`,
                      borderRadius: theme.borderRadius.sm,
                      cursor: 'grab',
                      fontSize: theme.fontSize.xs,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.focusRing;
                      e.currentTarget.style.borderColor = theme.dracula.cyan;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                      e.currentTarget.style.borderColor = theme.colors.focus;
                    }}
                  >
                    <span style={{ color: theme.colors.templateVariable, fontFamily: 'monospace' }}>
                      {`{{${templateName}.${fullIndexedPath}}}`}
                    </span>
                    <span style={{ color: theme.colors.textMuted, marginLeft: 8 }}>
                      [{index}]: {typeof item}
                    </span>
                  </div>
                );
              }
            })}
            {/* Show "and N more" if array has more items */}
            {value.length > maxArrayItems && (
              <div style={{
                marginLeft: 8,
                fontSize: theme.fontSize.xs,
                color: theme.colors.textMuted,
                fontStyle: 'italic',
              }}>
                ... and {value.length - maxArrayItems} more items
              </div>
            )}
          </div>
        </div>
      );
    }

    // Handle empty arrays
    if (isArray && value.length === 0) {
      return (
        <div key={currentPath} style={{ marginLeft: depth > 0 ? 16 : 0, marginBottom: 8 }}>
          <div style={{
            fontSize: theme.fontSize.xs,
            color: theme.colors.textMuted,
          }}>
            {key}: <span style={{ fontStyle: 'italic' }}>empty array</span>
          </div>
        </div>
      );
    }

    // Handle objects
    if (isObject) {
      return (
        <div key={currentPath} style={{ marginLeft: depth > 0 ? 16 : 0, marginBottom: 8 }}>
          <div style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.textMuted,
            marginBottom: 4,
          }}>
            {key}:
          </div>
          <div>
            {Object.entries(value as Record<string, any>).map(([subKey, subValue]) =>
              renderDraggableProperty(subKey, subValue, sourceNodeId, currentPath, depth + 1)
            )}
          </div>
        </div>
      );
    }

    const templateName = getTemplateVariableName(sourceNodeId);
    return (
      <div
        key={currentPath}
        draggable
        onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, currentPath, value)}
        style={{
          marginBottom: 8,
          marginLeft: depth > 0 ? 16 : 0,
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.backgroundAlt,
          border: `1px solid ${theme.colors.focus}`,
          borderRadius: theme.borderRadius.md,
          cursor: 'grab',
          transition: theme.transitions.fast,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.focusRing;
          e.currentTarget.style.borderColor = theme.dracula.cyan;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
          e.currentTarget.style.borderColor = theme.colors.focus;
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.medium,
              color: theme.colors.templateVariable,
              marginBottom: 2,
            }}>
              {`{{${templateName}.${currentPath}}}`}
            </div>
            <div style={{
              fontSize: theme.fontSize.xs,
              color: theme.colors.textSecondary,
            }}>
              {key}: {typeof value}
            </div>
          </div>
          {/* Drag icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.templateVariable} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>
      </div>
    );
  };

  if (!visible) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.backgroundPanel,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: `3px solid ${theme.colors.border}`,
          borderTopColor: theme.dracula.cyan,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: theme.spacing.lg,
        }} />
        <style>
          {`@keyframes spin { to { transform: rotate(360deg); } }`}
        </style>
        <div style={{
          fontSize: theme.fontSize.sm,
          color: theme.colors.textSecondary,
        }}>
          Loading input data...
        </div>
      </div>
    );
  }

  // Empty state
  if (connectedNodes.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.backgroundPanel,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
      }}>
        {/* Link icon */}
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: theme.spacing.lg }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <div style={{
          fontSize: theme.fontSize.base,
          fontWeight: theme.fontWeight.medium,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xs,
        }}>
          No connected inputs
        </div>
        <div style={{
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          textAlign: 'center',
        }}>
          Connect nodes to see input data and available variables
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.backgroundPanel,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: `${theme.spacing.md} ${theme.spacing.lg}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flexShrink: 0,
      }}>
        {/* Database icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
        <span style={{
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.semibold,
          color: theme.colors.text,
        }}>
          Input Data & Variables
        </span>
        <span style={{
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.medium,
          color: theme.dracula.cyan,
          padding: `2px ${theme.spacing.sm}`,
          backgroundColor: theme.dracula.cyan + '20',
          borderRadius: theme.borderRadius.sm,
        }}>
          {connectedNodes.length}
        </span>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: theme.spacing.md,
      }}>
        {connectedNodes.map((node) => {
          const isExpanded = expandedNodes.has(node.id);

          return (
            <div key={node.id} style={{
              marginBottom: theme.spacing.md,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderLeft: `3px solid ${node.hasExecutionData ? theme.dracula.green : theme.dracula.orange}`,
              borderRadius: theme.borderRadius.md,
              overflow: 'hidden',
            }}>
              {/* Node Header */}
              <div
                onClick={() => toggleNode(node.id)}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  backgroundColor: theme.colors.backgroundAlt,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: theme.transitions.fast,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  {renderNodeIcon(node.icon, 18)}
                  <span style={{
                    fontSize: theme.fontSize.sm,
                    fontWeight: theme.fontWeight.semibold,
                    color: theme.colors.text,
                  }}>
                    {node.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  {/* Status badge */}
                  <span style={{
                    fontSize: '10px',
                    fontWeight: theme.fontWeight.medium,
                    color: node.hasExecutionData ? theme.dracula.green : theme.dracula.orange,
                    padding: `2px ${theme.spacing.xs}`,
                    backgroundColor: node.hasExecutionData ? theme.dracula.green + '20' : theme.dracula.orange + '20',
                    borderRadius: theme.borderRadius.sm,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {node.hasExecutionData ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={theme.dracula.green} stroke="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={theme.dracula.orange} stroke="none">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                      </svg>
                    )}
                    {node.hasExecutionData ? 'LIVE' : 'SCHEMA'}
                  </span>
                  {/* Expand arrow */}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Node Content */}
              {isExpanded && (
                <div style={{
                  padding: theme.spacing.md,
                  borderTop: `1px solid ${theme.colors.border}`,
                }}>
                  {/* Schema info banner */}
                  {!node.hasExecutionData && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      marginBottom: theme.spacing.md,
                      backgroundColor: theme.dracula.cyan + '10',
                      border: `1px solid ${theme.dracula.cyan}40`,
                      borderRadius: theme.borderRadius.sm,
                      fontSize: theme.fontSize.xs,
                      color: theme.dracula.cyan,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={theme.dracula.cyan} stroke="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                      </svg>
                      Schema view - Execute this node to see actual input data
                    </div>
                  )}

                  {/* Live data preview */}
                  {node.hasExecutionData && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <div style={{
                        fontSize: theme.fontSize.xs,
                        fontWeight: theme.fontWeight.medium,
                        color: theme.colors.textMuted,
                        marginBottom: theme.spacing.xs,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Received Data
                      </div>
                      <pre style={{
                        margin: 0,
                        padding: theme.spacing.sm,
                        fontSize: theme.fontSize.xs,
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                        backgroundColor: theme.colors.backgroundElevated,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                        overflow: 'auto',
                        maxHeight: '120px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: theme.dracula.foreground,
                      }}>
                        {JSON.stringify(node.inputData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Draggable variables */}
                  <div style={{
                    fontSize: theme.fontSize.xs,
                    fontWeight: theme.fontWeight.medium,
                    color: theme.colors.textMuted,
                    marginBottom: theme.spacing.sm,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Drag Variables to Parameters
                  </div>
                  <div>
                    {typeof node.outputSchema === 'object' && node.outputSchema !== null
                      ? Object.entries(node.outputSchema).map(([key, value]) =>
                          renderDraggableProperty(key, value, node.sourceNodeId || node.id)
                        )
                      : (
                        <div style={{
                          fontSize: theme.fontSize.sm,
                          color: theme.colors.textMuted,
                          fontStyle: 'italic',
                        }}>
                          No variables available
                        </div>
                      )
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        fontSize: theme.fontSize.xs,
        color: theme.colors.textMuted,
        textAlign: 'center',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Drag variables into parameter fields to use them
      </div>
    </div>
  );
};

export default InputSection;
