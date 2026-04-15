/**
 * Console Panel - n8n-style debug output panel with chat input
 *
 * Displays console log entries from Console nodes during workflow execution.
 * Includes chat input section for triggering chatTrigger nodes.
 * Shows in a collapsible bottom bar section with clear and filter options.
 * Chat and Console are split 50/50 side by side.
 * Supports resizing by dragging the top edge.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Node } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { z } from 'zod';
import { useWebSocket, ConsoleLogEntry } from '../../contexts/WebSocketContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useTheme } from '../../contexts/ThemeContext';
import { Input } from '@/components/ui/input';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

import { resolveNodeDescription } from '../../lib/nodeSpec';
// ---------------------------------------------------------------------------
// Inline reusable bits (kept colocated per the colocation principle — none of
// these have a second consumer in the codebase).
// ---------------------------------------------------------------------------

/**
 * Single zod schema owns the validated shape of every persisted preference
 * the console panel keeps in localStorage. Adding a pref means one edit
 * here (default value + range), not three (state + load + save).
 */
const consolePrefsSchema = z.object({
  panelHeight: z.number().min(80).max(2000).default(250),
  chatWidthPercent: z.number().min(20).max(80).default(50),
  fontSize: z.number().min(8).max(40).default(12),
  autoScroll: z.boolean().default(true),
  prettyPrint: z.boolean().default(true),
  consoleTab: z.enum(['console', 'terminal']).default('console'),
});
type ConsolePrefs = z.infer<typeof consolePrefsSchema>;
const CONSOLE_PREFS_KEY = 'console_panel_prefs_v1';

