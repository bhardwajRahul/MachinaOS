/**
 * ActionBar — bottom themed action buttons driven by a config array.
 * Replaces the 5 identical action button sections across panels.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  return (
    <div className="flex justify-center gap-2 border-t border-border pt-3">
      {actions
        .filter((a) => !a.hidden)
        .map((a) => {
          const isLoading = loading === a.key;
          return (
            <Button
              key={a.key}
              variant="outline"
              onClick={a.onClick}
              disabled={a.disabled || isLoading}
              style={{
                backgroundColor: `${a.color}25`,
                borderColor: `${a.color}60`,
                color: a.color,
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : a.icon}
              {a.label}
            </Button>
          );
        })}
    </div>
  );
};

export default ActionBar;
