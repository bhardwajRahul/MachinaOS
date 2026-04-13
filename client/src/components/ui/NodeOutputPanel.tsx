/**
 * NodeOutputPanel — displays execution results.
 *
 * Response text renders via Tailwind Typography (`prose`).
 * Raw JSON renders via prismjs with centralized theme tokens.
 * No node-type-specific rendering logic — the backend sends
 * standardized output, the frontend renders it uniformly.
 */

import React, { useState } from 'react';
import { Tag, Space } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { useAppTheme } from '../../hooks/useAppTheme';
import { styles as themeStyles, getPrismTokenCSS } from '../../styles/theme';
import { ExecutionResult } from '../../services/executionService';
import { Node } from 'reactflow';
import { copyToClipboard } from '../../utils/formatters';

/** Prismjs JSON syntax highlighting (same lib as CodeEditor.tsx). */
const highlightJSON = (json: string): React.ReactNode => (
  <code className="prism-code" dangerouslySetInnerHTML={{
    __html: Prism.highlight(json, Prism.languages.json, 'json'),
  }} />
);

// ============================================================================
// Thinking/Reasoning block (collapsible)
// ============================================================================

interface ThinkingBlockProps {
  thinking: string;
  provider?: string;
  theme: ReturnType<typeof useAppTheme>;
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, provider, theme }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!thinking?.trim()) return null;

  const label = provider?.includes('anthropic') ? 'Extended Thinking'
    : provider?.includes('openai') ? 'Reasoning'
    : 'Thinking';

  return (
    <div style={{
      border: `1px solid ${theme.dracula.orange}40`,
      borderRadius: theme.borderRadius.md,
      borderLeft: `3px solid ${theme.dracula.orange}`,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          cursor: 'pointer', backgroundColor: `${theme.dracula.orange}10`,
          fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold,
          color: theme.dracula.orange, textTransform: 'uppercase', letterSpacing: '0.1em',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.2s' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        {label}
      </div>
      {isExpanded && (
        <div className="prose prose-sm dark:prose-invert max-w-none" style={{
          padding: theme.spacing.md, fontSize: theme.fontSize.sm,
          maxHeight: '300px', overflow: 'auto',
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {thinking.replace(/\\n/g, '\n')}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Data extraction helpers (minimal, no node-type-specific formatting)
// ============================================================================

/** Extract output data object from ExecutionResult. */
const getOutputData = (result: ExecutionResult) => {
  if (result.outputs && Object.keys(result.outputs).length > 0) return result.outputs;
  if (result.data && Object.keys(result.data).length > 0) return result.data;
  if (result.nodeData?.[0]?.[0]?.json) return result.nodeData[0][0].json;
  return { success: result.success, message: 'Execution completed' };
};

/** Extract thinking content from result. */
const getThinkingContent = (result: ExecutionResult) => {
  const data = getOutputData(result);
  if (data?.result?.thinking) return { thinking: data.result.thinking, provider: data.result.provider };
  if (data?.thinking) return { thinking: data.thinking, provider: data?.provider };
  return { thinking: null as string | null };
};

/** Extract the main response text. Checks standard response field paths. */
const getMainResponse = (result: ExecutionResult): string | null => {
  const data = getOutputData(result);
  // Standard response fields (covers AI agents, code executors, tools)
  const text = data?.output ?? data?.result?.response ?? data?.response
    ?? data?.result?.text ?? data?.text
    ?? data?.result?.content ?? data?.content
    ?? data?.result?.message ?? data?.result?.preview ?? data?.preview;
  if (text !== undefined && text !== null) {
    return typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  }
  // Shell/command output
  if (data?.stdout !== undefined || data?.result?.stdout !== undefined) {
    const r = data?.result ?? data;
    return `$ ${r.command ?? ''}\n[${r.exit_code === 0 ? 'OK' : `Exit ${r.exit_code}`}]\n\n${r.stdout || '(no output)'}`;
  }
  return null;
};

// ============================================================================
// Component
// ============================================================================

interface NodeOutputPanelProps {
  results: ExecutionResult[];
  onClear?: () => void;
  selectedNode?: Node | null;
}

const NodeOutputPanel: React.FC<NodeOutputPanelProps> = ({ results, onClear, selectedNode }) => {
  const theme = useAppTheme();
  const [showRawJson, setShowRawJson] = useState(false);

  const nodeResults = selectedNode
    ? results.filter(r => r.nodeId === selectedNode.id)
    : results;

  if (nodeResults.length === 0) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: theme.colors.textMuted, fontSize: theme.fontSize.sm,
      }}>
        No output yet. Run a node to see results.
      </div>
    );
  }

  const latestResult = nodeResults[0];
  const outputData = getOutputData(latestResult);
  const mainResponse = getMainResponse(latestResult);
  const { thinking, provider } = getThinkingContent(latestResult);

  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundColor: theme.colors.backgroundPanel,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: `${theme.spacing.md} ${theme.spacing.lg}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: theme.colors.backgroundElevated, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={latestResult.success ? theme.dracula.green : theme.dracula.red} stroke="none">
            {latestResult.success
              ? <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              : <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>}
          </svg>
          <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
            Output
          </span>
          <Tag color={latestResult.success ? 'green' : 'red'}>
            {latestResult.success ? 'Success' : 'Error'}
          </Tag>
          {latestResult.executionTime > 0 && (
            <Tag>{(latestResult.executionTime / 1000).toFixed(1)}s</Tag>
          )}
        </div>
        {onClear && (
          <button onClick={onClear} style={{
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            fontSize: theme.fontSize.xs, cursor: 'pointer',
            color: theme.dracula.pink, backgroundColor: `${theme.dracula.pink}15`,
            border: `1px solid ${theme.dracula.pink}40`, borderRadius: theme.borderRadius.sm,
          }}>
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflow: 'auto', padding: theme.spacing.lg,
        display: 'flex', flexDirection: 'column', gap: theme.spacing.md,
      }}>
        {/* Error */}
        {latestResult.error && (
          <pre style={{
            margin: 0, padding: theme.spacing.md,
            backgroundColor: `${theme.dracula.red}10`,
            border: `1px solid ${theme.dracula.red}40`,
            borderRadius: theme.borderRadius.md, borderLeft: `3px solid ${theme.dracula.red}`,
            fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.mono,
            color: theme.dracula.red, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {latestResult.error}
          </pre>
        )}

        {/* Thinking/Reasoning */}
        {thinking && <ThinkingBlock thinking={thinking} provider={provider} theme={theme} />}

        {/* Main Response (markdown via Tailwind Typography) */}
        {mainResponse && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {mainResponse.replace(/\\n/g, '\n').replace(/\\t/g, '\t')}
            </ReactMarkdown>
          </div>
        )}

        {/* Execution Metadata */}
        {(() => {
          const r = outputData?.result || outputData;
          if (!r?.provider && !r?.agent_type && !r?.model) return null;
          const tags: [string, string][] = [];
          if (r.provider) tags.push([r.provider, 'cyan']);
          if (r.model) tags.push([r.model, 'purple']);
          if (r.agent_type) tags.push([r.agent_type.replace(/_/g, ' '), 'green']);
          if (r.iterations > 1) tags.push([`${r.iterations} iterations`, 'orange']);
          if (r.messages_count) tags.push([`${r.messages_count} msgs`, 'default']);
          return (
            <Space wrap size={[4, 4]}>
              {tags.map(([val, color], i) => <Tag key={i} color={color}>{val}</Tag>)}
            </Space>
          );
        })()}

        {/* Raw JSON (collapsible) */}
        <div style={{
          backgroundColor: theme.colors.backgroundElevated,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          flex: showRawJson ? 1 : undefined,
          minHeight: showRawJson ? 0 : undefined,
        }}>
          <div
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.colors.backgroundAlt, cursor: 'pointer',
              borderBottom: showRawJson ? `1px solid ${theme.colors.border}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" style={{ transform: showRawJson ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.2s' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                {showRawJson ? 'Hide' : 'Show'} Raw JSON
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(outputData, 'Copied!'); }}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                fontSize: theme.fontSize.xs, cursor: 'pointer',
                color: theme.dracula.cyan, backgroundColor: `${theme.dracula.cyan}15`,
                border: `1px solid ${theme.dracula.cyan}40`, borderRadius: theme.borderRadius.sm,
              }}
            >
              Copy
            </button>
          </div>

          {showRawJson && (
            <div style={{
              ...themeStyles.codeBlock.container,
              padding: theme.spacing.md, flex: 1, minHeight: 0,
              backgroundColor: theme.colors.backgroundAlt,
              color: theme.dracula.foreground,
            }}>
              <style>{getPrismTokenCSS(theme)}</style>
              {highlightJSON(JSON.stringify(outputData, null, 2).replace(/\\n/g, '\n').replace(/\\t/g, '\t'))}
            </div>
          )}
        </div>
      </div>

      {/* Footer (multi-result indicator) */}
      {nodeResults.length > 1 && (
        <div style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          fontSize: theme.fontSize.xs, color: theme.colors.textMuted,
          textAlign: 'center', flexShrink: 0,
        }}>
          Showing latest of {nodeResults.length} results
        </div>
      )}
    </div>
  );
};

export default NodeOutputPanel;
