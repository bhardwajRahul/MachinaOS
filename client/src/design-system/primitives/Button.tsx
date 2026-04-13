import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium ' +
    'transition-colors duration-[var(--duration-fast)] ' +
    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--color-border-focus)/0.35)] ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:pointer-events-none [&_svg:not([data-size])]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:bg-[hsl(var(--color-primary)/0.9)]',
        secondary:
          'bg-[hsl(var(--color-bg-alt))] text-[hsl(var(--color-fg))] hover:bg-[hsl(var(--color-surface-hover))]',
        ghost:
          'text-[hsl(var(--color-fg))] hover:bg-[hsl(var(--color-surface-hover))]',
        outline:
          'border border-[hsl(var(--color-border))] bg-transparent text-[hsl(var(--color-fg))] ' +
          'hover:bg-[hsl(var(--color-surface-hover))]',
        destructive:
          'bg-[hsl(var(--color-danger))] text-white hover:bg-[hsl(var(--color-danger)/0.9)]',
        link:
          'text-[hsl(var(--color-primary))] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
