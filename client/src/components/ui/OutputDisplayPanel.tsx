import React, { useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { ExecutionResult } from '../../services/executionService';
import { copyToClipboard, formatTimestamp } from '../../utils/formatters';
import { useAppTheme } from '../../hooks/useAppTheme';
import { styles as themeStyles, getPrismTokenCSS } from '../../styles/theme';

interface OutputDisplayPanelProps {
  results: ExecutionResult[];
  onClear?: () => void;
  selectedNode?: any;
  currentWorkflow?: any;
}

const OutputDisplayPanel: React.FC<OutputDisplayPanelProps> = ({ results, onClear }) => {
  const theme = useAppTheme();
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getExecutionData = (result: ExecutionResult) => {
    if (result.outputs) return result.outputs;
    if (result.data?.data) return result.data.data;
    return { message: 'No output data' };
  };

  // Format filesystem/shell results into readable output
  const formatFilesystemOutput = (data: any): string | null => {
    const r = data?.result || data;
    if (!r) return null;

    // fileRead: show file content
    if (r.content && r.file_path) {
      return `File: ${r.file_path}\n\n${r.content}`;
    }

    // fileModify: show operation result
    if (r.operation === 'write' && r.file_path) {
      return `Written: ${r.file_path}`;
    }
    if (r.operation === 'edit' && r.file_path) {
      return `Edited: ${r.file_path} (${r.occurrences || 1} replacement${(r.occurrences || 1) > 1 ? 's' : ''})`;
    }

    // shell: show stdout with exit code
    if (r.command !== undefined && r.stdout !== undefined) {
      const status = r.exit_code === 0 ? 'OK' : `Exit ${r.exit_code}`;
      const output = r.stdout || '(no output)';
      return `$ ${r.command}\n[${status}]\n\n${output}`;
    }

    // fsSearch ls: show directory listing
    if (r.entries && Array.isArray(r.entries)) {
      const lines = r.entries.map((e: any) =>
        `${e.type === 'dir' ? '[DIR]' : '     '} ${e.name}${e.size != null ? ` (${e.size} bytes)` : ''}`
      );
      return `${r.path || '.'} (${r.count || r.entries.length} items)\n\n${lines.join('\n')}`;
    }

    // fsSearch glob/grep: show matches
    if (r.matches && Array.isArray(r.matches)) {
      if (r.matches.length === 0) return `No matches for "${r.pattern}"`;
      const lines = r.matches.slice(0, 50).map((m: any) =>
        m.line ? `${m.path}:${m.line}: ${m.text}` : (m.path || JSON.stringify(m))
      );
      const suffix = r.count > 50 ? `\n... and ${r.count - 50} more` : '';
      return `${r.count || r.matches.length} match${(r.count || r.matches.length) > 1 ? 'es' : ''} for "${r.pattern}"\n\n${lines.join('\n')}${suffix}`;
    }

    return null;
  };

  // Format writeTodos results into a readable checklist
  const formatTodoOutput = (data: any): string | null => {
    const r = data?.result || data;
    if (!r) return null;

    // Parse todos from JSON string or array
    let todos: any[] = [];
    if (typeof r.todos === 'string') {
      try { todos = JSON.parse(r.todos); } catch { return null; }
    } else if (Array.isArray(r.todos)) {
      todos = r.todos;
    } else {
      return null;
    }

    if (todos.length === 0) return r.message || 'Todo list is empty.';

    const statusIcon: Record<string, string> = {
      pending: '[ ]',
      in_progress: '[~]',
      completed: '[x]',
    };
    const lines = todos.map((t: any, i: number) => {
      const icon = statusIcon[t.status] || '[ ]';
      return `${i + 1}. ${icon} ${t.content}`;
    });

    const counts = {
      pending: todos.filter((t: any) => t.status === 'pending').length,
      in_progress: todos.filter((t: any) => t.status === 'in_progress').length,
      completed: todos.filter((t: any) => t.status === 'completed').length,
    };
    const summary = `${todos.length} items: ${counts.completed} done, ${counts.in_progress} active, ${counts.pending} pending`;

    return `${summary}\n\n${lines.join('\n')}`;
  };

  // Extract the main response text from AI results
  const getMainResponse = (result: ExecutionResult): string | null => {
    const data = getExecutionData(result);

    // Filesystem/shell nodes
    const fsOutput = formatFilesystemOutput(data);
    if (fsOutput) return fsOutput;

    // Todo planning nodes
    const todoOutput = formatTodoOutput(data);
    if (todoOutput) return todoOutput;

    // Handle nested response structure
    if (data?.result?.response) return data.result.response;
    if (data?.response) return data.response;
    if (data?.result?.text) return data.result.text;
    if (data?.text) return data.text;
    if (data?.result?.content) return data.result.content;
    if (data?.content) return data.content;
    if (data?.result?.message) return data.result.message;
    if (data?.message && typeof data.message === 'string') return data.message;
    return null;
  };

  if (results.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
        color: theme.colors.textMuted,
        backgroundColor: theme.colors.backgroundPanel,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: theme.spacing.lg }}>
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
          No executions yet
        </div>
        <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, textAlign: 'center' }}>
          Run nodes to see their<br />execution results here
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.backgroundPanel,
    }}>
      {/* Header */}
      <div style={{
        padding: `${theme.spacing.md} ${theme.spacing.lg}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.background,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.dracula.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
          }}>
            Execution Results
          </span>
          <span style={{
            fontSize: theme.fontSize.xs,
            color: theme.colors.textMuted,
            backgroundColor: theme.colors.backgroundAlt,
            padding: `2px ${theme.spacing.sm}`,
            borderRadius: theme.borderRadius.sm,
          }}>
            {results.length}
          </span>
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
              e.currentTarget.style.borderColor = theme.colors.textMuted;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
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

      {/* Results List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: theme.spacing.md,
      }}>
        {results.map((result, index) => {
          const resultKey = `${result.nodeId}-${result.timestamp}-${index}`;
          const isExpanded = expandedResults.has(resultKey);
          const mainResponse = getMainResponse(result);
          const executionData = getExecutionData(result);

          return (
            <div
              key={resultKey}
              style={{
                marginBottom: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${result.success ? theme.dracula.green + '40' : theme.dracula.red + '40'}`,
                backgroundColor: theme.colors.background,
                overflow: 'hidden',
              }}
            >
              {/* Result Header */}
              <div style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                backgroundColor: result.success ? theme.dracula.green + '10' : theme.dracula.red + '10',
                borderBottom: `1px solid ${result.success ? theme.dracula.green + '30' : theme.dracula.red + '30'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  {result.success ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={theme.dracula.green} stroke="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={theme.dracula.red} stroke="none">
                      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                    </svg>
                  )}
                  <span style={{
                    fontSize: theme.fontSize.sm,
                    fontWeight: theme.fontWeight.semibold,
                    color: theme.colors.text,
                  }}>
                    {result.nodeName}
                  </span>
                  <span style={{
                    fontSize: theme.fontSize.xs,
                    fontWeight: theme.fontWeight.medium,
                    color: result.success ? theme.dracula.green : theme.dracula.red,
                    padding: `2px ${theme.spacing.sm}`,
                    backgroundColor: result.success ? theme.dracula.green + '20' : theme.dracula.red + '20',
                    borderRadius: theme.borderRadius.sm,
                  }}>
                    {result.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                    {result.executionTime.toFixed(2)}ms
                  </span>
                  <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                    {formatTimestamp(result.timestamp)}
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {result.error && (
                <div style={{
                  padding: theme.spacing.md,
                  backgroundColor: theme.dracula.red + '10',
                  borderBottom: `1px solid ${theme.dracula.red}30`,
                }}>
                  <pre style={{
                    margin: 0,
                    fontSize: theme.fontSize.sm,
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    color: theme.dracula.red,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {result.error}
                  </pre>
                </div>
              )}

              {/* Main Response (for AI results) */}
              {mainResponse && (
                <div style={{
                  padding: theme.spacing.md,
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                  <div style={{
                    fontSize: theme.fontSize.xs,
                    fontWeight: theme.fontWeight.medium,
                    color: theme.colors.textMuted,
                    marginBottom: theme.spacing.sm,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Response
                  </div>
                  <div style={{
                    fontSize: theme.fontSize.sm,
                    color: theme.colors.text,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {mainResponse}
                  </div>
                </div>
              )}

              {/* JSON Output Toggle */}
              <div style={{ padding: theme.spacing.md }}>
                <div
                  onClick={() => toggleExpand(resultKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    backgroundColor: theme.colors.backgroundAlt,
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer',
                    transition: theme.transitions.fast,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
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
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span style={{
                      fontSize: theme.fontSize.xs,
                      fontWeight: theme.fontWeight.medium,
                      color: theme.colors.textSecondary,
                    }}>
                      {isExpanded ? 'Hide' : 'Show'} Raw JSON
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(executionData, 'JSON copied to clipboard!');
                    }}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      fontSize: theme.fontSize.xs,
                      color: theme.colors.textMuted,
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
                      e.currentTarget.style.backgroundColor = theme.colors.background;
                      e.currentTarget.style.color = theme.colors.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.textMuted;
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                  </button>
                </div>

                {/* Expanded JSON with prismjs highlighting (theme from styles/theme.ts) */}
                {isExpanded && (
                  <div style={{
                    ...themeStyles.codeBlock.container,
                    marginTop: theme.spacing.sm,
                    padding: theme.spacing.md,
                    maxHeight: '300px',
                    backgroundColor: theme.colors.backgroundAlt,
                    color: theme.dracula.foreground,
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.border}`,
                  }}>
                    <style>{getPrismTokenCSS(theme)}</style>
                    <code
                      className="prism-code"
                      dangerouslySetInnerHTML={{
                        __html: Prism.highlight(
                          JSON.stringify(executionData, null, 2),
                          Prism.languages.json,
                          'json',
                        ),
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        fontSize: theme.fontSize.xs,
        color: theme.colors.textMuted,
        textAlign: 'center',
      }}>
        Results displayed in execution order
      </div>
    </div>
  );
};

export default OutputDisplayPanel;
