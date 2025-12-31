import React from 'react';
import Modal from './Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { copyToClipboard, formatTimestamp } from '../../utils/formatters';

interface AIResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    response: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
    finishReason?: string;
    nodeId: string;
    nodeName: string;
    timestamp: string;
  } | null;
}

const AIResultModal: React.FC<AIResultModalProps> = ({ isOpen, onClose, result }) => {
  const theme = useAppTheme();
  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🤖 AI Execution Result"
      maxWidth="800px"
      maxHeight="90vh"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header Info */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundAlt,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
            <div>
              <h3 style={{ 
                margin: 0, 
                fontSize: theme.fontSize.lg, 
                fontWeight: theme.fontWeight.semibold,
                color: theme.colors.text 
              }}>
                {result.nodeName} Result
              </h3>
              <p style={{
                margin: `${theme.spacing.xs} 0 0 0`,
                fontSize: theme.fontSize.sm,
                color: theme.colors.textSecondary
              }}>
                Model: {result.model} | {formatTimestamp(result.timestamp)}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(result.response, 'Response copied to clipboard!')}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                backgroundColor: theme.colors.focus,
                color: 'white',
                border: 'none',
                borderRadius: theme.borderRadius.sm,
                fontSize: theme.fontSize.sm,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.xs
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.colors.focus}
            >
              📋 Copy Response
            </button>
          </div>
          
          {/* Usage Stats */}
          {result.usage && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.sm,
            }}>
              <div style={{
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.background,
                borderRadius: theme.borderRadius.sm,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
                  {result.usage.promptTokens}
                </div>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>
                  Prompt Tokens
                </div>
              </div>
              <div style={{
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.background,
                borderRadius: theme.borderRadius.sm,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
                  {result.usage.completionTokens}
                </div>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>
                  Completion Tokens
                </div>
              </div>
              <div style={{
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.background,
                borderRadius: theme.borderRadius.sm,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
                  {result.usage.totalTokens}
                </div>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>
                  Total Tokens
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Response Content */}
        <div style={{
          flex: 1,
          padding: theme.spacing.lg,
          overflowY: 'auto'
        }}>
          <h4 style={{
            margin: `0 0 ${theme.spacing.md} 0`,
            fontSize: theme.fontSize.base,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text
          }}>
            Response:
          </h4>
          <div style={{
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.backgroundAlt,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            fontSize: theme.fontSize.base,
            lineHeight: '1.6',
            color: theme.colors.text,
            whiteSpace: 'pre-wrap',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {result.response}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: theme.spacing.lg,
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundAlt,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>
            {result.finishReason && `Finish reason: ${result.finishReason}`}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.sm,
              fontSize: theme.fontSize.sm,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
              e.currentTarget.style.borderColor = theme.colors.borderHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.background;
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AIResultModal;