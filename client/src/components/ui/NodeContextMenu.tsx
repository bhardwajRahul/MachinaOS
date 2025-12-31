/**
 * NodeContextMenu - Right-click context menu for nodes
 *
 * Provides actions: Rename, Copy, Delete
 * Follows n8n-style UX patterns with keyboard shortcuts displayed
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';

interface NodeContextMenuProps {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

interface MenuItem {
  label: string;
  shortcut: string;
  action: () => void;
  icon: string;
  danger?: boolean;
}

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  nodeId: _nodeId,
  x,
  y,
  onClose,
  onRename,
  onCopy,
  onDelete,
}) => {
  const theme = useAppTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  const menuItems: MenuItem[] = [
    { label: 'Rename', shortcut: 'F2', action: onRename, icon: '✏️' },
    { label: 'Copy', shortcut: 'Ctrl+C', action: onCopy, icon: '📋' },
    { label: 'Delete', shortcut: 'Del', action: onDelete, icon: '🗑️', danger: true },
  ];

  // Calculate menu position to avoid overflow
  const getMenuPosition = useCallback(() => {
    const menuWidth = 180;
    const menuHeight = menuItems.length * 36 + 16; // items + padding
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y;

    // Prevent overflow on right
    if (x + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 8;
    }

    // Prevent overflow on bottom
    if (y + menuHeight > viewportHeight) {
      top = viewportHeight - menuHeight - 8;
    }

    return { left, top };
  }, [x, y, menuItems.length]);

  const position = getMenuPosition();

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners with small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % menuItems.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
          break;
        case 'Enter':
          event.preventDefault();
          menuItems[focusedIndex].action();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, menuItems, onClose]);

  // Focus the menu on mount
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  const handleItemClick = (item: MenuItem) => {
    item.action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        backgroundColor: theme.colors.backgroundElevated,
        border: `1px solid ${theme.isDarkMode ? theme.colors.border : '#d1d5db'}`,
        borderRadius: theme.borderRadius.lg,
        boxShadow: theme.isDarkMode
          ? `0 4px 12px ${theme.colors.shadow}`
          : '0 4px 16px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        padding: theme.spacing.xs,
        zIndex: 10000,
        minWidth: '160px',
        outline: 'none',
      }}
    >
      {menuItems.map((item, index) => (
        <div
          key={item.label}
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => setFocusedIndex(index)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            borderRadius: theme.borderRadius.md,
            cursor: 'pointer',
            backgroundColor: focusedIndex === index
              ? theme.colors.backgroundHover
              : 'transparent',
            color: item.danger ? theme.dracula.red : theme.colors.text,
            fontSize: theme.fontSize.sm,
            transition: theme.transitions.fast,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <span style={{ fontSize: theme.fontSize.sm }}>{item.icon}</span>
            <span style={{ fontWeight: theme.fontWeight.medium }}>{item.label}</span>
          </div>
          <span
            style={{
              fontSize: theme.fontSize.xs,
              color: theme.colors.textMuted,
              fontFamily: 'monospace',
            }}
          >
            {item.shortcut}
          </span>
        </div>
      ))}
    </div>
  );
};

export default NodeContextMenu;
