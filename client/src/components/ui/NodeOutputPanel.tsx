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

  // Structured output types for different node responses
  type AndroidOutput = { type: 'android'; data: any; service?: string; action?: string };
  type WhatsAppHistoryOutput = { type: 'whatsapp_history'; messages: any[]; total: number; count: number; hasMore: boolean };
  type MapsNearbyOutput = { type: 'maps_nearby'; places: any[]; searchParams: any; total: number };
  type MapsGeocodeOutput = { type: 'maps_geocode'; locations: any[]; total: number };
  type MapsCreateOutput = { type: 'maps_create'; mapUrl: string; center: { lat: number; lng: number }; zoom: number; mapType: string };
  type StructuredOutput = AndroidOutput | WhatsAppHistoryOutput | MapsNearbyOutput | MapsGeocodeOutput | MapsCreateOutput;

  // Extract the main response text from execution results
  const getMainResponse = (result: ExecutionResult): string | StructuredOutput | null => {
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
    // WhatsApp Chat History output
    if (data?.result?.messages !== undefined && data?.result?.total !== undefined) {
      return { type: 'whatsapp_history', messages: data.result.messages, total: data.result.total, count: data.result.count, hasMore: data.result.has_more };
    }
    if (data?.messages !== undefined && data?.total !== undefined) {
      return { type: 'whatsapp_history', messages: data.messages, total: data.total, count: data.count || data.messages?.length, hasMore: data.has_more };
    }
    // Google Maps nearby places output
    // Check nested result structure (from backend: { success, result: { results, search_parameters } })
    if (data?.result?.results !== undefined && data?.result?.search_parameters !== undefined) {
      return {
        type: 'maps_nearby',
        places: data.result.results,
        searchParams: data.result.search_parameters,
        total: data.result.total_results || data.result.results.length
      };
    }
    // Also check top-level structure (if already unwrapped)
    if (data?.results !== undefined && data?.search_parameters !== undefined) {
      return {
        type: 'maps_nearby',
        places: data.results,
        searchParams: data.search_parameters,
        total: data.total_results || data.results.length
      };
    }
    // Google Maps geocoding output
    if (data?.result?.locations !== undefined && data?.result?.total_found !== undefined) {
      return {
        type: 'maps_geocode',
        locations: data.result.locations,
        total: data.result.total_found
      };
    }
    // Geocode top-level fallback
    if (data?.locations !== undefined && data?.total_found !== undefined) {
      return {
        type: 'maps_geocode',
        locations: data.locations,
        total: data.total_found
      };
    }
    // Google Maps create map output
    if (data?.result?.static_map_url !== undefined) {
      return {
        type: 'maps_create',
        mapUrl: data.result.static_map_url,
        center: data.result.center,
        zoom: data.result.zoom,
        mapType: data.result.map_type
      };
    }
    // Create map top-level fallback
    if (data?.static_map_url !== undefined) {
      return {
        type: 'maps_create',
        mapUrl: data.static_map_url,
        center: data.center,
        zoom: data.zoom,
        mapType: data.map_type
      };
    }
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
        ) : mainResponse && typeof mainResponse === 'object' && (mainResponse as any).type === 'whatsapp_history' ? (
          /* WhatsApp Chat History Response */
          <div style={{
            marginBottom: theme.spacing.md,
          }}>
            {/* Header with count */}
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid #25D36640`,
              borderRadius: `${theme.borderRadius.md} ${theme.borderRadius.md} 0 0`,
              borderLeft: `3px solid #25D366`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: '#25D366',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat History
              </div>
              <div style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.textSecondary,
                display: 'flex',
                gap: theme.spacing.md,
              }}>
                <span style={{ color: '#25D366' }}>{(mainResponse as any).count || 0} messages</span>
                {(mainResponse as any).total > 0 && (
                  <span>of {(mainResponse as any).total} total</span>
                )}
                {(mainResponse as any).hasMore && (
                  <span style={{ color: theme.dracula.orange }}>more available</span>
                )}
              </div>
            </div>

            {/* Messages list */}
            <div style={{
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid #25D36640`,
              borderTop: 'none',
              borderRadius: `0 0 ${theme.borderRadius.md} ${theme.borderRadius.md}`,
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {(mainResponse as any).messages?.length === 0 ? (
                <div style={{
                  padding: theme.spacing.xl,
                  textAlign: 'center',
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSize.sm,
                }}>
                  No messages found for this chat
                </div>
              ) : (
                (mainResponse as any).messages?.map((msg: any, idx: number) => (
                  <div
                    key={msg.message_id || idx}
                    style={{
                      padding: theme.spacing.md,
                      borderBottom: idx < (mainResponse as any).messages.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: theme.spacing.xs,
                    }}
                  >
                    {/* Message header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}>
                        {/* From me indicator */}
                        {msg.is_from_me ? (
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: theme.dracula.cyan + '20',
                            color: theme.dracula.cyan,
                            borderRadius: theme.borderRadius.sm,
                            fontWeight: theme.fontWeight.medium,
                          }}>
                            You
                          </span>
                        ) : (
                          <span style={{
                            fontSize: theme.fontSize.xs,
                            fontWeight: theme.fontWeight.medium,
                            color: theme.dracula.purple,
                          }}>
                            {msg.sender_phone || msg.sender?.split('@')[0] || 'Unknown'}
                          </span>
                        )}
                        {/* Message type badge */}
                        {msg.message_type !== 'text' && (
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: theme.dracula.orange + '20',
                            color: theme.dracula.orange,
                            borderRadius: theme.borderRadius.sm,
                            textTransform: 'uppercase',
                          }}>
                            {msg.message_type}
                          </span>
                        )}
                        {msg.is_group && (
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: theme.dracula.green + '20',
                            color: theme.dracula.green,
                            borderRadius: theme.borderRadius.sm,
                          }}>
                            Group
                          </span>
                        )}
                      </div>
                      {/* Timestamp */}
                      <span style={{
                        fontSize: theme.fontSize.xs,
                        color: theme.colors.textMuted,
                      }}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    {/* Message text */}
                    {msg.text && (
                      <div style={{
                        fontSize: theme.fontSize.sm,
                        color: theme.colors.text,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        paddingLeft: theme.spacing.sm,
                        borderLeft: `2px solid ${msg.is_from_me ? theme.dracula.cyan : theme.dracula.purple}30`,
                      }}>
                        {msg.text}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : mainResponse && typeof mainResponse === 'object' && (mainResponse as any).type === 'maps_nearby' ? (
          /* Google Maps Nearby Places Response */
          <div style={{
            marginBottom: theme.spacing.md,
          }}>
            {/* Header with search params */}
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid #34a85340`,
              borderRadius: `${theme.borderRadius.md} ${theme.borderRadius.md} 0 0`,
              borderLeft: `3px solid #34a853`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: '#34a853',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#34a853">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Nearby Places
              </div>
              <div style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.textSecondary,
                display: 'flex',
                gap: theme.spacing.md,
              }}>
                <span style={{ color: '#34a853' }}>{(mainResponse as any).total} places found</span>
                {(mainResponse as any).searchParams?.type && (
                  <span>Type: {(mainResponse as any).searchParams.type}</span>
                )}
                {(mainResponse as any).searchParams?.keyword && (
                  <span>Keyword: {(mainResponse as any).searchParams.keyword}</span>
                )}
              </div>
            </div>

            {/* Places list */}
            <div style={{
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid #34a85340`,
              borderTop: 'none',
              borderRadius: `0 0 ${theme.borderRadius.md} ${theme.borderRadius.md}`,
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {(mainResponse as any).places?.length === 0 ? (
                <div style={{
                  padding: theme.spacing.xl,
                  textAlign: 'center',
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSize.sm,
                }}>
                  No places found for this search
                </div>
              ) : (
                (mainResponse as any).places?.map((place: any, idx: number) => (
                  <div
                    key={place.place_id || idx}
                    style={{
                      padding: theme.spacing.md,
                      borderBottom: idx < (mainResponse as any).places.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: theme.spacing.xs,
                    }}
                  >
                    {/* Place header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: theme.fontSize.sm,
                          fontWeight: theme.fontWeight.semibold,
                          color: theme.colors.text,
                          marginBottom: '2px',
                        }}>
                          {place.name}
                        </div>
                        {place.vicinity && (
                          <div style={{
                            fontSize: theme.fontSize.xs,
                            color: theme.colors.textMuted,
                          }}>
                            {place.vicinity}
                          </div>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}>
                        {/* Rating */}
                        {place.rating && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            backgroundColor: theme.dracula.yellow + '20',
                            borderRadius: theme.borderRadius.sm,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={theme.dracula.yellow}>
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span style={{ fontSize: theme.fontSize.xs, color: theme.dracula.yellow, fontWeight: theme.fontWeight.medium }}>
                              {place.rating}
                            </span>
                            {place.user_ratings_total && (
                              <span style={{ fontSize: '10px', color: theme.colors.textMuted }}>
                                ({place.user_ratings_total})
                              </span>
                            )}
                          </div>
                        )}
                        {/* Open now */}
                        {place.opening_hours?.open_now !== undefined && (
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: place.opening_hours.open_now ? theme.dracula.green + '20' : theme.dracula.red + '20',
                            color: place.opening_hours.open_now ? theme.dracula.green : theme.dracula.red,
                            borderRadius: theme.borderRadius.sm,
                            fontWeight: theme.fontWeight.medium,
                          }}>
                            {place.opening_hours.open_now ? 'Open' : 'Closed'}
                          </span>
                        )}
                        {/* Price level */}
                        {place.price_level !== undefined && (
                          <span style={{
                            fontSize: theme.fontSize.xs,
                            color: theme.colors.textMuted,
                          }}>
                            {'$'.repeat(place.price_level + 1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Place types */}
                    {place.types && place.types.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginTop: '4px',
                      }}>
                        {place.types.slice(0, 4).map((type: string) => (
                          <span key={type} style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: theme.colors.backgroundAlt,
                            color: theme.colors.textSecondary,
                            borderRadius: theme.borderRadius.sm,
                          }}>
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : mainResponse && typeof mainResponse === 'object' && (mainResponse as any).type === 'maps_geocode' ? (
          /* Google Maps Geocoding Response */
          <div style={{
            marginBottom: theme.spacing.md,
          }}>
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid #4285f440`,
              borderRadius: `${theme.borderRadius.md} ${theme.borderRadius.md} 0 0`,
              borderLeft: `3px solid #4285f4`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: '#4285f4',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#4285f4">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Geocoded Locations
              </div>
              <span style={{ fontSize: theme.fontSize.xs, color: '#4285f4' }}>
                {(mainResponse as any).total} location(s) found
              </span>
            </div>
            <div style={{
              backgroundColor: theme.colors.backgroundElevated,
              border: `1px solid #4285f440`,
              borderTop: 'none',
              borderRadius: `0 0 ${theme.borderRadius.md} ${theme.borderRadius.md}`,
              maxHeight: '300px',
              overflow: 'auto',
            }}>
              {(mainResponse as any).locations?.map((loc: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: theme.spacing.md,
                    borderBottom: idx < (mainResponse as any).locations.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                  }}
                >
                  <div style={{ fontWeight: theme.fontWeight.medium, color: theme.colors.text, marginBottom: '4px' }}>
                    {loc.formatted_address || loc.address}
                  </div>
                  <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                    Lat: {loc.lat?.toFixed(6)}, Lng: {loc.lng?.toFixed(6)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : mainResponse && typeof mainResponse === 'object' && (mainResponse as any).type === 'maps_create' ? (
          /* Google Maps Create Map Response */
          <div style={{
            marginBottom: theme.spacing.md,
            backgroundColor: theme.colors.backgroundElevated,
            border: `1px solid #ea433540`,
            borderRadius: theme.borderRadius.md,
            borderLeft: `3px solid #ea4335`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: theme.spacing.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}>
              <div style={{
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: '#ea4335',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ea4335">
                  <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
                </svg>
                Map Created
              </div>
              <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>
                {(mainResponse as any).mapType} | Zoom: {(mainResponse as any).zoom}
              </div>
            </div>
            <div style={{ padding: theme.spacing.md }}>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
                Center: {(mainResponse as any).center?.lat?.toFixed(4)}, {(mainResponse as any).center?.lng?.toFixed(4)}
              </div>
              <a
                href={(mainResponse as any).mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  backgroundColor: '#ea433520',
                  color: '#ea4335',
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid #ea433540`,
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.medium,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open Map Preview
              </a>
            </div>
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
