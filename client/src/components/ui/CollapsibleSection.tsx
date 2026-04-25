import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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
  children,
}) => {
  const open = !isCollapsed;
  return (
    <Collapsible open={open} onOpenChange={() => onToggle()}>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 border-none bg-muted px-4 py-3 text-base text-foreground transition-colors hover:bg-card">
          {typeof title === 'string' ? (
            <span className="font-medium">{title}</span>
          ) : (
            <div className="flex flex-1 items-center">{title}</div>
          )}
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
              isCollapsed && '-rotate-90'
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className={cn('transition-[padding]', open && 'p-3')}>
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default CollapsibleSection;