function loadConsolePrefs(): ConsolePrefs {
  try {
    const raw = localStorage.getItem(CONSOLE_PREFS_KEY);
    if (raw) {
      const parsed = consolePrefsSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch { /* fall through to defaults */ }
  return consolePrefsSchema.parse({});
}

function saveConsolePrefs(prefs: ConsolePrefs): void {
  try {
    localStorage.setItem(CONSOLE_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/**
 * Imperative drag-resize wrapped as a hook. Returns a `start` handler to
 * spread on the resize handle plus a boolean for "resizing now" so the
 * cursor / userSelect overlay can be synced. Two consumers in this file
 * (vertical panel height + horizontal chat/console split).
 */
function usePanelResize(opts: {
  axis: 'y' | 'x';
  cursor: 'ns-resize' | 'ew-resize';
  onMove: (deltaPx: number, startValue: number) => void;
  getStartValue: () => number;
}) {
  const [isResizing, setIsResizing] = useState(false);
  const startCoordRef = useRef(0);
  const startValueRef = useRef(0);
  const { axis, cursor, onMove, getStartValue } = opts;

  const start = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startCoordRef.current = axis === 'y' ? e.clientY : e.clientX;
    startValueRef.current = getStartValue();
    setIsResizing(true);
  }, [axis, getStartValue]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const cur = axis === 'y' ? e.clientY : e.clientX;
      onMove(cur - startCoordRef.current, startValueRef.current);
    };
    const handleUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, axis, cursor, onMove]);

  return { start, isResizing };
}

// Schema-driven: a node is a chat target / console sink if its definition
// sets the matching uiHints flag. Legacy name list kept until every node
// is annotated.
const LEGACY_CHAT_TRIGGER_TYPES = ['chatTrigger'];
const LEGACY_CONSOLE_NODE_TYPES = ['console'];

interface ConsolePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  nodes?: Node[];  // Workflow nodes for dropdown selection
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({
  isOpen,
  onToggle,
  // defaultHeight + maxHeight props are no longer read — defaults live in
  // consolePrefsSchema; max is computed from window.innerHeight at resize.
  // Kept on the prop type for backwards compatibility with existing callers.
  minHeight = 100,
  nodes = []
}) => {
  const theme = useAppTheme();
  const { isDarkMode } = useTheme();
  const { consoleLogs, clearConsoleLogs, terminalLogs, clearTerminalLogs, sendChatMessage, chatMessages, clearChatMessages } = useWebSocket();

  // Font size bounds derived from theme
  const minFontSize = parseInt(theme.fontSize.xs);
  const maxFontSize = parseInt(theme.fontSize.xl) * 2;
  const defaultFontSize = parseInt(theme.fontSize.sm);

  // Filter nodes via uiHints first, legacy name list as fallback.
  const chatTriggerNodes = useMemo(() =>
    nodes.filter(n => {
      const def = n.type ? resolveNodeDescription(n.type) : undefined;
      return def?.uiHints?.isChatTrigger
        ?? LEGACY_CHAT_TRIGGER_TYPES.includes(n.type || '');
    }),
    [nodes]
  );
  const consoleNodes = useMemo(() =>
    nodes.filter(n => {
      const def = n.type ? resolveNodeDescription(n.type) : undefined;
      return def?.uiHints?.isConsoleSink
        ?? LEGACY_CONSOLE_NODE_TYPES.includes(n.type || '');
    }),
    [nodes]
  );

  // Selected node states (stored as node ID, empty string means "all")
  const [selectedChatTriggerId, setSelectedChatTriggerId] = useState<string>('');
  const [selectedConsoleId, setSelectedConsoleId] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [terminalFilter, setTerminalFilter] = useState('');
  const [terminalLogLevel, setTerminalLogLevel] = useState<'all' | 'error' | 'warning' | 'info' | 'debug'>('all');
  // Persisted prefs (validated by zod, written through to localStorage).
  // One `setPref` updater replaces three pairs of useState + useEffect.
  const [prefs, setPrefs] = useState<ConsolePrefs>(loadConsolePrefs);
  const setPref = useCallback(<K extends keyof ConsolePrefs>(key: K, value: ConsolePrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveConsolePrefs(next);
      return next;
    });
  }, []);
  const { autoScroll, prettyPrint, consoleTab, panelHeight, chatWidthPercent, fontSize: consoleFontSize } = prefs;
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Chat input state — transient, stays as plain useState.
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Container ref for the horizontal resize math (needs the live width).
  const containerRef = useRef<HTMLDivElement>(null);

  // Vertical resize: drag handle adjusts panelHeight against the viewport cap.
  const verticalResize = usePanelResize({
    axis: 'y',
    cursor: 'ns-resize',
    getStartValue: () => panelHeight,
    onMove: (delta, start) => {
      const dynamicMax = window.innerHeight - 90;
      const next = Math.min(dynamicMax, Math.max(minHeight, start - delta));
      setPref('panelHeight', next);
    },
  });
  const isResizing = verticalResize.isResizing;
  const handleResizeStart = verticalResize.start;

  // Horizontal resize: drag handle adjusts chat/console split against the
  // container width (re-read each move so window resizes don't desync).
  const horizontalResize = usePanelResize({
    axis: 'x',
    cursor: 'ew-resize',
    getStartValue: () => chatWidthPercent,
    onMove: (delta) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newPercent = ((delta / rect.width) * 100) + chatWidthPercent;
      setPref('chatWidthPercent', Math.min(80, Math.max(20, newPercent)));
    },
  });
  const isHorizontalResizing = horizontalResize.isResizing;
  const handleHorizontalResizeStart = horizontalResize.start;

  // Clamp font size on first mount so out-of-band saved values can't escape
  // the [min, max] derived from the active theme.
  useEffect(() => {
    if (consoleFontSize < minFontSize || consoleFontSize > maxFontSize) {
      setPref('fontSize', defaultFontSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter console logs based on search input and selected console node
  const filteredLogs = useMemo(() => {
    let logs = consoleLogs;

    // Filter by selected console node (if one is selected)
    if (selectedConsoleId) {
      logs = logs.filter(log => log.node_id === selectedConsoleId);
    }

    // Filter by search text
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      logs = logs.filter(log =>
        log.label.toLowerCase().includes(lowerFilter) ||
        log.formatted.toLowerCase().includes(lowerFilter) ||
        log.node_id.toLowerCase().includes(lowerFilter)
      );
    }

    return logs;
  }, [consoleLogs, filter, selectedConsoleId]);

  // Filter terminal logs based on search input and log level
  const filteredTerminalLogs = useMemo(() => {
    let filtered = terminalLogs;

    // Filter by log level
    if (terminalLogLevel !== 'all') {
      const levelPriority: Record<string, number> = { error: 0, warning: 1, info: 2, debug: 3 };
      const selectedPriority = levelPriority[terminalLogLevel] ?? 2;
      filtered = filtered.filter(log => (levelPriority[log.level] ?? 2) <= selectedPriority);
    }

    // Filter by search text
    if (terminalFilter) {
      const lowerFilter = terminalFilter.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(lowerFilter) ||
        (log.source?.toLowerCase().includes(lowerFilter))
      );
    }

    return filtered;
  }, [terminalLogs, terminalFilter, terminalLogLevel]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, autoScroll, isOpen]);

  // Auto-scroll chat when new messages arrive
  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages?.length, isOpen]);

  const handleClearConsole = useCallback(() => {
    clearConsoleLogs();
  }, [clearConsoleLogs]);

  const handleClearChat = useCallback(() => {
    clearChatMessages();
  }, [clearChatMessages]);

  // Handle chat message send
  const handleSendChat = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || isSending) return;

    setIsSending(true);
    try {
      // Pass selected chatTrigger node ID if one is selected (empty string means broadcast to all)
      await sendChatMessage(message, selectedChatTriggerId || undefined);
      setChatInput('');
    } catch (error) {
      console.error('Failed to send chat message:', error);
    } finally {
      setIsSending(false);
    }
  }, [chatInput, isSending, sendChatMessage, selectedChatTriggerId]);

  // Handle Enter key in chat input
  const handleChatKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

  const formatTimestamp = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const timeStr = date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      // Add milliseconds manually
      const ms = date.getMilliseconds().toString().padStart(3, '0');
      return `${timeStr}.${ms}`;
    } catch {
      return timestamp;
    }
  }, []);

  const getFormatColor = useCallback((format: ConsoleLogEntry['format']) => {
    switch (format) {
      case 'json':
      case 'json_compact':
        return isDarkMode ? theme.dracula.cyan : '#0891b2';
      case 'text':
        return isDarkMode ? theme.dracula.foreground : theme.colors.text;
      case 'table':
        return isDarkMode ? theme.dracula.green : '#059669';
      default:
        return theme.colors.text;
    }
  }, [isDarkMode, theme]);

  // Format text for pretty printing - converts escaped newlines and formats JSON
  const formatForDisplay = useCallback((text: string): { formatted: string; isJson: boolean } => {
    if (!prettyPrint) return { formatted: text, isJson: false };

    // Convert escaped newlines to actual newlines
    let formatted = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

    // Try to parse and pretty-print JSON
    const trimmed = formatted.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        formatted = JSON.stringify(parsed, null, 2);
        return { formatted, isJson: true };
      } catch {
        // Not valid JSON, return with converted newlines
      }
    }

    return { formatted, isJson: false };
  }, [prettyPrint]);

  // Highlight JSON with Prism
  const highlightJson = useCallback((code: string): string => {
    return Prism.highlight(code, Prism.languages.json, 'json');
  }, []);


  // Resize handle style
  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '6px',
    cursor: 'ns-resize',
    backgroundColor: isResizing
      ? (isDarkMode ? theme.dracula.purple : theme.colors.primary)
      : 'transparent',
    transition: isResizing ? 'none' : 'background-color 0.15s ease',
    zIndex: 10
  };

  // Panel header with toggle
  const panelHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: isDarkMode ? theme.dracula.currentLine : theme.colors.backgroundPanel,
    borderTop: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    userSelect: 'none'
  };

  const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const badgeStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? `${theme.dracula.purple}40` : `${theme.colors.primary}20`,
    color: isDarkMode ? theme.dracula.purple : theme.colors.primary,
    padding: '1px 6px',
    borderRadius: '10px',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium
  };

  const contentStyle: React.CSSProperties = {
    height: isOpen ? `${panelHeight}px` : '0px',
    maxHeight: 'calc(100vh - 90px)', // toolbar (~48px) + panel header (~42px)
    overflow: 'hidden',
    backgroundColor: isDarkMode ? theme.dracula.background : theme.colors.background,
    transition: (isResizing || isHorizontalResizing) ? 'none' : 'height 0.2s ease-in-out',
    display: 'flex',
    flexDirection: 'row'  // Side by side
  };

  const chatSectionStyle: React.CSSProperties = {
    width: `${chatWidthPercent}%`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  };

  const consoleSectionStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const horizontalResizeHandleStyle: React.CSSProperties = {
    width: '6px',
    cursor: 'ew-resize',
    backgroundColor: isHorizontalResizing
      ? (isDarkMode ? theme.dracula.purple : theme.colors.primary)
      : (isDarkMode ? theme.dracula.selection : theme.colors.border),
    transition: isHorizontalResizing ? 'none' : 'background-color 0.15s ease',
    flexShrink: 0
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: isDarkMode ? theme.dracula.currentLine : theme.colors.backgroundPanel,
    borderBottom: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
    minHeight: '32px'
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fontFamily.sans,
    color: theme.colors.textSecondary,
    transition: theme.transitions.fast
  };

  const clearButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: isDarkMode ? `${theme.dracula.red}20` : `${theme.colors.error}15`,
    color: isDarkMode ? theme.dracula.red : theme.colors.error
  };

  const filterInputStyle: React.CSSProperties = {
    padding: '2px 6px',
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fontFamily.sans,
    backgroundColor: isDarkMode ? theme.dracula.background : theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.text,
    width: '100px',
    outline: 'none'
  };

  // Shared select/dropdown style using theme
  const selectStyle: React.CSSProperties = {
    padding: '2px 4px',
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fontFamily.sans,
    backgroundColor: isDarkMode ? theme.dracula.currentLine : theme.colors.background,
    color: theme.colors.text,
    border: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer',
    outline: 'none',
    maxWidth: '120px'
  };

  const logEntryStyle: React.CSSProperties = {
    display: 'flex',
    padding: '4px 12px',
    borderBottom: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
    gap: '12px',
    alignItems: 'flex-start'
  };

  const timestampStyle: React.CSSProperties = {
    color: isDarkMode ? theme.dracula.comment : theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    whiteSpace: 'nowrap',
    minWidth: '90px'
  };

  const labelStyle: React.CSSProperties = {
    color: isDarkMode ? theme.dracula.yellow : theme.colors.warning,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    minWidth: '80px',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const nodeInfoStyle: React.CSSProperties = {
    color: isDarkMode ? theme.dracula.pink : theme.colors.categoryTrigger,
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fontFamily.mono,
    minWidth: '80px',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: 0.85
  };

  const emptyStyle: React.CSSProperties = {
    padding: '24px',
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const chevronStyle: React.CSSProperties = {
    transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
    transition: 'transform 0.2s ease',
    color: theme.colors.textSecondary
  };

  // Chat styles
  const chatMessagesStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '12px 16px',
    fontFamily: theme.fontFamily.sans,
    fontSize: consoleFontSize,
  };

  const chatInputContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    padding: '10px 16px',
    borderTop: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
    backgroundColor: isDarkMode ? theme.dracula.currentLine : theme.colors.backgroundPanel
  };

  const chatInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fontFamily.sans,
    backgroundColor: isDarkMode ? theme.dracula.background : theme.colors.background,
    border: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
    borderRadius: '8px',
    color: theme.colors.text,
    outline: 'none'
  };

  const sendButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fontFamily.sans,
    fontWeight: theme.fontWeight.medium,
    backgroundColor: isDarkMode ? theme.dracula.green : theme.colors.success,
    color: isDarkMode ? theme.dracula.background : 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: isSending ? 'not-allowed' : 'pointer',
    opacity: isSending ? 0.7 : 1,
    transition: 'all 0.15s ease'
  };

  const chatMessageStyle = (isUser: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    marginBottom: '8px',
    borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
    backgroundColor: isUser
      ? (isDarkMode ? `${theme.dracula.purple}40` : `${theme.colors.primary}20`)
      : (isDarkMode ? theme.dracula.selection : theme.colors.backgroundPanel),
    maxWidth: '80%',
    marginLeft: isUser ? 'auto' : '0',
    marginRight: isUser ? '0' : 'auto',
    wordBreak: 'break-word',
    boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
  });

  const chatMessageTextStyle: React.CSSProperties = {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    margin: 0
  };

  const chatMessageTimeStyle: React.CSSProperties = {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: '2px'
  };

  return (
    <div
      className="relative"
      onWheel={e => {
        // Prevent scroll from propagating to the canvas/page when the cursor
        // is over the panel header, resize handle, or non-scrollable areas.
        // Scrollable children (chat messages, console logs) handle their own scroll.
        const target = e.target as HTMLElement;
        const scrollable = target.closest('[data-scrollable]');
        if (!scrollable) e.stopPropagation();
      }}
    >
      {/* Prism syntax highlighting styles for JSON */}

      {/* Resize Handle - Only visible when open */}
      {isOpen && (
        <div
          style={resizeHandleStyle}
          onMouseDown={handleResizeStart}
          onMouseEnter={e => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? `${theme.dracula.purple}40`
                : `${theme.colors.primary}30`;
            }
          }}
          onMouseLeave={e => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        />
      )}

      {/* Panel Header - Always visible */}
      <div
        style={panelHeaderStyle}
        onClick={onToggle}
      >
        <div style={headerLeftStyle}>
          <span style={chevronStyle}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span style={titleStyle}>
            Chat / Console
            {(consoleLogs.length > 0 || (chatMessages && chatMessages.length > 0)) && (
              <span style={badgeStyle}>
                {consoleLogs.length + (chatMessages?.length || 0)}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Panel Content - Resizable Split */}
      <div ref={containerRef} style={contentStyle}>
        {/* Chat Section - Left */}
        <div style={chatSectionStyle}>
          <div style={sectionHeaderStyle}>
            <div className="flex items-center gap-2">
              <span style={sectionTitleStyle}>
                Chat
                {chatMessages && chatMessages.length > 0 && (
                  <span style={{
                    ...badgeStyle,
                    backgroundColor: isDarkMode ? `${theme.dracula.green}40` : `${theme.colors.success}20`,
                    color: isDarkMode ? theme.dracula.green : theme.colors.success
                  }}>
                    {chatMessages.length}
                  </span>
                )}
              </span>
              {/* ChatTrigger node selector dropdown */}
              {chatTriggerNodes.length > 0 && (
                <select
                  value={selectedChatTriggerId}
                  onChange={e => setSelectedChatTriggerId(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={selectStyle}
                  title="Select chatTrigger node to target"
                >
                  <option value="">All Triggers</option>
                  {chatTriggerNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.data?.label || node.id}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {chatMessages && chatMessages.length > 0 && (
              <button
                style={clearButtonStyle}
                onClick={handleClearChat}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? `${theme.dracula.red}35` : `${theme.colors.error}25`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? `${theme.dracula.red}20` : `${theme.colors.error}15`;
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div data-scrollable style={chatMessagesStyle}>
            {(!chatMessages || chatMessages.length === 0) ? (
              <div style={emptyStyle}>
                Send a message to trigger chatTrigger nodes
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {chatMessages.map((msg, index) => (
                  <div key={`${msg.timestamp}-${index}`} style={chatMessageStyle(msg.role === 'user')}>
                    {msg.role === 'user' ? (
                      <pre style={{
                        ...chatMessageTextStyle,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.15,
                        fontFamily: 'inherit',
                        fontSize: 'inherit'
                      }}>
                        {msg.message}
                      </pre>
                    ) : (
                      <div className="chat-markdown" style={{ ...chatMessageTextStyle, lineHeight: 1.4 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {msg.message}
                        </ReactMarkdown>
                      </div>
                    )}
                    <div style={chatMessageTimeStyle}>
                      {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
          <div style={chatInputContainerStyle}>
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Type a message..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              style={chatInputStyle}
              disabled={isSending}
            />
            <button
              style={sendButtonStyle}
              onClick={handleSendChat}
              disabled={isSending || !chatInput.trim()}
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
        </div>

        {/* Horizontal Resize Handle */}
        <div
          style={horizontalResizeHandleStyle}
          onMouseDown={handleHorizontalResizeStart}
          onMouseEnter={e => {
            if (!isHorizontalResizing) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? `${theme.dracula.purple}60`
                : `${theme.colors.primary}40`;
            }
          }}
          onMouseLeave={e => {
            if (!isHorizontalResizing) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? theme.dracula.selection
                : theme.colors.border;
            }
          }}
        />

        {/* Console/Terminal Section - Right */}
        <div style={consoleSectionStyle}>
          <div style={sectionHeaderStyle}>
            {/* Tab Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPref('consoleTab', 'console')}
                style={{
                  ...buttonStyle,
                  padding: '3px 8px',
                  backgroundColor: consoleTab === 'console'
                    ? (isDarkMode ? `${theme.dracula.purple}40` : `${theme.colors.primary}20`)
                    : 'transparent',
                  color: consoleTab === 'console'
                    ? (isDarkMode ? theme.dracula.purple : theme.colors.primary)
                    : theme.colors.textSecondary,
                  fontWeight: consoleTab === 'console' ? '600' : '400',
                  borderRadius: '4px'
                }}
              >
                Console
                {consoleLogs.length > 0 && (
                  <span style={{ ...badgeStyle, marginLeft: '4px', padding: '0 4px' }}>{consoleLogs.length}</span>
                )}
              </button>
              <button
                onClick={() => setPref('consoleTab', 'terminal')}
                style={{
                  ...buttonStyle,
                  padding: '3px 8px',
                  backgroundColor: consoleTab === 'terminal'
                    ? (isDarkMode ? `${theme.dracula.cyan}40` : `${theme.colors.info}20`)
                    : 'transparent',
                  color: consoleTab === 'terminal'
                    ? (isDarkMode ? theme.dracula.cyan : theme.colors.info)
                    : theme.colors.textSecondary,
                  fontWeight: consoleTab === 'terminal' ? '600' : '400',
                  borderRadius: '4px'
                }}
              >
                Terminal
                {terminalLogs.length > 0 && (
                  <span style={{
                    ...badgeStyle,
                    marginLeft: '4px',
                    padding: '0 4px',
                    backgroundColor: isDarkMode ? `${theme.dracula.cyan}40` : `${theme.colors.info}20`,
                    color: isDarkMode ? theme.dracula.cyan : theme.colors.info
                  }}>{terminalLogs.length}</span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {consoleTab === 'terminal' && (
                <select
                  value={terminalLogLevel}
                  onChange={e => setTerminalLogLevel(e.target.value as 'all' | 'error' | 'warning' | 'info' | 'debug')}
                  onClick={e => e.stopPropagation()}
                  style={selectStyle}
                >
                  <option value="all">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning+</option>
                  <option value="info">Info+</option>
                  <option value="debug">Debug+</option>
                </select>
              )}
              {/* Console node selector dropdown */}
              {consoleTab === 'console' && consoleNodes.length > 0 && (
                <select
                  value={selectedConsoleId}
                  onChange={e => setSelectedConsoleId(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={selectStyle}
                  title="Filter logs by Console node"
                >
                  <option value="">All Consoles</option>
                  {consoleNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.data?.label || node.id}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Filter..."
                value={consoleTab === 'console' ? filter : terminalFilter}
                onChange={e => consoleTab === 'console' ? setFilter(e.target.value) : setTerminalFilter(e.target.value)}
                style={filterInputStyle}
                onClick={e => e.stopPropagation()}
              />
              <label
                style={{
                  ...buttonStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setPref('autoScroll', e.target.checked)}
                  className="h-3 w-3 cursor-pointer"
                />
                Auto
              </label>
              {consoleTab === 'console' && (
                <label
                  style={{
                    ...buttonStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    backgroundColor: prettyPrint
                      ? (isDarkMode ? `${theme.dracula.cyan}30` : `${theme.colors.info}20`)
                      : 'transparent'
                  }}
                  title="Format JSON and convert escaped newlines"
                >
                  <input
                    type="checkbox"
                    checked={prettyPrint}
                    onChange={e => setPref('prettyPrint', e.target.checked)}
                    className="h-3 w-3 cursor-pointer"
                  />
                  Pretty
                </label>
              )}
              <Input
                type="number"
                value={consoleFontSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setPref('fontSize', v);
                }}
                min={minFontSize}
                max={maxFontSize}
                className="h-7 w-14 text-xs"
              />
              {((consoleTab === 'console' && consoleLogs.length > 0) || (consoleTab === 'terminal' && terminalLogs.length > 0)) && (
                <button
                  style={clearButtonStyle}
                  onClick={consoleTab === 'console' ? handleClearConsole : clearTerminalLogs}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? `${theme.dracula.red}35` : `${theme.colors.error}25`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? `${theme.dracula.red}20` : `${theme.colors.error}15`;
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div data-scrollable style={{ flex: 1, overflow: 'auto', fontFamily: theme.fontFamily.mono, fontSize: consoleFontSize }}>
            {consoleTab === 'console' ? (
              // Console Logs Tab
              filteredLogs.length === 0 ? (
                <div style={emptyStyle}>
                  {consoleLogs.length === 0
                    ? 'Add a Console node to see debug output'
                    : 'No logs match the filter'}
                </div>
              ) : (
                filteredLogs.slice().reverse().map((log, index) => (
                  <div key={`${log.node_id}-${log.timestamp}-${index}`} style={logEntryStyle}>
                    <span style={timestampStyle}>{formatTimestamp(log.timestamp)}</span>
                    <span style={labelStyle} title={log.label || log.node_id}>
                      {log.label || log.node_id}
                    </span>
                    {log.source_node_label && (
                      <span style={nodeInfoStyle} title={`Source: ${log.source_node_type} (${log.source_node_id})`}>
                        {log.source_node_label}
                      </span>
                    )}
                    {(() => {
                      const { formatted, isJson } = formatForDisplay(log.formatted);
                      if (isJson && prettyPrint) {
                        return (
                          <pre
                            className="console-json-output m-0 flex-1 overflow-auto whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{ __html: highlightJson(formatted) }}
                          />
                        );
                      } else if (!isJson && prettyPrint) {
                        // Render markdown when Pretty Print is enabled for non-JSON text
                        return (
                          <div
                            className="chat-markdown"
                            style={{
                              flex: 1,
                              overflow: 'auto',
                              color: getFormatColor(log.format),
                              lineHeight: 1.4,
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{formatted}</ReactMarkdown>
                          </div>
                        );
                      } else {
                        return (
                          <pre
                            style={{
                              margin: 0,
                              flex: 1,
                              overflow: 'auto',
                              color: getFormatColor(log.format),
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.15,
                              fontFamily: 'inherit',
                              fontSize: 'inherit'
                            }}
                          >
                            {formatted}
                          </pre>
                        );
                      }
                    })()}
                  </div>
                ))
              )
            ) : (
              // Terminal Logs Tab
              filteredTerminalLogs.length === 0 ? (
                <div style={emptyStyle}>
                  {terminalLogs.length === 0
                    ? 'Server logs will appear here'
                    : 'No logs match the filter'}
                </div>
              ) : (
                <div className="min-w-max">
                  {filteredTerminalLogs.slice().reverse().map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} style={{
                      padding: '3px 12px',
                      borderBottom: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
                      backgroundColor: log.level === 'error'
                        ? (isDarkMode ? `${theme.dracula.red}10` : `${theme.colors.error}05`)
                        : log.level === 'warning'
                          ? (isDarkMode ? `${theme.dracula.orange}10` : `${theme.colors.warning}05`)
                          : 'transparent',
                      whiteSpace: 'nowrap'
                    }}>
                      <span style={{
                        color: isDarkMode ? theme.dracula.comment : theme.colors.textMuted,
                        fontSize: theme.fontSize.xs
                      }}>{formatTimestamp(log.timestamp)}</span>
                      {log.source && (
                        <span style={{
                          color: isDarkMode ? theme.dracula.cyan : theme.colors.info,
                          fontSize: theme.fontSize.xs,
                          marginLeft: theme.spacing.sm
                        }}>
                          [{log.source}]
                        </span>
                      )}
                      <span style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSize.sm,
                        marginLeft: theme.spacing.sm
                      }}>
                        {log.message}
                        {log.details && (
                          <span style={{ color: isDarkMode ? theme.dracula.comment : theme.colors.textMuted, marginLeft: theme.spacing.sm }}>
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsolePanel;
