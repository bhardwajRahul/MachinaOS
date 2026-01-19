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
import { useWebSocket, ConsoleLogEntry } from '../../contexts/WebSocketContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useTheme } from '../../contexts/ThemeContext';

interface ConsolePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

// Storage keys for persisting state
const CONSOLE_HEIGHT_KEY = 'console_panel_height';

const ConsolePanel: React.FC<ConsolePanelProps> = ({
  isOpen,
  onToggle,
  defaultHeight = 250,
  minHeight = 100,
  maxHeight = 600
}) => {
  const theme = useAppTheme();
  const { isDarkMode } = useTheme();
  const { consoleLogs, clearConsoleLogs, sendChatMessage, chatMessages, clearChatMessages } = useWebSocket();
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Chat input state
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Panel height state with localStorage persistence
  const [panelHeight, setPanelHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(CONSOLE_HEIGHT_KEY);
      if (saved) {
        const height = parseInt(saved, 10);
        if (!isNaN(height) && height >= minHeight && height <= maxHeight) {
          return height;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return defaultHeight;
  });

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Save height to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(CONSOLE_HEIGHT_KEY, panelHeight.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [panelHeight]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = panelHeight;
  }, [panelHeight]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStartHeight.current + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Add cursor style to body during resize
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minHeight, maxHeight]);

  // Filter logs based on search input
  const filteredLogs = useMemo(() => {
    if (!filter) return consoleLogs;
    const lowerFilter = filter.toLowerCase();
    return consoleLogs.filter(log =>
      log.label.toLowerCase().includes(lowerFilter) ||
      log.formatted.toLowerCase().includes(lowerFilter) ||
      log.node_id.toLowerCase().includes(lowerFilter)
    );
  }, [consoleLogs, filter]);

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
      await sendChatMessage(message);
      setChatInput('');
    } catch (error) {
      console.error('Failed to send chat message:', error);
    } finally {
      setIsSending(false);
    }
  }, [chatInput, isSending, sendChatMessage]);

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
    overflow: 'hidden',
    backgroundColor: isDarkMode ? theme.dracula.background : theme.colors.background,
    transition: isResizing ? 'none' : 'height 0.2s ease-in-out',
    display: 'flex',
    flexDirection: 'row'  // Side by side
  };

  const sectionStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`
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
    fontSize: theme.fontSize.xs,
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
    borderRadius: '4px',
    fontSize: '10px',
    color: theme.colors.textSecondary,
    transition: 'background-color 0.15s ease'
  };

  const clearButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: isDarkMode ? `${theme.dracula.red}20` : `${theme.colors.error}15`,
    color: isDarkMode ? theme.dracula.red : theme.colors.error
  };

  const filterInputStyle: React.CSSProperties = {
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: isDarkMode ? theme.dracula.background : theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '4px',
    color: theme.colors.text,
    width: '100px',
    outline: 'none'
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
    fontSize: '11px',
    whiteSpace: 'nowrap',
    minWidth: '90px'
  };

  const labelStyle: React.CSSProperties = {
    color: isDarkMode ? theme.dracula.yellow : theme.colors.warning,
    fontSize: '12px',
    fontWeight: theme.fontWeight.medium,
    minWidth: '80px',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const nodeInfoStyle: React.CSSProperties = {
    color: isDarkMode ? theme.dracula.pink : '#db2777',
    fontSize: '11px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
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
    padding: '8px 12px'
  };

  const chatInputContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    borderTop: `1px solid ${isDarkMode ? theme.dracula.selection : theme.colors.border}`,
    backgroundColor: isDarkMode ? theme.dracula.currentLine : theme.colors.backgroundPanel
  };

  const chatInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '6px 10px',
    fontSize: theme.fontSize.sm,
    backgroundColor: isDarkMode ? theme.dracula.background : theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '6px',
    color: theme.colors.text,
    outline: 'none'
  };

  const sendButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: theme.fontSize.xs,
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
    padding: '6px 10px',
    marginBottom: '6px',
    borderRadius: '8px',
    backgroundColor: isUser
      ? (isDarkMode ? `${theme.dracula.purple}30` : `${theme.colors.primary}15`)
      : (isDarkMode ? theme.dracula.selection : theme.colors.backgroundPanel),
    maxWidth: '85%',
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    wordBreak: 'break-word'
  });

  const chatMessageTextStyle: React.CSSProperties = {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    margin: 0,
    whiteSpace: 'pre-wrap'
  };

  const chatMessageTimeStyle: React.CSSProperties = {
    fontSize: '9px',
    color: theme.colors.textMuted,
    marginTop: '2px'
  };

  return (
    <div style={{ position: 'relative' }}>
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

      {/* Panel Content - Split 50/50 */}
      <div style={contentStyle}>
        {/* Chat Section - Left Half */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
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
          <div style={chatMessagesStyle}>
            {(!chatMessages || chatMessages.length === 0) ? (
              <div style={emptyStyle}>
                Send a message to trigger chatTrigger nodes
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chatMessages.map((msg, index) => (
                  <div key={`${msg.timestamp}-${index}`} style={chatMessageStyle(msg.role === 'user')}>
                    <p style={chatMessageTextStyle}>{msg.message}</p>
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

        {/* Console Section - Right Half */}
        <div style={{ ...sectionStyle, borderRight: 'none' }}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>
              Console
              {consoleLogs.length > 0 && (
                <span style={badgeStyle}>{consoleLogs.length}</span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                placeholder="Filter..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={filterInputStyle}
                onClick={e => e.stopPropagation()}
              />
              <label
                style={{
                  ...buttonStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                />
                Auto
              </label>
              {consoleLogs.length > 0 && (
                <button
                  style={clearButtonStyle}
                  onClick={handleClearConsole}
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
          <div style={{ flex: 1, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace', fontSize: '12px' }}>
            {filteredLogs.length === 0 ? (
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
                  <pre
                    style={{
                      margin: 0,
                      flex: 1,
                      overflow: 'auto',
                      color: getFormatColor(log.format),
                      whiteSpace: log.format === 'json' ? 'pre-wrap' : 'pre',
                      wordBreak: 'break-word'
                    }}
                  >
                    {log.formatted}
                  </pre>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsolePanel;
