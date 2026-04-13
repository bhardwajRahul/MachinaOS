import * as React from 'react';
import { cn } from '../lib/cn';

type Size = 'sm' | 'md' | 'lg';

const sizeClass: Record<Size, string> = {
  sm: 'h-3 w-3 border',
  md: 'h-4 w-4 border-2',
  lg: 'h-6 w-6 border-2',
};

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: Size;
  label?: string;
}

/** Indeterminate loading spinner. Replaces antd `<Spin />`. */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = 'md', label = 'Loading', className, ...rest }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-solid border-current border-r-transparent',
        'text-[hsl(var(--color-fg-muted))]',
        sizeClass[size],
        className
      )}
      {...rest}
    />
  )
);
Spinner.displayName = 'Spinner';

export interface SpinnerOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  spinning: boolean;
  children: React.ReactNode;
  size?: Size;
  label?: string;
}

/** `<SpinnerOverlay spinning={x}>{children}</SpinnerOverlay>` replaces `<Spin spinning={x}>...</Spin>`. */
export const SpinnerOverlay: React.FC<SpinnerOverlayProps> = ({
  spinning,
  children,
  size = 'md',
  label,
  className,
  ...rest
}) => (
  <div className={cn('relative', className)} {...rest}>
    {children}
    {spinning && (
      <div
        aria-hidden="false"
        className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--color-surface)/0.6)] backdrop-blur-[1px]"
      >
        <Spinner size={size} label={label} />
      </div>
    )}
  </div>
);
