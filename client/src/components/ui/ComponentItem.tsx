import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { INodeTypeDescription } from '../../types/INodeProperties';
import { resolveIcon, resolveLibraryIcon, isImageIcon as isImage } from '../../assets/icons';
import { useNodeSpec } from '../../lib/nodeSpec';

interface ComponentItemProps {
  definition: INodeTypeDescription;
  onDragStart: (event: React.DragEvent, definition: INodeTypeDescription) => void;
}

const ComponentItem: React.FC<ComponentItemProps> = ({ definition: localDefinition, onDragStart }) => {
  const [isDragging, setIsDragging] = useState(false);

  // Wave 10.B: subscribe to the backend NodeSpec cache so the palette
  // icon populates the moment prefetch lands. Icon + color come from
  // the spec; display fields fall back to the bundled definition.
  const spec = useNodeSpec(localDefinition.name);
  const definition = localDefinition;
  const iconRaw = spec?.icon ?? definition.icon;

  const LibIcon = resolveLibraryIcon(iconRaw);
  const resolvedIcon = LibIcon ? null : resolveIcon(iconRaw);
  const iconIsImage = !!resolvedIcon && isImage(resolvedIcon);

  return (
    <Card
      size="sm"
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e, localDefinition);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={cn(
        'group relative flex-row items-center gap-3 px-3 py-2 cursor-grab select-none',
        'transition-all duration-150 ease-out',
        'hover:-translate-y-0.5 hover:ring-2 hover:ring-foreground/15 hover:shadow-md',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg ring-1 ring-foreground/10">
        {LibIcon ? (
          <LibIcon size={20} />
        ) : iconIsImage ? (
          <img src={resolvedIcon!} alt="" className="h-5 w-5 object-contain" />
        ) : (
          <span>{resolvedIcon || '📦'}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {definition.displayName}
        </div>
        <div className="truncate text-xs leading-tight text-muted-foreground">
          {definition.description}
        </div>
      </div>

      <GripVertical
        className="h-4 w-4 shrink-0 text-muted-foreground opacity-30 transition-opacity group-hover:opacity-60"
        aria-hidden
      />
    </Card>
  );
};

export default ComponentItem;
