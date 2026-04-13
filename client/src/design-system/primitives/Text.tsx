import * as React from 'react';
import { cn } from '../lib/cn';

type Size = 'xs' | 'sm' | 'base' | 'lg';
type Weight = 'normal' | 'medium' | 'semibold' | 'bold';

const sizeClass: Record<Size, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

const weightClass: Record<Weight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: Size;
  weight?: Weight;
  muted?: boolean;
  mono?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

/** Inline text. Replaces antd `<Typography.Text>`. */
export const Text = React.forwardRef<HTMLSpanElement, TextProps>(
  (
    { size = 'base', weight = 'normal', muted = false, mono = false, as: Comp = 'span', className, ...rest },
    ref
  ) => {
    const Component = Comp as unknown as React.ElementType;
    return (
      <Component
        ref={ref}
        className={cn(
          sizeClass[size],
          weightClass[weight],
          muted && 'text-[hsl(var(--color-fg-muted))]',
          mono && 'font-mono',
          className
        )}
        {...rest}
      />
    );
  }
);
Text.displayName = 'Text';
