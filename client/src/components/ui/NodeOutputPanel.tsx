import React, { useState } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ExecutionResult } from '../../services/executionService';
import { Node } from 'reactflow';
import { copyToClipboard } from '../../utils/formatters';

// Simple JSON syntax highlighter using Dracula colors
const highlightJSON = (json: string, dracula: any): React.ReactNode => {
  const lines = json.split('\n');
  return lines.map((line, i) => {
    // Highlight different parts of JSON
    const highlighted = line
      .replace(/"([^"]+)":/g, `<span style="color: ${dracula.cyan}">"$1"</span>:`)
      .replace(/: "([^"]+)"/g, `: <span style="color: ${dracula.yellow}">"$1"</span>`)
      .replace(/: (\d+\.?\d*)/g, `: <span style="color: ${dracula.purple}">$1</span>`)
      .replace(/: (true|false)/g, `: <span style="color: ${dracula.purple}">$1</span>`)
      .replace(/: (null)/g, `: <span style="color: ${dracula.orange}">$1</span>`);
    return (
      <div key={i} dangerouslySetInnerHTML={{ __html: highlighted }} />
    );
  });
};

interface NodeOutputPanelProps {
  results: ExecutionResult[];
  onClear?: () => void;
  selectedNode?: Node | null;
}

const NodeOutputPanel: React.FC<NodeOutputPanelProps> = ({
  results,
  onClear,
  selectedNode
}) => {
  const theme = useAppTheme();
  const [showRawJson, setShowRawJson] = useState(false);

  // Filter results to only show current node's output
  const nodeResults = selectedNode ? results.filter(result => result.nodeId === selectedNode.id) : results;

  // Get output data with fallbacks
  const getOutputData = (result: ExecutionResult) => {
    if (result.outputs && Object.keys(result.outputs).length > 0) {
      return result.outputs;
    }
    if (result.data && Object.keys(result.data).length > 0) {
      return result.data;
    }
    if (result.nodeData && result.nodeData.length > 0 && result.nodeData[0].length > 0) {
      return result.nodeData[0][0].json;
    }
    return {
      success: result.success,
      message: 'Execution completed'
    };
  };

  // Helper to parse nested JSON strings in Android responses
  const parseAndroidData = (data: any): any => {
    if (typeof data !== 'object' || data === null) return data;

    const parsed: any = Array.isArray(data) ? [] : {};
    for (const key in data) {
      const value = data[key];
      // Try to parse string values that look like JSON arrays or objects
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          parsed[key] = JSON.parse(value);
        } catch {
          parsed[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        parsed[key] = parseAndroidData(value);
      } else {
        parsed[key] = value;
      }
    }
    return parsed;
  };

  // Extract the main response text from execution results
  const getMainResponse = (result: ExecutionResult): string | { type: string; data: any; service: string; action: string } | null => {
    const data = getOutputData(result);
    // Python node output
    if (data?.output !== undefined) {
      return typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2);
    }
    if (data?.result?.response) return data.result.response;
    if (data?.response) return data.response;
    if (data?.result?.text) return data.result.text;
    if (data?.text) return data.text;
    if (data?.result?.content) return data.result.content;
    if (data?.content) return data.content;
    if (data?.result?.message) return data.result.message;
    if (data?.message && typeof data.message === 'string' && data.message !== 'Execution completed') return data.message;
    // WhatsApp message preview
    if (data?.result?.preview) return data.result.preview;
    if (data?.preview) return data.preview;
    // Webhook trigger output
    if (data?.method && data?.path !== undefined) {
      let bodyData = data.json || (data.body ? (() => { try { return JSON.parse(data.body); } catch { return data.body; } })() : null);
      const bodyStr = bodyData ? JSON.stringify(bodyData) : '';
      return `${data.method} /${data.path}${bodyStr ? ` - ${bodyStr}` : ''}`;
    }
    // HTTP Request output - format status and data
    if (data?.status !== undefined && data?.data !== undefined) {
      const statusText = data.status >= 200 && data.status < 300 ? 'OK' : data.status >= 400 ? 'Error' : '';
      const isHtml = typeof data.data === 'string' && data.data.trim().startsWith('<');
      const isLong = typeof data.data === 'string' && data.data.length > 200;

      if (isHtml) {
        return `${data.status} ${statusText} - HTML response (${data.data.length} chars)`;
      } else if (isLong) {
        return `${data.status} ${statusText} - ${data.data.substring(0, 150)}...`;
      } else if (typeof data.data === 'string') {
        return `${data.status} ${statusText} - ${data.data}`;
      } else {
        return `${data.status} ${statusText}\n${JSON.stringify(data.data, null, 2)}`;
      }
    }
    // Android service output - show received data with parsed nested JSON
    if (data?.service_id && data?.data) {
      const parsedData = parseAndroidData(data.data);
      return { type: 'android', data: parsedData, service: data.service_id, action: data.action };
    }
    return null;
  };

  // Get the most recent result
  const latestResult = nodeResults[0];

  if (nodeResults.length === 0) {
    const hasOtherResults = results.length > 0;

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
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: theme.spacing.lg }}>
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <div style={{
          fontSize: theme.fontSize.base,
          fontWeight: theme.fontWeight.medium,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xs
        }}>
          No output yet
        </div>
        <div style={{
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          textAlign: 'center'
        }}>
          Run the node to see results
        </div>
        {hasOtherResults && (
          <div style={{
            marginTop: theme.spacing.md,
            fontSize: theme.fontSize.xs,
            color: theme.dracula.orange,
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            backgroundColor: theme.dracula.orange + '15',
            borderRadius: theme.borderRadius.sm,
          }}>
            {results.length} result(s) from other nodes
          </div>
        )}
      </div>
    );
  }

  const outputData = getOutputData(latestResult);
  const mainResponse = getMainResponse(latestResult);

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.backgroundElevated,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          {latestResult.success ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill={theme.dracula.green} stroke="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill={theme.dracula.red} stroke="none">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
            </svg>
          )}
          <span style={{
            fontSize: theme.fontSize.base,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
          }}>
            Output
          </span>
          <span style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.semibold,
            color: latestResult.success ? theme.dracula.green : theme.dracula.red,
            padding: `4px ${theme.spacing.md}`,
            backgroundColor: latestResult.success ? theme.dracula.green + '25' : theme.dracula.red + '25',
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${latestResult.success ? theme.dracula.green : theme.dracula.red}50`,
            letterSpacing: '0.05em',
          }}>
            {latestResult.success ? 'SUCCESS' : 'FAILED'}
          </span>
          {latestResult.executionTime > 0 && (
            <span style={{
              fontSize: theme.fontSize.sm,
              color: theme.colors.textSecondary,
              fontFamily: 'Monaco, Menlo, monospace',
            }}>
              {latestResult.executionTime.toFixed(2)}ms
            </span>
          )}
        </div>
        {onClear && (
          <button
            onClick={onClear}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              fontSize: theme.fontSize.xs,
              color: theme.colors.textSecondary,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.xs,
              transition: theme.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: theme.spacing.md,
      }}>
        {/* Error Display */}
        {latestResult.error && (
          <div style={{
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
            backgroundColor: theme.dracula.red + '10',
            border: `1px solid ${theme.dracula.red}40`,
            borderRadius: theme.borderRadius.md,
          }}>
            <div style={{
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.medium,
              color: theme.dracula.red,
              marginBottom: theme.spacing.sm,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Error
            </div>
            <pre style={{
              margin: 0,
              fontSize: theme.fontSize.sm,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              color: theme.dracula.red,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {latestResult.error}
            </pre>
          </div>
        )}

        {/* Main Response */}
        {mainResponse && typeof mainResponse === 'object' && (mainResponse as any).type === 'android' ? (
          /* Android Service Response */
          <div style={{
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.md,
            backgroundColor: theme.colors.backgroundElevated,
            border: `1px solid ${theme.dracula.green}40`,
            borderRadius: theme.borderRadius.md,
            borderLeft: `3px solid ${theme.dracula.green}`,
          }}>
            <div style={{
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.semibold,
              color: theme.dracula.green,
              marginBottom: theme.spacing.md,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
              {(mainResponse as any).service?.replace(/_/g, ' ')} - {(mainResponse as any).action}
            </div>
            <pre style={{
              margin: 0,
              fontSize: theme.fontSize.sm,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              color: theme.colors.text,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {highlightJSON(JSON.stringify((mainResponse as any).data, null, 2), theme.dracula)}
            </pre>
          </div>
        ) : mainResponse && (
          /* Standard Response (AI, etc) */
          <div style={{
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.md,
            backgroundColor: theme.colors.backgroundElevated,
            border: `1px solid ${theme.dracula.cyan}40`,
            borderRadius: theme.borderRadius.md,
            borderLeft: `3px solid ${theme.dracula.cyan}`,
          }}>
            <div style={{
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.semibold,
              color: theme.dracula.cyan,
              marginBottom: theme.spacing.md,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Response
            </div>
            <div style={{
              fontSize: theme.fontSize.base,
              color: theme.colors.text,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontWeight: theme.fontWeight.normal,
            }}>
              {mainResponse as string}
            </div>
          </div>
        )}

        {/* JSON Output Toggle */}
        <div style={{
          backgroundColor: theme.colors.backgroundElevated,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          overflow: 'hidden',
        }}>
          <div
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.colors.backgroundAlt,
              cursor: 'pointer',
              transition: theme.transitions.fast,
              borderBottom: showRawJson ? `1px solid ${theme.colors.border}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.dracula.purple}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: showRawJson ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.dracula.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span style={{
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.medium,
                color: theme.colors.text,
              }}>
                {showRawJson ? 'Hide' : 'Show'} Raw JSON
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(outputData, 'JSON copied to clipboard!');
              }}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                fontSize: theme.fontSize.xs,
                color: theme.dracula.cyan,
                backgroundColor: `${theme.dracula.cyan}15`,
                border: `1px solid ${theme.dracula.cyan}40`,
                borderRadius: theme.borderRadius.sm,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.xs,
                transition: theme.transitions.fast,
                fontWeight: theme.fontWeight.medium,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${theme.dracula.cyan}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${theme.dracula.cyan}15`;
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          </div>

          {/* Expanded JSON with syntax highlighting */}
          {showRawJson && (
            <div style={{
              margin: 0,
              padding: theme.spacing.md,
              fontSize: theme.fontSize.sm,
              fontFamily: '"Fira Code", Monaco, Menlo, "Ubuntu Mono", monospace',
              lineHeight: 1.6,
              overflow: 'auto',
              maxHeight: '400px',
              backgroundColor: '#1a1a2e',
              color: theme.dracula.foreground,
            }}>
              {highlightJSON(JSON.stringify(outputData, null, 2), theme.dracula)}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {nodeResults.length > 1 && (
        <div style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          fontSize: theme.fontSize.xs,
          color: theme.colors.textMuted,
          textAlign: 'center',
          flexShrink: 0,
        }}>
          Showing latest of {nodeResults.length} results
        </div>
      )}
    </div>
  );
};

export default NodeOutputPanel;
