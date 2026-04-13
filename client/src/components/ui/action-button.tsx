/**
 * ActionButton — colored "soft" toolbar button shared by the parameter
 * panel, location panel, settings header, and top toolbar. Replaces a
 * 14-line `actionButtonStyle(color, isDisabled)` style helper that was
 * copy-pasted across 4 files.
 *
 * The dracula palette is fixed (CSS vars, not arbitrary hex) so we use
 * a CVA `tone` variant and let Tailwind compile the static class names.
 * Disabled state automatically swaps tone to muted via `disabled:`
 * utility classes.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const actionButtonVariants = cva(
  // Base: 32px tall pill with icon-text gap, semibold, focus ring, smooth hover.
  // Disabled state is handled per-tone (different opacity/colors).
  'inline-flex h-8 items-center gap-1.5 rounded-md border px-3.5 text-[13px] font-semibold transition-all outline-none select-none disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring/40',
  {
    variants: {
      tone: {
        green:
          'border-dracula-green/60 bg-dracula-green/15 text-dracula-green hover:bg-dracula-green/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        purple:
          'border-dracula-purple/60 bg-dracula-purple/15 text-dracula-purple hover:bg-dracula-purple/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        pink:
          'border-dracula-pink/60 bg-dracula-pink/15 text-dracula-pink hover:bg-dracula-pink/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        cyan:
          'border-dracula-cyan/60 bg-dracula-cyan/15 text-dracula-cyan hover:bg-dracula-cyan/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        orange:
          'border-dracula-orange/60 bg-dracula-orange/15 text-dracula-orange hover:bg-dracula-orange/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        yellow:
          'border-dracula-yellow/60 bg-dracula-yellow/15 text-dracula-yellow hover:bg-dracula-yellow/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        red:
          'border-dracula-red/60 bg-dracula-red/15 text-dracula-red hover:bg-dracula-red/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
      },
    },
    defaultVariants: { tone: 'cyan' },
  },
);

export type ActionButtonTone = NonNullable<VariantProps<typeof actionButtonVariants>['tone']>;

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionButtonVariants> {}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, tone, ...props }, ref) => (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      className={cn(actionButtonVariants({ tone }), className)}
      {...props}
    />
  ),
);
ActionButton.displayName = 'ActionButton';
