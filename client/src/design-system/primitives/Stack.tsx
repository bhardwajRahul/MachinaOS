import * as React from 'react';
import { cn } from '../lib/cn';

type Gap = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

const gapClass: Record<Gap, string> = {
  '0': 'gap-0',
  '1': 'gap-[2px]',
  '2': 'gap-1',
  '3': 'gap-2',
  '4': 'gap-3',
  '5': 'gap-4',
  '6': 'gap-5',
  '7': 'gap-6',
  '8': 'gap-8',
};

const alignClass: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyClass: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  align?: Align;
  justify?: Justify;
  as?: keyof React.JSX.IntrinsicElements;
}

/** Vertical flex column. Replaces antd `<Space direction="vertical">`. */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ gap = '4', align, justify, as: Comp = 'div', className, ...rest }, ref) => {
    const Component = Comp as unknown as React.ElementType;
    return (
      <Component
        ref={ref}
        className={cn(
          'flex flex-col',
          gapClass[gap],
          align && alignClass[align],
          justify && justifyClass[justify],
          className
        )}
        {...rest}
      />
    );
  }
);
Stack.displayName = 'Stack';
