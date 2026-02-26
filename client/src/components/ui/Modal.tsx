import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
  maxHeight?: string;
  headerActions?: React.ReactNode;
  /** When true, modal height fits content up to maxHeight instead of fixed at maxHeight */
  autoHeight?: boolean;
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
}) => {
  const theme = useAppTheme();
  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: theme.colors.background,
            borderRadius: theme.borderRadius.lg,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: maxWidth,
            minWidth: maxWidth,
            height: autoHeight ? 'auto' : maxHeight,
            maxHeight: maxHeight,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 1001,
          }}
        >
          {(title || headerActions) && (
            <div
              style={{
                padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
                borderBottom: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundPanel,
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                width: '100%'
              }}
            >
              <Dialog.Title
                style={{
                  margin: 0,
                  fontSize: theme.fontSize.lg,
                  fontWeight: theme.fontWeight.semibold,
                  color: theme.colors.textSecondary,
                  position: 'absolute',
                  left: theme.spacing.xl,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                {title}
              </Dialog.Title>

              {/* Centered header actions */}
              <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {headerActions}
              </div>

              <Dialog.Close
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: theme.colors.textSecondary,
                  padding: theme.spacing.xs,
                  borderRadius: theme.borderRadius.sm,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  position: 'absolute',
                  right: theme.spacing.xl,
                  transition: `all ${theme.transitions.fast}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </Dialog.Close>
            </div>
          )}
          <Dialog.Description style={{ display: 'none' }}>
            {title || 'Modal dialog'}
          </Dialog.Description>
          <div
            style={{
              flex: 1,
              height: '100%',
              overflowY: 'auto',
              padding: 0,
            }}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;