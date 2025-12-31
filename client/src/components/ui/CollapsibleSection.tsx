import React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { useAppTheme } from '../../hooks/useAppTheme';

interface CollapsibleSectionProps {
  title: string | React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isCollapsed,
  onToggle,
  children
}) => {
  const theme = useAppTheme();
  return (
    <Collapsible.Root open={!isCollapsed} onOpenChange={() => onToggle()}>
      <div style={{
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        border: `1px solid ${theme.colors.border}`,
      }}>
        <Collapsible.Trigger 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            backgroundColor: theme.colors.backgroundAlt,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            fontSize: theme.fontSize.base,
            color: theme.colors.text,
            transition: `all ${theme.transitions.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundPanel;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
          }}
        >
          {typeof title === 'string' ? (
            <>
              <span style={{ fontWeight: theme.fontWeight.medium }}>{title}</span>
              <span style={{
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: `transform ${theme.transitions.fast}`,
                fontSize: '12px',
                color: theme.colors.textSecondary,
              }}>
                ▼
              </span>
            </>
          ) : (
            <>
              {title}
              <span style={{
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: `transform ${theme.transitions.fast}`,
                fontSize: '12px',
                color: theme.colors.textSecondary,
                marginLeft: 'auto',
              }}>
                ▼
              </span>
            </>
          )}
        </Collapsible.Trigger>

        <Collapsible.Content style={{
          padding: isCollapsed ? 0 : theme.spacing.md,
          transition: `padding ${theme.transitions.fast}`,
        }}>
          {children}
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
};

export default CollapsibleSection;