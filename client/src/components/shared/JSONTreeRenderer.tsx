import React, { useState } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JSONTreeProps {
  data: Record<string, any>;
  nodeName: string;
  onDragStart: (e: React.DragEvent, nodeName: string, propertyPath: string, value: any) => void;
  templateName: string;
}

interface NodeProps {
  entryKey: string;
  value: any;
  path: string;
  nodeName: string;
  templateName: string;
  onDragStart: JSONTreeProps['onDragStart'];
  depth: number;
}

const TreeNode: React.FC<NodeProps> = ({
  entryKey,
  value,
  path,
  nodeName,
  templateName,
  onDragStart,
  depth,
}) => {
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  const isDraggable = !isObject;
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && onDragStart(e, nodeName, path, value)}
        style={{ paddingLeft: depth * 12 }}
        className={cn(
          'mb-1 flex items-start justify-between gap-2 rounded-md border border-info/40 bg-info/5 p-2 transition-colors',
          isDraggable && 'cursor-grab hover:-translate-y-px hover:bg-info/10'
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-1">
          {isObject && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-0.5 text-muted-foreground hover:text-foreground"
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <code className="block text-[11px] text-accent">
              {`{{${templateName}.${path}}}`}
            </code>
            <div className="mt-0.5 flex items-center gap-1 text-[10px]">
              <span className="font-semibold text-success">"{entryKey}"</span>
              <span className="text-muted-foreground">:</span>
              <span
                className={cn(
                  'truncate',
                  isObject
                    ? 'text-muted-foreground'
                    : typeof value === 'string'
                      ? 'text-destructive'
                      : 'text-foreground'
                )}
              >
                {isObject ? '{object}' : JSON.stringify(value)}
              </span>
            </div>
          </div>
        </div>
        {isDraggable && <GripVertical className="h-3 w-3 shrink-0 text-accent" />}
      </div>

      {isObject && open && (
        <div>
          {Object.entries(value).map(([childKey, childValue]) => (
            <TreeNode
              key={childKey}
              entryKey={childKey}
              value={childValue}
              path={`${path}.${childKey}`}
              nodeName={nodeName}
              templateName={templateName}
              onDragStart={onDragStart}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const JSONTreeRenderer: React.FC<JSONTreeProps> = ({
  data,
  nodeName,
  onDragStart,
  templateName,
}) => (
  <div className="bg-transparent">
    {Object.entries(data).map(([key, value]) => (
      <TreeNode
        key={key}
        entryKey={key}
        value={value}
        path={key}
        nodeName={nodeName}
        templateName={templateName}
        onDragStart={onDragStart}
        depth={0}
      />
    ))}
  </div>
);

export default JSONTreeRenderer;
