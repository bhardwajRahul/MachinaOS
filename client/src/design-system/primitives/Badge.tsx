import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium ' +
    'transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[hsl(var(--color-bg-alt))] text-[hsl(var(--color-fg))]',
        secondary:
          'border-transparent bg-[hsl(var(--color-accent)/0.15)] text-[hsl(var(--color-accent))]',
        success:
          'border-transparent bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]',
        warning:
          'border-transparent bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]',
        danger:
          'border-transparent bg-[hsl(var(--color-danger)/0.15)] text-[hsl(var(--color-danger))]',
        info:
          'border-transparent bg-[hsl(var(--color-info)/0.15)] text-[hsl(var(--color-info))]',
        outline:
          'border-[hsl(var(--color-border))] bg-transparent text-[hsl(var(--color-fg))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = 'Badge';

export { badgeVariants };
