import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const alertVariants = cva(
  'relative w-full rounded-[var(--radius-md)] border px-4 py-3 text-sm ' +
    '[&>svg]:text-[hsl(var(--color-fg-muted))] [&>svg+*]:mt-0.5',
  {
    variants: {
      variant: {
        default:
          'border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] text-[hsl(var(--color-fg))]',
        success:
          'border-[hsl(var(--color-success)/0.4)] bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
        warning:
          'border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]',
        danger:
          'border-[hsl(var(--color-danger)/0.4)] bg-[hsl(var(--color-danger)/0.1)] text-[hsl(var(--color-danger))]',
        info:
          'border-[hsl(var(--color-info)/0.4)] bg-[hsl(var(--color-info)/0.1)] text-[hsl(var(--color-info))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm opacity-90 [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';
