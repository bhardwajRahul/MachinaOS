/**
 * ActionButton -- colored "soft" toolbar button shared by the parameter
 * panel, location panel, settings header, and top toolbar.
 *
 * The `intent` prop is a semantic role (run / stop / save / ...), not a
 * palette color, so themes can re-skin without touching call sites.
 * Each intent reads the matching --action-X / --action-X-soft /
 * --action-X-border CSS triplet defined in index.css; pressed +
 * disabled state are baked into the variant so call sites never do
 * opacity arithmetic.
 *
 * Adding a new intent: add the --action-NAME triplet to index.css,
 * expose the three Tailwind tokens in the @theme inline block, then
 * add a case to `actionButtonVariants` below.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const actionButtonVariants = cva(
  // Base: 32px tall pill with icon-text gap, semibold, focus ring, smooth hover.
  'inline-flex h-8 items-center gap-1.5 rounded-md border px-3.5 text-[13px] font-semibold transition-all outline-none select-none disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring/40',
  {
    variants: {
      intent: {
        run:
          'border-action-run-border bg-action-run-soft text-action-run hover:bg-action-run/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        stop:
          'border-action-stop-border bg-action-stop-soft text-action-stop hover:bg-action-stop/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        save:
          'border-action-save-border bg-action-save-soft text-action-save hover:bg-action-save/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        config:
          'border-action-config-border bg-action-config-soft text-action-config hover:bg-action-config/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        secret:
          'border-action-secret-border bg-action-secret-soft text-action-secret hover:bg-action-secret/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
        tools:
          'border-action-tools-border bg-action-tools-soft text-action-tools hover:bg-action-tools/25 disabled:border-primary/40 disabled:bg-primary/10 disabled:text-primary',
      },
    },
    defaultVariants: { intent: 'save' },
  },
);

export type ActionButtonIntent = NonNullable<VariantProps<typeof actionButtonVariants>['intent']>;

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionButtonVariants> {}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, intent, ...props }, ref) => (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      className={cn(actionButtonVariants({ intent }), className)}
      {...props}
    />
  ),
);
ActionButton.displayName = 'ActionButton';
