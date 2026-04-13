/**
 * Modal — composition primitive on top of shadcn Dialog.
 *
 * Owns the recurring "title bar with centered headerActions and a close
 * button + size-constrained content panel" layout that 8 call sites
 * share. Not a facade preserving an old library's API — the call sites
 * use this because the composition is genuinely reused. Don't add new
 * panels by re-implementing this with raw <Dialog>; extend Modal here
 * if you need a new prop.
 */

import React from 'react';
import { X, Settings } from 'lucide-react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
  maxHeight?: string;
  headerActions?: React.ReactNode;
  /** When true, modal height fits content up to maxHeight instead of fixed at maxHeight. */
  autoHeight?: boolean;
  /** Optional extra classes for the content panel. */
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  maxWidth = '500px',
  maxHeight = '80vh',
  headerActions,
  autoHeight = false,
  className,
}) => {
  const showHeader = Boolean(title || headerActions);

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl outline-none',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100',
            className
          )}
          style={{
            width: maxWidth,
            minWidth: maxWidth,
            height: autoHeight ? 'auto' : maxHeight,
            maxHeight,
          }}
        >
          {showHeader ? (
            <div className="relative flex w-full items-center border-b border-border bg-card px-5 py-3">
              <DialogTitle className="absolute left-5 flex items-center gap-2 text-base font-semibold text-foreground/80">
                <Settings className="h-4 w-4 opacity-70" />
                {title}
              </DialogTitle>
              <div className="flex flex-1 items-center justify-center">{headerActions}</div>
              <DialogClose
                onClick={onClose}
                className="absolute right-5 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-[18px] w-[18px]" />
              </DialogClose>
            </div>
          ) : (
            <DialogTitle className="sr-only">{title || 'Dialog'}</DialogTitle>
          )}
          <DialogDescription className="sr-only">{title || 'Modal dialog'}</DialogDescription>
          <div className="h-full flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default Modal;
