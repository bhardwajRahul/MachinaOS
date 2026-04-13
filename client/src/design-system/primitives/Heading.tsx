import * as React from 'react';
import { cn } from '../lib/cn';

type Level = 1 | 2 | 3 | 4 | 5;

const levelClass: Record<Level, string> = {
  1: 'text-3xl font-bold leading-tight tracking-tight',
  2: 'text-2xl font-semibold leading-tight tracking-tight',
  3: 'text-xl font-semibold leading-snug',
  4: 'text-lg font-semibold leading-snug',
  5: 'text-base font-semibold',
};

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: Level;
}

/** Heading element. Replaces antd `<Typography.Title level>`. */
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 2, className, ...rest }, ref) => {
    const Tag = `h${level}` as const;
    return React.createElement(Tag, {
      ref,
      className: cn('text-[hsl(var(--color-fg))]', levelClass[level], className),
      ...rest,
    });
  }
);
Heading.displayName = 'Heading';
