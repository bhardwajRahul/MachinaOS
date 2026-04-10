/**
 * ActionBar — bottom themed action buttons driven by a config array.
 * Replaces the 5 identical action button sections across panels.
 */

import React from 'react';
import { Button, Flex } from 'antd';
import { useAppTheme } from '../../../hooks/useAppTheme';

export interface ActionDef {
  key: string;
  label: string;
  /** Dracula color string from theme (e.g., theme.dracula.green). */
  color: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  hidden?: boolean;
}

interface Props {
  actions: ActionDef[];
  loading: string | null;
}

const ActionBar: React.FC<Props> = ({ actions, loading }) => {
  const theme = useAppTheme();
  return (
    <Flex gap={theme.spacing.sm} justify="center"
      style={{ paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.border}` }}>
      {actions.filter(a => !a.hidden).map(a => (
        <Button key={a.key}
          onClick={a.onClick}
          loading={loading === a.key}
          disabled={a.disabled}
          icon={a.icon}
          style={{ backgroundColor: `${a.color}25`, borderColor: `${a.color}60`, color: a.color }}>
          {a.label}
        </Button>
      ))}
    </Flex>
  );
};

export default ActionBar;
