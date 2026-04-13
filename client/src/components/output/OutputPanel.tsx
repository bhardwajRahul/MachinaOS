/**
 * OutputPanel — execution output display.
 *
 * Single component using antd (Collapse, Tag, Space) + ReactMarkdown
 * + @uiw/react-json-view. No custom widgets, no registry, no schema
 * renderer. Backend owns display logic via `_uiHints` (future);
 * frontend is pure UI.
 */

import { Collapse, Tag, Space, Flex } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import JsonView from '@uiw/react-json-view';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { githubLightTheme } from '@uiw/react-json-view/githubLight';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ExecutionResult } from '../../services/executionService';
import { Node } from 'reactflow';
import { copyToClipboard } from '../../utils/formatters';

/** Extract output data from ExecutionResult. */
const getData = (r: ExecutionResult) =>
  r.outputs ?? r.data ?? r.nodeData?.[0]?.[0]?.json ?? { success: r.success };

/** Unwrap nested { result: {...} } from backend responses. */
const unwrap = (d: any) =>
  d?.result && typeof d.result === 'object' && !Array.isArray(d.result) ? d.result : d;

/** Convert escaped newlines to real ones (same pattern as ConsolePanel). */
const fmt = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

/** Tag color by field name. */
const TAG_COLOR: Record<string, string> = {
  model: 'purple', provider: 'cyan', agent_type: 'green',
};

interface Props {
  results: ExecutionResult[];
  onClear?: () => void;
  selectedNode?: Node | null;
}

export default function OutputPanel({ results, onClear, selectedNode }: Props) {
  const theme = useAppTheme();
  const filtered = selectedNode ? results.filter(r => r.nodeId === selectedNode.id) : results;
  const latest = filtered[0];

  if (!latest) {
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

  const raw = getData(latest);
  const data = unwrap(raw);
  const response = data?.response ?? data?.output ?? data?.text ?? data?.content ?? data?.stdout;
  const thinking = data?.thinking;
  const metaTags = ['model', 'provider', 'agent_type'].filter(k => data?.[k]);

  const items = [
    response && {
      key: 'response',
      label: 'Response',
      children: (
        <div className="prose prose-sm dark:prose-invert max-w-none" style={{ whiteSpace: 'pre-wrap' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {fmt(typeof response === 'string' ? response : JSON.stringify(response, null, 2))}
          </ReactMarkdown>
        </div>
      ),
    },
    thinking && {
      key: 'thinking',
      label: 'Thinking',
      children: (
        <div className="prose prose-sm dark:prose-invert max-w-none" style={{ whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{fmt(thinking)}</ReactMarkdown>
        </div>
      ),
    },
    {
      key: 'json',
      label: (
        <Space>
          Raw JSON
          <button
            onClick={(e) => { e.stopPropagation(); copyToClipboard(raw, 'Copied!'); }}
            style={{
              fontSize: theme.fontSize.xs, cursor: 'pointer',
              color: theme.dracula.cyan, background: 'none', border: 'none', padding: 0,
            }}
          >
            Copy
          </button>
        </Space>
      ),
      children: (
        <JsonView
          value={raw}
          collapsed={2}
          displayDataTypes={false}
          style={theme.isDarkMode ? githubDarkTheme : githubLightTheme}
        />
      ),
    },
  ].filter(Boolean) as any[];

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor: theme.colors.backgroundPanel,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        gap="small"
        style={{
          padding: `${theme.spacing.md} ${theme.spacing.lg}`,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundElevated,
          flexShrink: 0,
        }}
      >
        <Flex align="center" gap={4} wrap="wrap" flex="1 1 auto" style={{ minWidth: 0 }}>
          <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginRight: theme.spacing.xs }}>
            Output
          </span>
          <Tag color={latest.success ? 'green' : 'red'}>{latest.success ? 'Success' : 'Error'}</Tag>
          {latest.executionTime > 0 && <Tag>{(latest.executionTime / 1000).toFixed(1)}s</Tag>}
          {metaTags.map(k => (
            <Tag key={k} color={TAG_COLOR[k] || 'default'}>
              {String(data[k]).replace(/_/g, ' ')}
            </Tag>
          ))}
        </Flex>
        {onClear && (
          <button onClick={onClear} style={{
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            fontSize: theme.fontSize.xs, cursor: 'pointer', flexShrink: 0,
            color: theme.dracula.pink, backgroundColor: `${theme.dracula.pink}15`,
            border: `1px solid ${theme.dracula.pink}40`, borderRadius: theme.borderRadius.sm,
          }}>
            Clear
          </button>
        )}
      </Flex>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: theme.spacing.lg }}>
        {latest.error && (
          <pre style={{
            margin: `0 0 ${theme.spacing.md}`, padding: theme.spacing.md,
            backgroundColor: `${theme.dracula.red}10`,
            border: `1px solid ${theme.dracula.red}40`,
            borderRadius: theme.borderRadius.md, borderLeft: `3px solid ${theme.dracula.red}`,
            fontFamily: theme.fontFamily.mono, fontSize: theme.fontSize.sm,
            color: theme.dracula.red, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {latest.error}
          </pre>
        )}
        <Collapse defaultActiveKey={['response']} items={items} ghost />
      </div>
    </div>
  );
}
